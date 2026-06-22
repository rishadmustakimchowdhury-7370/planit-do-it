import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import type { DiscoveryLocation } from './LocationPicker';
import type { SkillsValue } from './SkillsBuilder';

interface Props {
  location: DiscoveryLocation | null;
  skills: SkillsValue;
  languages: string[];
  industries: string[];
}

function formatRequired(groups: string[][]): string {
  if (!groups.length) return '—';
  return groups
    .map((g) => (g.length === 1 ? g[0] : `(${g.join(' OR ')})`))
    .join(' AND ');
}

function formatOr(arr: string[]): string {
  if (!arr.length) return '—';
  return arr.join(' OR ');
}

export function SearchPreview({ location, skills, languages, industries }: Props) {
  const passes = 1
    + (skills.optional.length ? 1 : 0)
    + (skills.required.length > 1 ? 1 : 0)
    + (location?.state ? 1 : 0)
    + (location?.country ? 1 : 0);
  return (
    <Card className="border-primary/20 bg-muted/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Search Strategy Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm font-mono">
        <Row label="Location" value={location ? [location.city, location.state, location.country].filter(Boolean).join(' → ') : '—'} />
        <Row label="Required" value={formatRequired(skills.required)} />
        <Row label="Optional" value={formatOr(skills.optional)} />
        <Row label="Languages" value={formatOr(languages)} />
        <Row label="Industries" value={formatOr(industries)} />
        <Row label="Passes" value={`${Math.max(1, passes)} search passes will run`} />
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <span className="break-words">{value}</span>
    </div>
  );
}
