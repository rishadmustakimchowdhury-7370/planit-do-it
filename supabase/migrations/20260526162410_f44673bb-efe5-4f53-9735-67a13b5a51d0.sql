ALTER TABLE public.candidate_submissions
  ADD COLUMN IF NOT EXISTS structured_notes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.candidate_submissions.structured_notes IS
  'Structured recruiter screening notes: notice_period, current_salary, salary_expectation, relocation, visa_status, availability, communication_quality, client_facing_ability, interview_feedback, other_notes[].';