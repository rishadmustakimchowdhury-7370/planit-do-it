# AI Candidate Rediscovery System — 7-Phase Plan

A natural, intelligent layer inside the Jobs workflow that automatically surfaces previously uploaded candidates matching a new role — using OpenAI embeddings + GPT reasoning. Lives inside **Jobs → Candidate Pipeline → Rediscovered Talent** (no separate AI page).

---

## Phase 1 — Database & Embeddings Foundation

Create the storage layer for semantic search.

- Enable `pgvector` extension.
- New table `candidate_embeddings` (tenant-scoped, RLS):
  - `candidate_id`, `tenant_id`, `embedding vector(1536)`, `source_text` (compacted CV + skills + title + summary), `model_version`, `updated_at`.
  - HNSW index on `embedding`.
- New table `job_embeddings` (tenant-scoped, RLS):
  - `job_id`, `tenant_id`, `embedding vector(1536)`, `source_text`, `model_version`.
- New table `rediscovered_matches` to cache scored matches per job (so we don't re-run AI on every visit):
  - `job_id`, `candidate_id`, `tenant_id`, `match_score` (0–100), `ai_summary`, `strengths jsonb`, `gaps jsonb`, `confidence` (low/med/high), `insights jsonb` (badges like "previously shortlisted"), `created_at`.
  - Unique `(job_id, candidate_id)`.
- New table `rediscovery_runs` for audit/history:
  - `job_id`, `tenant_id`, `triggered_by`, `candidates_scanned`, `matches_found`, `credits_used`, `status`, `error`, timestamps.
- Strict RLS: `tenant_id = get_user_tenant_id(auth.uid())` on all four; super admin override.

Uses model `text-embedding-3-small` (1536 dims) — cheap, fast, ideal for thousands of CVs.

---

## Phase 2 — Embedding Pipeline (Edge Functions)

Two background-style functions that keep embeddings fresh:

**`embed-candidate`** — called when a candidate is created/updated or CV is (re)parsed.
- Builds `source_text` = `title + summary + skills + experience_years + location + key bullets from CV`.
- Calls OpenAI `text-embedding-3-small`.
- Upserts into `candidate_embeddings`.
- Deducts AI credits via existing `deduct_user_ai_credits`.

**`embed-job`** — called when a job is created/updated.
- Builds `source_text` = `title + description + required skills + seniority + location + industry`.
- Embeds and upserts into `job_embeddings`.

Backfill: a one-shot admin RPC `backfill_candidate_embeddings(tenant_id)` that returns ids without embeddings, so a Super Admin / Owner can warm the index for existing candidates with a single click.

---

## Phase 3 — Rediscovery Engine

**Edge function `rediscover-candidates`** — the core feature.

Input: `{ job_id }`. Validates auth.uid, tenant ownership of job, AI credits available.

Pipeline:
1. Ensure job embedding exists (trigger `embed-job` if missing).
2. Run pgvector top-K nearest neighbor on `candidate_embeddings` scoped to tenant (`limit 25`, cosine distance).
3. For the top 10 candidates, hand short candidate + job summaries to GPT-4o-mini in **one** batched tool-calling request that returns structured JSON per candidate:
   - `match_score` (0–100), `summary` (2 sentences), `strengths[]`, `gaps[]`, `confidence`, `insights[]` (uses existing data: "Previously submitted to {client}", "Last active {date}", "Shortlisted for {similar role}").
4. Combine semantic similarity (60%) + GPT score (40%) into final `match_score`.
5. Upsert into `rediscovered_matches`; insert `rediscovery_runs` row.
6. Return matches.

Caching rule: if a fresh run (`< 24h`) exists for the job and no candidate changes since, return cached rows.

Triggers:
- Auto on job create (fire-and-forget after insert).
- Manual "Re-scan" button on the section.

---

## Phase 4 — UI Integration (Job Detail Page)

New section **"Rediscovered Talent"** inside `JobDetailPage`, sitting above the existing pipeline, collapsible.

- Header row: title + AI sparkle badge + scan count + "Re-scan" + last run timestamp.
- Filter bar: match %, location, experience, notice period, recruiter owner, activity status.
- Card grid (responsive 1/2/3 cols):
  - Match % ring (colored: ≥85 green, 70–84 amber, <70 muted).
  - Candidate name, title, location, notice period, last activity date, recruiter owner.
  - 2-line AI summary.
  - Chips: strengths (green) + gaps (amber).
  - Insight badges (subtle pill style): "Previously shortlisted", "Recently active", "Likely open".
  - Quick actions: Shortlist, Add to pipeline, AI outreach, Schedule interview, Notes, Assign recruiter.
- Bulk selection bar (sticky) when ≥1 selected: Bulk add to pipeline, Bulk AI outreach.
- Empty state: "Embeddings warming up — first scan in progress" with spinner.
- Loading: skeleton cards.
- No matches: "No strong matches yet. Upload more candidates or broaden the JD."

Subtle AI cues: small gradient "AI" pill, soft glow on top-3 cards, no over-the-top animations.

---

## Phase 5 — Outreach Integration

Reuse existing email system (no parallel stack).

- "AI Outreach" on a card opens existing `SendCandidateEmailModal` pre-filled with an AI-generated message via the existing `ai-compose-email` edge function, passing the job context + match reasoning so the message references *why* they're a fit.
- Bulk outreach → loops candidates, calls `ai-compose-email` per candidate (personalized), opens a review/send step before dispatching (no silent mass send).
- All sends logged in `candidate_emails` exactly like normal, so analytics and pipeline status update for free.

---

## Phase 6 — Pipeline & Workflow Hooks

Tight integration with the existing recruitment workflow:

- "Add to Pipeline" reuses `AddCandidateToJobDialog`, defaults stage to "Sourced".
- "Schedule Interview" reuses the existing Events module with candidate + job pre-filled.
- Every action logs to `recruiter_activities` (existing KPI source — counts toward sourcing/outreach KPIs).
- Auto re-embed candidate on status change so future scans pick up updates.
- Auto re-embed job on edit.

---

## Phase 7 — Smart Insights, Polish & Safeguards

- Insight generators (deterministic, no AI cost):
  - "Previously submitted to similar client" — from `candidate_emails` + `jobs.client_id` history.
  - "Recently active" — `updated_at` within 30 days.
  - "Previously shortlisted for similar role" — joins past pipeline rows on title similarity.
  - "Available now" — based on notice period field.
- Permissions: only roles with `can_use_ai_match` see the section (existing permission).
- Subscription guard: respects existing `useUsageLimits` (AI credits per plan).
- Rate limiting on `rediscover-candidates` (1 run / job / 5 min).
- Surface 429/402 from OpenAI as friendly toasts.
- Performance: top-K = 25 candidates per scan to control cost; tunable via env.
- QA pass: empty tenant, zero candidates, missing embeddings, expired credits, no permission.

---

## Technical Notes (skip if non-technical)

- Embeddings: OpenAI `text-embedding-3-small`, 1536 dims, cost ~$0.02 / 1M tokens.
- Reasoning: `gpt-4o-mini` with tool-calling for structured output.
- pgvector HNSW index: `vector_cosine_ops`, `m=16`, `ef_construction=64`.
- All AI calls go through edge functions (`OPENAI_API_KEY` already in secrets — memory says project uses OpenAI directly, not Lovable AI Gateway).
- RLS uses existing `get_user_tenant_id()` + `is_super_admin()` helpers (already audited).
- New tables tenant-scoped — slot directly into the storage tenant-isolation fix from the previous turn.

---

## Deliverables

1. Migration: pgvector + 4 new tables + RLS + HNSW index + backfill RPC.
2. Edge functions: `embed-candidate`, `embed-job`, `rediscover-candidates`.
3. UI: `RediscoveredTalent` section + `RediscoveredCandidateCard` + filter bar + bulk action bar, mounted in `JobDetailPage`.
4. Hooks: `useRediscoveredCandidates(jobId)` (with realtime invalidation), `useRediscoveryScan(jobId)`.
5. Triggers: auto-embed on candidate/job mutate, auto-scan on job create.
6. Memory entry documenting the system so future sessions stay consistent.

Once you approve, I'll execute phases 1–7 in order: migration first (your approval needed for that), then edge functions, then UI.