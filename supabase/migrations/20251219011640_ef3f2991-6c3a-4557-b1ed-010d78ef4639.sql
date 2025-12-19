-- Allow unauthenticated users to read invitation by token (for accepting invitations)
CREATE POLICY "Anyone can view invitation by token"
ON public.team_invitations
FOR SELECT
USING (true);

-- Drop the old restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view invitations in their tenant" ON public.team_invitations;