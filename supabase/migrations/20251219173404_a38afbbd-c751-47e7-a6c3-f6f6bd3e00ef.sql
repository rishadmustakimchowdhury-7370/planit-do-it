-- Add BOD and EOD summary fields to work_sessions table
ALTER TABLE work_sessions 
ADD COLUMN IF NOT EXISTS bod_summary text,
ADD COLUMN IF NOT EXISTS eod_summary text;

COMMENT ON COLUMN work_sessions.bod_summary IS 'Beginning of Day summary entered by team member';
COMMENT ON COLUMN work_sessions.eod_summary IS 'End of Day summary entered by team member';

-- Update the pending invitation to accepted for mustakimchy21@gmail.com
UPDATE team_invitations
SET status = 'accepted',
    accepted_at = now()
WHERE email = 'mustakimchy21@gmail.com'
  AND status = 'pending';