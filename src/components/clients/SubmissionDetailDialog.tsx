import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Send, ExternalLink, Sparkles, FileText, Users, Activity, RefreshCw } from "lucide-react";
import { AIValidationCard } from "@/components/clients/AIValidationCard";
import { SubmissionStatusBadge, SUBMISSION_STATUS_META, type SubmissionStatus } from "@/components/clients/SubmissionStatusBadge";
import { SubmissionPipelineBar } from "@/components/clients/SubmissionPipelineBar";
import { SubmissionRecipientsManager } from "@/components/clients/SubmissionRecipientsManager";
import { SubmissionActivityTimeline } from "@/components/clients/SubmissionActivityTimeline";
import { getSubmissionPackUrl, useGenerateSubmissionPack } from "@/hooks/useSubmissionPack";
import { toast } from "sonner";

interface Props {
  submissionId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SubmissionDetailDialog({ submissionId, open, onOpenChange }: Props) {
  const [data, setData] = useState<any | null>(null);
  const [packUrl, setPackUrl] = useState<string | null>(null);
  const genPack = useGenerateSubmissionPack();

  const load = async () => {
    if (!submissionId) return;
    const { data: row } = await supabase
      .from("candidate_submissions")
      .select(`
        *,
        candidate:candidate_id ( id, full_name, current_title, current_company, location ),
        job:job_id ( id, title ),
        client_org:client_org_id ( id, name )
      `)
      .eq("id", submissionId)
      .maybeSingle();
    setData(row);
    if (row?.pack_pdf_url) {
      try { setPackUrl(await getSubmissionPackUrl(row.pack_pdf_url)); } catch { setPackUrl(null); }
    } else { setPackUrl(null); }
  };

  useEffect(() => { if (open && submissionId) { setData(null); load(); } }, [open, submissionId]);

  const updateStatus = async (status: SubmissionStatus) => {
    if (!submissionId) return;
    const { error } = await supabase.from("candidate_submissions").update({ status }).eq("id", submissionId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Moved to ${SUBMISSION_STATUS_META[status].label}`);
    load();
  };

  const markSubmitted = async () => {
    if (!submissionId) return;
    const { error } = await supabase.from("candidate_submissions")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", submissionId);
    if (error) { toast.error(error.message); return; }
    toast.success("Submitted to client");
    load();
  };

  const regeneratePack = async () => {
    if (!submissionId) return;
    const res = await genPack.mutateAsync(submissionId);
    if (res.signed_url) setPackUrl(res.signed_url);
    load();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {data ? (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">{data.client_org?.name} · {data.job?.title}</div>
                <div className="text-xl">{data.candidate?.full_name}</div>
              </div>
            ) : <Skeleton className="h-6 w-48" />}
          </SheetTitle>
        </SheetHeader>

        {!data ? (
          <div className="space-y-3 mt-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <SubmissionStatusBadge status={data.status} />
                <div className="flex items-center gap-2">
                  {data.status !== "submitted" && data.status !== "viewed" && (
                    <Button size="sm" onClick={markSubmitted}>
                      <Send className="h-4 w-4 mr-1.5" /> Mark Submitted
                    </Button>
                  )}
                  <select
                    className="h-9 text-sm border rounded-md bg-background px-2"
                    value={data.status}
                    onChange={(e) => updateStatus(e.target.value as SubmissionStatus)}
                  >
                    {Object.entries(SUBMISSION_STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <SubmissionPipelineBar status={data.status} />
            </div>

            <Tabs defaultValue="overview" className="mt-5">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="overview"><Sparkles className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
                <TabsTrigger value="pack"><FileText className="h-3.5 w-3.5 mr-1" />Pack</TabsTrigger>
                <TabsTrigger value="recipients"><Users className="h-3.5 w-3.5 mr-1" />Recipients</TabsTrigger>
                <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5 mr-1" />Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4 space-y-4">
                <AIValidationCard jobId={data.job_id} candidateId={data.candidate_id} />
                {data.submission_message && (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Recruiter Notes</div>
                    <p className="text-sm whitespace-pre-wrap">{data.submission_message}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pack" className="mt-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {packUrl ? (
                    <Button asChild variant="outline" size="sm">
                      <a href={packUrl} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 mr-1.5" /> Open Submission Pack
                      </a>
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground">No pack generated yet.</p>
                  )}
                  <Button variant="ghost" size="sm" onClick={regeneratePack} disabled={genPack.isPending}>
                    <RefreshCw className={`h-4 w-4 mr-1.5 ${genPack.isPending ? "animate-spin" : ""}`} />
                    {data.pack_pdf_url ? "Regenerate" : "Generate Pack"}
                  </Button>
                </div>
                {packUrl && (
                  <iframe src={packUrl} title="Submission Pack" className="w-full h-[60vh] rounded-lg border bg-muted/20" />
                )}
              </TabsContent>

              <TabsContent value="recipients" className="mt-4">
                <SubmissionRecipientsManager
                  submissionId={data.id}
                  tenantId={data.tenant_id}
                  clientOrgId={data.client_org_id}
                />
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <SubmissionActivityTimeline submissionId={data.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
