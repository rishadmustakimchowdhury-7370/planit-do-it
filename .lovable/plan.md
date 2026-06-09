
# Phases 8–11 — Submission Pack Preview, Quality, History, Client-Ready Workflow

Goal: close the loop so recruiters can preview, polish, download, send, and revisit every generated pack — without leaving HireMetrics.

## 1. Submission Pack Preview (Phase 8)

After `build-submission-pack` completes, open a new **Submission Pack Preview** screen that renders the PDF inline.

- New component: `src/components/clients/SubmissionPackPreview.tsx`
  - Embeds the generated PDF via signed-URL `<iframe>` (browser PDF viewer = native page-through, zoom, search).
  - Mode tabs: **AI Report Only (A)** · **Original CV + Report (B)** · **Branded CV + Report (C)** — each tab loads the latest pack of that option (builds on demand if missing).
  - Header chips: pack option, version, file size, created-at, recruiter.
  - Action bar:
    1. **Edit Report** — scrolls to `ClientReportSection` and focuses edit mode.
    2. **Regenerate Report** — triggers `generate-client-report` (new version).
    3. **Regenerate Pack** — re-runs `build-submission-pack` for the active option.
    4. **Download PDF** — signed URL download.
    5. **Send To Client** — scrolls to `ClientDeliveryWorkspace` with the previewed file pre-attached.
- Auto-opens after a successful build in `SubmissionPackBuilder`; also opens when clicking a row in history.

## 2. PDF Quality Hardening (Phase 9)

Refactor `supabase/functions/build-submission-pack/index.ts` to enforce client-ready quality:

- **Layout system**: A4, uniform 56pt margins, `drawWrappedText` helper with measured line breaks (no overflow).
- **Typography**: Helvetica family throughout, hierarchical sizes (Title 22 / H2 14 / Body 10.5 / Caption 8.5) with consistent leading.
- **Cover (Option C)**: agency logo top-left (signed URL → embedded), candidate name, role, client, date; bottom band uses agency primary color.
- **Header on every page**: small agency logo + candidate name — role.
- **Footer on every page**: `Confidential` (configurable), agency name, `Page X of Y`.
- **Optional watermark**: diagonal `CONFIDENTIAL` text at low opacity, toggleable per build (default off, on via UI checkbox).
- **Page-break safety**: section helper that measures remaining vertical space and inserts a new page before drawing; never split a heading from its first paragraph.
- **CV merge**: re-stamp imported CV pages with the same footer/page-number band so numbering is continuous across merged docs.

UI toggle for watermark added to `SubmissionPackBuilder` and forwarded as `{ watermark: boolean }` to the edge function.

## 3. Submission History (Phase 10)

Promote the existing history list to a first-class table:

- New component: `src/components/clients/SubmissionHistoryTable.tsx`
  - Columns: **Version**, **Option**, **Candidate**, **Job**, **Client**, **Created By**, **Created Date**, **Actions**.
  - Data source: `client_submission_pack_files` joined with `client_submission_reports.version`, `profiles.full_name`, `candidates.full_name`, `jobs.title`, `clients.name`.
  - Row actions (no regeneration required):
    - **Open** → loads file into `SubmissionPackPreview`.
    - **Download** → signed URL.
    - **Re-send** → opens `ClientDeliveryWorkspace` with the historical file pre-attached and prior recipient pre-filled (from latest `client_emails` row referencing the same `submission_pack_file_id`).
- DB migration: add `created_by uuid` to `client_submission_pack_files` (default `auth.uid()`), backfill from `client_submission_reports.created_by`. Grants/RLS preserved.

## 4. Client-Ready Workflow (Phase 11)

Restructure `PrepareForClientDialog` into an explicit linear stepper so the end-state flow is visible to recruiters:

```text
1. Candidate & Job   (auto)
2. Recruiter Notes   (text + voice)
3. AI Report         (generate / edit / approve)
4. Report Preview    (read-only render of approved report)
5. Submission Pack   (A / B / C + watermark)
6. Pack Preview      (inline PDF, full review)
7. Send To Client    (delivery workspace)
8. History           (all versions, re-open / re-send)
```

- Stepper at the top of the dialog with completion state per step (derived from existing data: notes saved, report approved, pack exists, email sent).
- Each step collapses into a card; clicking a step jumps to the section.
- "Send To Client" is gated until a pack exists; "Pack Preview" is gated until a pack is built; matches the existing approval gate on the report.

## Files

**New**
- `src/components/clients/SubmissionPackPreview.tsx`
- `src/components/clients/SubmissionHistoryTable.tsx`
- `src/components/clients/PrepareForClientStepper.tsx`
- `supabase/migrations/<ts>_pack_files_created_by.sql`

**Edited**
- `supabase/functions/build-submission-pack/index.ts` — quality rewrite + watermark + page numbers across merged docs
- `src/components/clients/SubmissionPackBuilder.tsx` — watermark toggle, auto-open preview, hand-off to history
- `src/components/clients/PrepareForClientDialog.tsx` — stepper + section gating + wiring of preview / history / delivery hand-offs
- `src/components/clients/ClientDeliveryWorkspace.tsx` — accept a `prefillAttachmentId` prop for re-send

## Out of scope (explicit)

- Email delivery itself (already in Phase 5).
- AI report generation logic (already in Phase 3).
- Mobile-specific PDF viewer (browser default is sufficient for now).

Approve and I'll implement all four phases in one pass.
