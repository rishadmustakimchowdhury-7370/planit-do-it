# Prospecting Sandbox — Implementation Plan

A self-contained Demo Mode for Prospect Search that lets a salesperson run the full BD workflow (search → save → assign → pipeline → notes → export) without an Apollo paid plan.

## Phase 1 — Demo Data Library

Expand `src/lib/apolloDemoData.ts` into four curated datasets (20 records each, ~80 total):

- `recruitment_uk` — UK recruitment agencies
- `technology_us` — US SaaS / tech companies
- `commodities` — Commodity & trading firms (UAE, Singapore, CH, UK)
- `healthcare` — Healthcare providers / medtech
- (bonus) `staffing_uae` — folded into Recruitment tab as a sub-region

Each record fields:
```
id, name, logo_url (initials avatar fallback via UI Avatars),
website_url, linkedin_url, industry, employee_count, country, city,
revenue_range, short_description,
contact: { first_name, last_name, full_name, title, email, phone, linkedin_url },
match_score (60–98), is_demo: true, dataset
```

`generateDemoCompanies(dataset)` returns the relevant slice. Logos use deterministic Apollo-style avatars: `https://ui-avatars.com/api/?name=...&background=...&color=fff&bold=true`.

## Phase 2 — Page Layout

Replace the current demo result block with a tabbed sandbox. Visible whenever `result.isDemo` OR free plan demo entry point is used.

```text
[Tabs: Recruitment | Technology | Commodities | Healthcare]
[Toolbar: Select All | Bulk Save | Bulk Assign | Export CSV | DEMO badge]
[Workflow stepper: Search → Save → Assign → Pipeline → Notes → Export]
[Grid: 12 columns, sticky header]
```

Switching tabs reloads that dataset, clears selection, keeps `isDemo`.

## Phase 3 — Results Grid

New table with the requested 12 columns (Company, Contact, Title, Industry, Country, Employees, Revenue, Website, LinkedIn, Email, Phone, Match Score) plus checkbox + actions column. Logo shown beside company name. Match Score rendered as a colored pill (green ≥85, amber 70–84, gray <70).

Row actions (icon buttons):
- Save to CRM (uses existing `save-leads` edge function, mode=`lead` with company+contact)
- Assign Recruiter (opens small popover with team list)
- Add Note (opens dialog → writes to `lead_activities` after save, else stages locally)
- View Company (opens drawer)

## Phase 4 — Company Drawer

`<CompanyDetailDrawer>` (Sheet) opened on row click or View action:
- Header: logo, name, DEMO badge, website + LinkedIn buttons
- Profile section: industry, country/city, employees, revenue, short_description
- Primary contact: name, title, email, phone, LinkedIn
- Notes: textarea (stored to local component state; persisted to `lead_activities` when company is saved)
- Activity timeline: synthesized demo events (Apollo enriched, Added to pipeline, Note logged) + any real events once saved

## Phase 5 — Bulk Actions

Toolbar above grid:
- Select All toggles current tab's rows
- Bulk Save: loops through selected, calls `save-leads` with `mode=lead` so it creates both company + contact, tagging `source: 'apollo_demo'`
- Bulk Assign: dialog with recruiter dropdown → after save, updates `lead_contacts.assigned_to`
- Export CSV: builds a real CSV blob from selected (or all) and triggers download via `Blob` + `URL.createObjectURL`

Toast summarises results (saved / duplicates / failed).

## Phase 6 — CRM / Pipeline / BD Integration

Saved records flow into existing tables, so they appear everywhere automatically:
- `lead_companies` → CRM Companies & Business Development Dashboard
- `lead_contacts` (linked to company) → Prospect Pipeline
- `lead_activities` with `activity_type='note'` for any notes
- `lead_activities` with `activity_type='assignment'` for recruiter assignment

No schema changes required — existing tables already support these flows. `source='apollo_demo'` and `is_demo=true` (where column exists) flag them for filtering. If `is_demo` isn't on `lead_companies`, we set `source='apollo_demo'` only; tagging is sufficient for demo cleanup.

## Phase 7 — Workflow Helper + Polish

- Workflow stepper component shows 6 steps with check marks as the user progresses in the session (Save flips step 2, Assign flips step 3, drag to pipeline flips 4, etc.).
- `DEMO DATA` badge on every row, drawer header, and CSV filename prefix.
- Empty state for each tab if dataset somehow empty.
- Keep existing real Apollo search path untouched — sandbox only activates via "Load Sample Apollo Results" or when on Free plan.

## Technical Notes

- New files: `src/lib/apolloDemoData.ts` (expanded), `src/components/leads/ProspectSandbox.tsx`, `src/components/leads/CompanyDetailDrawer.tsx`, `src/components/leads/AssignRecruiterPopover.tsx`, `src/components/leads/DemoWorkflowStepper.tsx`.
- `ProspectSearchPage` mounts `<ProspectSandbox />` when `demoActive` state is on (set by Load Sample button; auto-on for free plan).
- Recruiter list fetched once via `profiles` join `user_roles` where role in (owner,manager,recruiter) and tenant matches.
- CSV export: client-side, columns mirror the grid, filename `apollo-demo-{tab}-{YYYY-MM-DD}.csv`.
- No edge function changes — reuses `save-leads`.
- No DB migrations — uses existing `lead_companies`, `lead_contacts`, `lead_activities` schemas.

## Out of Scope

- Editing demo records inline
- Persisting unsaved notes across page refresh
- Real Apollo logo URLs (we use deterministic avatar service)
