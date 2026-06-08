-- 1. Drop failed rows that already have an open (pending/in_progress) counterpart
DELETE FROM public.validation_queue f
WHERE f.status='failed'
  AND EXISTS (
    SELECT 1 FROM public.validation_queue p
    WHERE p.job_id=f.job_id AND p.candidate_id=f.candidate_id
      AND p.status IN ('pending','in_progress')
  );
-- 2. Among remaining failed rows, keep only one per (job, candidate)
DELETE FROM public.validation_queue f
USING public.validation_queue g
WHERE f.status='failed' AND g.status='failed'
  AND f.job_id=g.job_id AND f.candidate_id=g.candidate_id
  AND f.id > g.id;
-- 3. Reset remaining failed rows to pending
UPDATE public.validation_queue
SET status='pending', attempts=0, last_error=null, started_at=null, processed_at=null
WHERE status='failed';