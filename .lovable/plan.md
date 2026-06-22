# Candidate Discovery — Recruiter-Grade Filters

Upgrade the Discovery search form and search engine to behave like Apollo / LinkedIn Recruiter.

## 1. Global Location Picker (Country → State → City)

- Replace the current single country field with three cascading, searchable comboboxes:
  - Country (full ISO list, ~250 entries)
  - State / Province (loaded after country is chosen)
  - City (loaded after state is chosen, free-text fallback if not in dataset)
- Data source: bundle `country-state-city` (npm) at build time — covers all countries and major cities offline, no API cost.
- Component: new `src/components/discovery/LocationPicker.tsx` using shadcn `Command` + `Popover` for autocomplete.
- Output shape stored on the search request:
  ```ts
  location: { country: string; countryCode: string; state?: string; city?: string }
  ```

## 2. Smart Location Hierarchy in Search

Edge function `ai-candidate-search` already has `CITY_HIERARCHY`. Extend it:

- Build passes from the most specific level upward: `city → metro (if known) → state → country`.
- Never jump straight to country; metro/state must be exhausted first.
- Metro mapping table seeded with the major recruiter metros (SF → Bay Area, NYC → Tri-State, London → Greater London, Dubai → UAE, etc.). Unknown metros simply skip that level.

## 3. Advanced Skills Builder UI

New `src/components/discovery/SkillsBuilder.tsx` with two grouped sections:

- **Required Skills (AND)** — chip list; each chip can be expanded into an OR-group of alternatives.
- **Optional Skills (OR)** — flat chip list.
- Languages and Industries reuse the same chip pattern (OR groups).
- Add / remove via Enter key, paste-split on commas, drag to reorder.

Data shape sent to the backend:
```ts
skills: {
  required: string[][];   // outer = AND, inner = OR alternatives
  optional: string[];     // OR
}
languages: string[];      // OR
industries: string[];     // OR
```

## 4. Boolean Query Construction

`buildSearchPasses` in `ai-candidate-search/index.ts` converts the shape above into:

- Pass 1 (strictest): every AND group joined with `AND`, each OR group wrapped in `(a OR b OR c)`, plus required language/industry.
- Pass 2: drop optional skills.
- Pass 3: keep only first AND group + location.
- Pass 4: industry + location only.
- Pass 5: title + country.

Each pass is mapped to native Lusha filters (titles / industries / locations) — never sent as raw booleans.

## 5. AI Synonym Expansion

New edge function `discovery-expand-synonyms`:

- Input: `{ skills: string[] }`
- Calls OpenAI `gpt-4o-mini` with a tight JSON schema: `{ term: string, synonyms: string[] }[]` (max 5 each).
- Cached per-tenant in a new lightweight table `discovery_synonym_cache (term text pk, synonyms text[], updated_at timestamptz)` to avoid repeat spend.
- Frontend: when a user adds a chip, a "✨ Expand" button calls the function and adds suggestions as OR alternatives the user can accept individually.

## 6. Search Preview Panel

Before submitting, show a read-only summary card:

```
Location:    San Francisco → Bay Area → California → USA
Required:    React AND TypeScript AND (Node.js OR Deno)
Optional:    Machine Learning OR AI
Languages:   Russian OR Ukrainian
Industries:  Commodity Trading OR Shipping
Passes:      5 search passes will run
```

Rendered inside `AICandidateDiscoveryPage.tsx`.

## 7. Saved Filter Templates

New table `discovery_search_templates`:

```sql
create table public.discovery_search_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  name text not null,
  payload jsonb not null,
  created_at timestamptz default now()
);
grant select, insert, update, delete on public.discovery_search_templates to authenticated;
grant all on public.discovery_search_templates to service_role;
alter table public.discovery_search_templates enable row level security;
create policy "tenant read"  on ... using (tenant_id = current_tenant());
create policy "owner write" on ... using (user_id = auth.uid());
```

UI: a "Templates" dropdown in the Discovery header with Save / Load / Delete. Renamed examples preloaded for new tenants (Commodity Trader, Freight Trader, Ops Manager UAE, Software Engineer AI).

## 8. Files Touched

**New**
- `src/components/discovery/LocationPicker.tsx`
- `src/components/discovery/SkillsBuilder.tsx`
- `src/components/discovery/SearchPreview.tsx`
- `src/components/discovery/TemplatesMenu.tsx`
- `supabase/functions/discovery-expand-synonyms/index.ts`

**Updated**
- `src/pages/AICandidateDiscoveryPage.tsx` — wire new components, new request shape
- `src/pages/AICandidateResultsPage.tsx` — display new pass breakdown / preview
- `supabase/functions/ai-candidate-search/index.ts` — accept new shape, build AND/OR booleans, expand metro level
- `package.json` — add `country-state-city`

**Migration**
- `discovery_search_templates` table + RLS + grants
- `discovery_synonym_cache` table + grants

## Technical notes

- No breaking change to existing saved candidates / results.
- Search request shape is versioned (`schemaVersion: 2`); edge function accepts both.
- All synonym + template calls are tenant-scoped and RLS-enforced.
- Country/state/city dataset adds ~600 KB gzipped — lazy-imported only on the Discovery page.

## Open questions

1. Should saved templates be **personal** (per user) or **shared across the tenant**? Plan currently scopes to user but exposes them tenant-wide for read.
2. For AI synonym expansion, OK to default to `gpt-4o-mini` (cheap, fast) per project memory?
3. Any countries you want preloaded as **suggested** at the top of the country picker (e.g. UK, UAE, USA, Singapore, India)?
