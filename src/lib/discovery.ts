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

type LinkedInPath = 'in' | 'company';

function normalizeLinkedInUrlForPath(raw: string | null | undefined, allowed: LinkedInPath[]): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  if (/^(undefined|null|#|javascript:void\(0\)|javascript:;)$/i.test(s) || /^javascript:/i.test(s)) return null;
  const mdLabel = s.match(/^\[([^\]]+)\]\([^)]*\)$/i);
  if (mdLabel) s = mdLabel[1].trim();
  const md = s.match(/\((https?:[^)]+)\)/i);
  if (md) s = md[1];
  if (s.startsWith('//')) s = 'https:' + s;
  if (/^linkedin\.com\//i.test(s)) s = s.replace(/^linkedin\.com\//i, 'https://www.linkedin.com/');
  if (/^www\.linkedin\.com\//i.test(s)) s = s.replace(/^www\.linkedin\.com\//i, 'https://www.linkedin.com/');
  if (/^[a-z]{2}\.linkedin\.com\//i.test(s)) s = s.replace(/^[a-z]{2}\.linkedin\.com\//i, 'https://www.linkedin.com/');
  if (/^\/(in|company)\//i.test(s)) s = 'https://www.linkedin.com' + s;
  let url: URL;
  try { url = new URL(s); } catch { return null; }
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname)) return null;
  url.hostname = 'www.linkedin.com';
  url.protocol = 'https:';
  url.search = '';
  url.hash = '';
  const m = url.pathname.match(/^\/(in|company)\/([^/?#\s]+)\/?/i);
  if (!m) return null;
  const type = m[1].toLowerCase() as LinkedInPath;
  if (!allowed.includes(type)) return null;
  url.pathname = `/${type}/${m[2]}`;
  return url.toString();
}

/** Normalize a LinkedIn member profile URL. LinkedIn must open externally, never embedded. */
export function normalizeLinkedInUrl(raw: string | null | undefined): string | null {
  return normalizeLinkedInUrlForPath(raw, ['in']);
}

export function normalizeLinkedInAnyUrl(raw: string | null | undefined): string | null {
  return normalizeLinkedInUrlForPath(raw, ['in', 'company']);
}

export function isValidLinkedInUrl(raw: string | null | undefined): boolean {
  return normalizeLinkedInUrl(raw) !== null;
}

export function isCanonicalLinkedInProfileUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== 'string') return false;
  return /^https:\/\/(www\.)?linkedin\.com\/in\/[^/?#\s]+\/?$/i.test(raw.trim());
}

export function openLinkedInUrl(raw: string | null | undefined): boolean {
  const url = normalizeLinkedInAnyUrl(raw);
  if (!url) return false;
  console.log(url);
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function displayCandidateEmail(email: string | null | undefined): string {
  if (!email || /no-email\.local$/i.test(email)) return 'Email Not Available';
  return email;
}

export function hasRealCandidateEmail(email: string | null | undefined): boolean {
  return !!email && !/no-email\.local$/i.test(email);
}

