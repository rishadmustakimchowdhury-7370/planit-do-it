import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { CandidateCollaborationPanel } from '@/components/clients/CandidateCollaborationPanel';
import { InterviewRequestsInbox } from '@/components/clients/InterviewRequestsInbox';
import { PublicShareDialog } from '@/components/clients/PublicShareDialog';
import { Building2, Link2, Eye } from 'lucide-react';

interface Props {
  candidateId: string;
}

type Share = {
  id: string;
  job_candidate_id: string;
  client_org_id: string;
  public_share_token: string | null;
  public_share_expires_at: string | null;
  public_share_view_count: number | null;
  client_organizations: { name: string } | null;
  job_candidates: { job_id: string; tenant_id: string; jobs: { title: string } | null } | null;
};

export function InternalCollaborationTab({ candidateId }: Props) {
  const [shares, setShares] = useState<Share[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const jcIds = (await supabase.from('job_candidates').select('id').eq('candidate_id', candidateId)).data?.map(r => r.id) || [];
    const { data } = await supabase
      .from('candidate_client_shares')
      .select(`
        id, job_candidate_id, client_org_id,
        public_share_token, public_share_expires_at, public_share_view_count,
        client_organizations:client_org_id (name),
        job_candidates:job_candidate_id ( job_id, tenant_id, jobs:job_id (title) )
      ` as any)
      .eq('status', 'shared')
      .in('job_candidate_id', jcIds.length ? jcIds : ['00000000-0000-0000-0000-000000000000']);
    const rows = (data as any as Share[]) || [];
    setShares(rows);
    if (rows.length && !selectedId) setSelectedId(rows[0].id);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [candidateId]);

  if (loading) return <Skeleton className="h-40 w-full" />;

  if (!shares.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">This candidate hasn't been shared with any client yet.</p>
        <p className="text-xs mt-1">Open the job and use "Share with Client" to start a collaboration thread.</p>
      </div>
    );
  }

  const selected = shares.find(s => s.id === selectedId) || shares[0];
  const tenantId = selected.job_candidates?.tenant_id;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Client</span>
        <Select value={selected.id} onValueChange={setSelectedId}>
          <SelectTrigger className="w-[320px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {shares.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.client_organizations?.name || 'Client'} · {s.job_candidates?.jobs?.title || 'Job'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setShareDialogOpen(true)}>
          <Link2 className="h-3.5 w-3.5 mr-2" />
          {selected.public_share_token ? 'Manage public link' : 'Public share link'}
        </Button>
        {selected.public_share_token && (selected.public_share_view_count || 0) > 0 && (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Eye className="h-3 w-3" /> {selected.public_share_view_count} view{selected.public_share_view_count === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {tenantId && (
        <CandidateCollaborationPanel
          jobCandidateId={selected.job_candidate_id}
          clientOrgId={selected.client_org_id}
          tenantId={tenantId}
          authorType="internal"
        />
      )}

      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Interview Requests
        </div>
        <InterviewRequestsInbox jobCandidateId={selected.job_candidate_id} />
      </div>

      <PublicShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        shareId={selected.id}
        existingToken={selected.public_share_token}
        existingExpiresAt={selected.public_share_expires_at}
        onUpdated={load}
      />
    </div>
  );
}
