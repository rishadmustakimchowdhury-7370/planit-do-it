import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Inbox, Eye, MessageSquare, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { SubmissionStatusBadge, type SubmissionStatus, SUBMISSION_STATUS_META, PIPELINE_STAGES } from "./SubmissionStatusBadge";
import { SubmissionDetailDialog } from "./SubmissionDetailDialog";
import { PrepareForClientDialog } from "./PrepareForClientDialog";

interface Props {
  tenantId: string;
  jobId: string;
  jobTitle: string;
  candidates?: Array<{ candidate_id: string; full_name: string; current_title?: string | null }>;
}

export function JobSubmissionsTab({ tenantId, jobId, jobTitle, candidates = [] }: Props) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedCandidate, setPickedCandidate] = useState<{ id: string; name: string } | null>(null);
  const [allCandidates, setAllCandidates] = useState<Array<{ id: string; full_name: string; current_title: string | null }>>([]);
  const [pickerQuery, setPickerQuery] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("candidate_submissions")
      .select(`
        id, status, submitted_at, last_activity_at, submission_message, candidate_id, client_org_id,
        candidate:candidate_id ( id, full_name, current_title ),
        client_org:client_org_id ( id, name )
      `)
      .eq("job_id", jobId)
      .order("last_activity_at", { ascending: false });
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, [jobId]);

  // Load all tenant candidates so users can submit candidates not yet in this job's pipeline
  useEffect(() => {
    if (!tenantId) return;
    (async () => {
      const { data } = await supabase
        .from("candidates")
        .select("id, full_name, current_title")
        .eq("tenant_id", tenantId)
        .order("full_name", { ascending: true })
        .limit(500);
      setAllCandidates(data ?? []);
    })();
  }, [tenantId]);
  useEffect(() => {
    const ch = supabase.channel(`job-subs-${jobId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "candidate_submissions", filter: `job_id=eq.${jobId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [jobId]);

  const stageCounts = useMemo(() => {
    const c: Record<string, number> = {};
    (rows ?? []).forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const openWizardFor = (candidateId: string, name: string) => {
    setPickedCandidate({ id: candidateId, name });
    setPickerOpen(false);
    setWizardOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Pipeline overview */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">Client Submission Pipeline</h3>
            <p className="text-xs text-muted-foreground">Track candidates from submitted → hired across all client contacts.</p>
          </div>
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Submit Candidate
          </Button>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {PIPELINE_STAGES.map(stage => (
            <div key={stage} className="rounded-lg border bg-background p-2.5">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{SUBMISSION_STATUS_META[stage].label}</div>
              <div className="text-xl font-semibold mt-1">{stageCounts[stage] ?? 0}</div>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      {rows === null ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No submissions yet</p>
              <p className="text-sm text-muted-foreground">Submit a candidate from your pipeline to start collaborating with the client.</p>
            </div>
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Submit a Candidate
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r: any) => {
            const c = r.candidate;
            const initials = (c?.full_name || "?").split(" ").map((p: string) => p[0]).slice(0,2).join("").toUpperCase();
            return (
              <Card key={r.id} className="cursor-pointer hover:border-primary/40 transition-all" onClick={() => setOpenId(r.id)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c?.full_name}</span>
                      <span className="text-xs text-muted-foreground truncate">· {c?.current_title}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                      To: <span className="font-medium text-foreground/80">{r.client_org?.name}</span>
                      {" · "}Updated {formatDistanceToNow(new Date(r.last_activity_at), { addSuffix: true })}
                    </div>
                  </div>
                  <SubmissionStatusBadge status={r.status as SubmissionStatus} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Candidate picker for new submission */}
      {pickerOpen && (() => {
        const pipelineIds = new Set(candidates.map(c => c.candidate_id));
        const q = pickerQuery.trim().toLowerCase();
        const matches = (name: string, title?: string | null) =>
          !q || name.toLowerCase().includes(q) || (title ?? "").toLowerCase().includes(q);
        const pipelineList = candidates.filter(c => matches(c.full_name, c.current_title));
        const otherList = allCandidates
          .filter(c => !pipelineIds.has(c.id))
          .filter(c => matches(c.full_name, c.current_title));
        return (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setPickerOpen(false)}>
            <Card className="max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <CardContent className="p-5 space-y-3">
                <div>
                  <h4 className="font-semibold">Pick a candidate to submit</h4>
                  <p className="text-xs text-muted-foreground">Choose from this job's pipeline or any other candidate in your database.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search by name or title…"
                    className="pl-8 h-9"
                  />
                </div>
                <div className="max-h-80 overflow-y-auto space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 mb-1">
                      In this job's pipeline ({pipelineList.length})
                    </div>
                    {pipelineList.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1 py-2">No matches.</p>
                    ) : pipelineList.map(c => (
                      <button key={c.candidate_id} onClick={() => openWizardFor(c.candidate_id, c.full_name)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex flex-col">
                        <span className="font-medium">{c.full_name}</span>
                        {c.current_title && <span className="text-xs text-muted-foreground">{c.current_title}</span>}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1 mb-1">
                      Other candidates ({otherList.length})
                    </div>
                    {otherList.length === 0 ? (
                      <p className="text-xs text-muted-foreground px-1 py-2">No matches.</p>
                    ) : otherList.slice(0, 100).map(c => (
                      <button key={c.id} onClick={() => openWizardFor(c.id, c.full_name)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex flex-col">
                        <span className="font-medium">{c.full_name}</span>
                        {c.current_title && <span className="text-xs text-muted-foreground">{c.current_title}</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full" onClick={() => setPickerOpen(false)}>Cancel</Button>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {pickedCandidate && (
        <SubmissionWizard
          open={wizardOpen}
          onOpenChange={(v) => { setWizardOpen(v); if (!v) setPickedCandidate(null); }}
          tenantId={tenantId}
          jobId={jobId}
          candidateId={pickedCandidate.id}
          candidateName={pickedCandidate.name}
          jobTitle={jobTitle}
          onCompleted={() => load()}
        />
      )}

      <SubmissionDetailDialog
        submissionId={openId}
        open={!!openId}
        onOpenChange={(v) => !v && setOpenId(null)}
      />
    </div>
  );
}
