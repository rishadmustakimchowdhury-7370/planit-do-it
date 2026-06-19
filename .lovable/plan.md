# Candidate Discovery — Production Quality Upgrade

This is a large, multi-area change (search engine, UI, CRM, AI resume, RBAC debug mode). I'll split it into 7 phases so each can be reviewed and tested independently. Please confirm scope, or tell me which phases to ship first.

## Phase 1 — Search Orchestrator (backend)
Refactor `ai-candidate-search` into a clear pipeline:
- `analyzeJD()` — extract title, alt titles, industry, skills, languages, seniority, location (city/state/country)
- `buildSearchPasses(mode)` — generates 4–6 Boolean passes from the analysis; `mode ∈ strict | balanced | broad` controls how many ORs / how aggressively we relax
- `expandLocations(city)` — city → metro → state → country hierarchy (e.g. San Francisco → Bay Area → California → US)
- `runPass(pass)` — fans out to all connected sources in parallel
- Returns `{ candidates, passDiagnostics }`

## Phase 2 — Source adapters
One file per source, uniform interface `search(pass) → { candidates, returned, accepted, rejected, error? }`:
- `sources/lusha.ts` — native filter mapping (titles, locations{city,state,country}, industries, seniorities); validate `contacts.include` is non-empty; never send DNC fields; per-pass call
- `sources/vibe.ts` — soft-fail on 402/403/network; never aborts the orchestrator
- `sources/internalCrm.ts` — query existing `candidates` table with ILIKE on title/skills/location
- `sources/apollo.ts` — stub for future
Merge + dedupe by normalized email → LinkedIn URL → lowercased full name.

## Phase 3 — Matching & ranking
- Configurable weight vector (industry, location, language, skills, seniority, company, years)
- Per-candidate score 0–100 with matched/missing arrays
- Drop everything < 60%; never show 0% rows
- Return `{ score, matched: string[], missing: string[] }` for UI

## Phase 4 — Results UI cleanup
`AICandidateResultsPage.tsx`:
- Recruiter view: live progress ("Pass 2 completed"), score circle, ✓ matched / ✗ missing chips, LinkedIn button with `target="_blank" rel="noopener noreferrer"`, source badge, action buttons
- Hide all JSON / payloads / pass analytics behind a Developer Mode toggle gated by `has_role(uid, 'owner')`
- Search Mode selector: Strict / Balanced / Broad (default Balanced)

## Phase 5 — Save to CRM
"Save to CRM" button on each result card calls a new edge function `discovery-save-candidate` that upserts into `candidates` with: name, current_title, current_company, location, email, phone, linkedin_url, source, skills[], experience, languages[]. Dedupe on (tenant_id, email) and (tenant_id, linkedin_url).

## Phase 6 — AI Resume Generator
- New edge function `generate-ai-resume`: takes candidate profile → OpenAI → returns structured resume → render PDF via existing branded PDF pipeline → upload to candidate's storage bucket → store `cv_url` with flag `is_ai_generated = true`
- On real CV upload to a candidate that already has an AI resume, show dialog: "Replace AI Resume? [Replace] [Keep Both]"

## Phase 7 — Owner Debug Mode
- Add `discovery_debug_mode` to user preferences (owner-only toggle in Settings)
- When on: results page renders the existing diagnostic panels (boolean queries, per-pass returned/accepted/rejected, raw Lusha/Vibe payloads & responses)
- When off (default for everyone, and forced off for non-owners): completely hidden

## Technical notes
- No schema changes needed for phases 1–4. Phase 5 reuses `candidates`. Phase 6 needs a `candidates.is_ai_generated_cv boolean default false` column (one small migration).
- All AI calls continue to use OpenAI per project memory (no Lovable AI Gateway).
- Edge functions affected: `ai-candidate-search` (rewrite), `discovery-save-candidate` (new), `generate-ai-resume` (new).
- Frontend files: `AICandidateResultsPage.tsx`, new `SearchModeSelector`, new `MatchExplanation`, new `DeveloperModePanel`, `useOwnerRole` gate.

## Questions before I start
1. Ship all 7 phases in one go, or start with Phases 1–4 (the actual search quality fixes) and do CRM save / AI resume / debug mode after?
2. Search Mode default — Balanced OK?
3. AI Resume PDF — reuse the existing branded PDF template used for client submissions, or a new minimal layout?
