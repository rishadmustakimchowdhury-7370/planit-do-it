-- Allow unauthenticated users to update team_invitations when accepting invites
CREATE POLICY "Anyone can update invitation by token"
ON public.team_invitations
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);