import { useEffect, useState } from 'react';
import { Bookmark, Loader2, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Template { id: string; name: string; payload: unknown; }

interface Props<T> {
  current: T;
  onLoad: (payload: T) => void;
}

export function TemplatesMenu<T>({ current, onLoad }: Props<T>) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('discovery_search_templates')
      .select('id, name, payload')
      .order('created_at', { ascending: false });
    if (!error && data) setTemplates(data as Template[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp.user?.id;
      if (!userId) throw new Error('Not signed in');
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('id', userId).single();
      if (!profile?.tenant_id) throw new Error('No tenant');
      const { error } = await supabase.from('discovery_search_templates').insert({
        name: trimmed, payload: current as object, user_id: userId, tenant_id: profile.tenant_id,
      });
      if (error) throw error;
      toast({ title: 'Template saved', description: trimmed });
      setName('');
      await load();
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('discovery_search_templates').delete().eq('id', id);
    if (error) toast({ title: 'Delete failed', description: error.message, variant: 'destructive' });
    else await load();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Bookmark className="h-4 w-4" /> Templates
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Save className="h-3.5 w-3.5" /> Save current search
        </DropdownMenuLabel>
        <div className="px-2 pb-2 flex gap-2">
          <Input
            placeholder="Template name…" value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={save} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
          </Button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Saved templates</DropdownMenuLabel>
        {loading && <div className="px-2 py-3 text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading…</div>}
        {!loading && templates.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground italic">No templates yet.</div>}
        {templates.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={(e) => e.preventDefault()} className="flex items-center justify-between gap-2">
            <button className="flex-1 text-left truncate" onClick={() => onLoad(t.payload as T)}>{t.name}</button>
            <button onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive" aria-label={`Delete ${t.name}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
