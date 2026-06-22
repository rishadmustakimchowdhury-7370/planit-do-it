import { useState } from 'react';
import { Sparkles, X, Plus, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SkillsValue {
  required: string[][]; // AND of OR-groups
  optional: string[];   // OR
}

interface Props {
  value: SkillsValue;
  onChange: (v: SkillsValue) => void;
}

function ChipInput({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState('');
  const commit = () => {
    const parts = val.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    parts.forEach(onAdd);
    setVal('');
  };
  return (
    <Input
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
      }}
      onBlur={commit}
      className="h-8 text-sm"
    />
  );
}

export function SkillsBuilder({ value, onChange }: Props) {
  const { toast } = useToast();
  const [expanding, setExpanding] = useState<string | null>(null);

  const addGroup = (term: string) => {
    onChange({ ...value, required: [...value.required, [term]] });
  };
  const addAlt = (i: number, term: string) => {
    const groups = value.required.map((g, gi) => (gi === i && !g.includes(term) ? [...g, term] : g));
    onChange({ ...value, required: groups });
  };
  const removeFromGroup = (i: number, term: string) => {
    const groups = value.required
      .map((g, gi) => (gi === i ? g.filter((t) => t !== term) : g))
      .filter((g) => g.length > 0);
    onChange({ ...value, required: groups });
  };
  const addOptional = (term: string) => {
    if (value.optional.includes(term)) return;
    onChange({ ...value, optional: [...value.optional, term] });
  };
  const removeOptional = (term: string) => {
    onChange({ ...value, optional: value.optional.filter((t) => t !== term) });
  };

  const expand = async (i: number, term: string) => {
    setExpanding(`${i}:${term}`);
    try {
      const { data, error } = await supabase.functions.invoke('discovery-expand-synonyms', {
        body: { terms: [term] },
      });
      if (error) throw new Error(error.message);
      const syns: string[] = data?.results?.[0]?.synonyms ?? [];
      if (!syns.length) {
        toast({ title: 'No synonyms found', description: `No common alternatives for "${term}".` });
        return;
      }
      const groups = value.required.map((g, gi) => {
        if (gi !== i) return g;
        const merged = [...g];
        for (const s of syns) if (!merged.includes(s)) merged.push(s);
        return merged;
      });
      onChange({ ...value, required: groups });
    } catch (e) {
      toast({ title: 'Failed to expand', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
    } finally {
      setExpanding(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Required (AND of OR groups) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Required skills <span className="text-foreground/60">(all groups must match — AND)</span></label>
        </div>
        <div className="space-y-2">
          {value.required.map((group, i) => (
            <div key={i} className="rounded-md border bg-muted/30 p-2 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">OR</span>
                {group.map((term) => (
                  <Badge key={term} variant="secondary" className="gap-1">
                    {term}
                    <button onClick={() => removeFromGroup(i, term)} aria-label={`Remove ${term}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  size="sm" variant="ghost" className="h-6 px-2 text-xs gap-1"
                  onClick={() => expand(i, group[0])}
                  disabled={expanding !== null}
                >
                  {expanding?.startsWith(`${i}:`)
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Sparkles className="h-3 w-3" />}
                  AI synonyms
                </Button>
              </div>
              <ChipInput placeholder="Add alternative (OR)… e.g. ReactJS" onAdd={(t) => addAlt(i, t)} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1"><ChipInput placeholder="Add required skill… e.g. React" onAdd={addGroup} /></div>
        </div>
      </div>

      {/* Optional (OR) */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Optional skills <span className="text-foreground/60">(nice to have — OR)</span></label>
        <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
          {value.optional.length === 0 && <span className="text-xs text-muted-foreground italic">None yet</span>}
          {value.optional.map((t) => (
            <Badge key={t} variant="outline" className="gap-1">
              {t}
              <button onClick={() => removeOptional(t)} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
        <ChipInput placeholder="Add optional skill… e.g. GraphQL" onAdd={addOptional} />
      </div>
    </div>
  );
}
