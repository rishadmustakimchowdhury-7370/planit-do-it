-- Reset the invitation for mustakimchy21@gmail.com back to pending
-- The user needs to properly complete signup which will create their auth account
UPDATE team_invitations
SET status = 'pending',
    accepted_at = NULL
WHERE email = 'mustakimchy21@gmail.com';