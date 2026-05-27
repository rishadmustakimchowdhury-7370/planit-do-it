// Client-side mappings for the Discovery Engine (matches _shared/discovery-engine.ts).
import type { DiscoveryClassification } from '@/hooks/useRediscoveredMatches';

export const DISCOVERY_META: Record<
  DiscoveryClassification,
  { label: string; badgeClass: string; dotClass: string; rank: number }
> = {
  strong_shortlist: {
    label: 'Strong Shortlist', rank: 6,
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
  },
  recommended_shortlist: {
    label: 'Recommended', rank: 5,
    badgeClass: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
    dotClass: 'bg-sky-500',
  },
  transferable_shortlist: {
    label: 'Transferable', rank: 4,
    badgeClass: 'bg-indigo-500/10 text-indigo-700 border-indigo-500/30',
    dotClass: 'bg-indigo-500',
  },
  adjacent_ecosystem: {
    label: 'Adjacent Ecosystem', rank: 3,
    badgeClass: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
    dotClass: 'bg-violet-500',
  },
  needs_validation: {
    label: 'Needs Validation', rank: 2,
    badgeClass: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    dotClass: 'bg-amber-500',
  },
  low_relevance: {
    label: 'Low Relevance', rank: 1,
    badgeClass: 'bg-muted text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground',
  },
};

export function discoveryMeta(cls: DiscoveryClassification | null | undefined) {
  return DISCOVERY_META[cls ?? 'needs_validation'];
}
