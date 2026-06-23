# Candidate & Client Discovery — Production Upgrade Plan

Scope is large. I'll ship it in 7 phases so you can verify each before the next. No DB destructive changes; only additive columns and one new table for client discovery cache.

---

## Phase 1 — Scoring & Industry Soft Signal
**Files:** `supabase/functions/ai-candidate-search/index.ts`, `supabase/functions/_shared/discovery-engine.ts`, `src/pages/AICandidateDiscoveryPage.tsx`, `src/pages/AICandidateResultsPage.tsx`

- Replace hard industry filter with weighted score:
  Skills 35 / Title 30 / Function 20 / Location 10 / Industry 5.
- Add `industryMode: 'strict' | 'preferred' | 'open'` (default `open`).
- Tag candidates from adjacent industries as **"Transferable Industry"** badge.
- Remove industry-based exclusion from provider filters when mode = `open`.

## Phase 2 — LinkedIn URL Hardening
**Files:** `src/lib/discovery.ts` (new helper `normalizeLinkedInUrl`), result/profile components.

- Normalize to `https://www.linkedin.com/in/<slug>` on ingest + render.
- Reject relative paths, `linkedin.com/pub/...` redirects, and tracking params.
- All links: `target="_blank" rel="noopener noreferrer"`.
- Hide LinkedIn badge when URL invalid/missing (no "Refused to connect").

## Phase 3 — Open Web Discovery: Multi-pass + Pagination
**Files:** `supabase/functions/ai-candidate-search/index.ts` (`searchOpenWeb`).

- Generate 10–15 boolean variations from JD (role synonyms × location × skill clusters).
- Run passes in parallel batches (5 at a time), dedupe by normalized LinkedIn URL.
- Re-rank merged pool with existing scorer; return Top 50.
- Add `page` param → returns next 50 (cursor on rank position).
- Cache pass results in `discovery_synonym_cache` keyed by JD hash for 24h.

## Phase 4 — Location Hierarchy + Auto-broaden
**Files:** `src/lib/discovery.ts`, `src/components/discovery/LocationPicker.tsx`, search edge function.

- Add `locationHierarchy` map (city → metro → state → country) covering top markets (US, UK, UAE, KSA, SG, IN, DE, CH, CA, AU, BD).
- If strict city search yields < 10 results, auto-retry at metro, then state, then country; tag widened results with "Broadened location".

## Phase 5 — LinkedIn → AI Resume + Save-to-CRM dedupe
**Files:** new edge function `supabase/functions/generate-ai-resume/index.ts`, `src/pages/AICandidateResultsPage.tsx` Save handler, migration for `candidates.ai_resume_url`, `candidates.resume_source` (`'ai' | 'uploaded'`), `candidates.use_uploaded_as_primary` (bool, default true).

- On Save-to-CRM:
  1. Lookup existing candidate by `linkedin_url` OR `email` (case-insensitive, normalized).
  2. If found → UPDATE (merge skills/experience, keep existing CV).
  3. Else → INSERT with structured profile + generated AI resume PDF stored in `candidate-resumes` bucket.
- Setting "Use Uploaded Resume As Primary" (default ON) controls which renders in profile.

## Phase 6 — Friendly Errors + Auto-fallback + Boolean Engine
**Files:** `src/lib/discoveryErrors.ts` (already exists, extend), search edge function, results page.

- Map all provider errors to recruiter copy: "Lusha temporarily unavailable", "Apollo credits exhausted", etc.
- Raw payloads only visible when `role IN ('owner','super_admin')` AND `?dev=1` query flag.
- When all paid providers fail/empty → automatically run Open Web Discovery (no user click).
- Boolean engine: AI generates 5–10 variations per search; merge + dedupe + rank.

## Phase 7 — Client Discovery AI (BD Agent)
**Files:** new edge function `supabase/functions/ai-client-discovery/index.ts`, new page `src/pages/AIClientDiscoveryPage.tsx`, route in `App.tsx`, migration for `clients.linkedin_company_url`, `clients.employee_count`, `clients.bd_potential` (`high|medium|low`).

- Input: target industry, country, employee range, hiring-signal keywords.
- Apollo first; on failure → Open Web Discovery (company sites + LinkedIn company pages).
- Returns company + decision makers (CEO, Founder, MD, TA Manager, HR, Recruitment Manager) with LinkedIn URLs.
- Score each company High/Medium/Low based on growth + hiring signals.
- Save-to-CRM dedupe by domain OR LinkedIn company URL.

---

## Technical notes
- **Migrations** (Phase 5 + 7): additive columns + one storage bucket `candidate-resumes` (private, RLS by tenant). No drops.
- **No new env secrets needed** — reuses existing `OPENAI_API_KEY`, Apollo/Lusha/Vibe keys, `LOVABLE_API_KEY` (if you want me to switch Open Web to Lovable AI Gateway, say so; current code uses OpenAI direct).
- **Performance:** parallel passes capped at 5 concurrent; total Open Web budget ~15 calls per search to control cost.
- **Backward compatible:** existing saved candidates unaffected; new fields nullable.

---

## Verification per phase
1. Run a Commodity Trading search → expect Banking/Shipping results tagged "Transferable Industry".
2. Click any LinkedIn badge → opens real profile in new tab, no "Refused to connect".
3. Open Web search returns 30–50 candidates from one JD.
4. Search "San Francisco" with no hits auto-broadens to Bay Area / California.
5. Save same candidate twice → second click updates, no duplicate row.
6. Disconnect Apollo → search still returns results via Open Web with no user prompt.
7. Client Discovery returns 10+ companies + decision makers for "SaaS, UAE, 50–200 employees".

Reply **go** to start Phase 1, or tell me which phases to reorder/skip.
