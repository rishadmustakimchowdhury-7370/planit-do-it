import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface Props {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}

export function ChipList({ label, hint, values, onChange, placeholder }: Props) {
  const [val, setVal] = useState('');
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    const next = [...values];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    onChange(next);
    setVal('');
  };
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        {label} {hint && <span className="text-foreground/60">{hint}</span>}
      </label>
      <div className="flex items-center gap-2 flex-wrap min-h-[28px]">
        {values.length === 0 && <span className="text-xs text-muted-foreground italic">None yet</span>}
        {values.map((t) => (
          <Badge key={t} variant="outline" className="gap-1">
            {t}
            <button onClick={() => onChange(values.filter((v) => v !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <Input
        value={val}
        placeholder={placeholder}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(val); } }}
        onBlur={() => val && add(val)}
        className="h-8 text-sm"
      />
    </div>
  );
}
