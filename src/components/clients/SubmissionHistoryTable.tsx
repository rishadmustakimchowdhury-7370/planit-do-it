import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { History, Eye, Download, Send, FileText, CheckCircle2, Package, Mail } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  jobId: string;
  candidateId: string;
  refreshKey?: number;
  onPreview?: (packId: string) => void;
  onResend?: (packId: string) => void;
}

type Row = {
  id: string;
  pack_option: "A" | "B" | "C";
  storage_path: string;
  file_name: string;
  created_at: string;
  recruiter_id: string | null;
  report_id: string | null;
  version: number | null;
  recruiter_name: string | null;
  candidate_name: string | null;
  job_title: string | null;
  client_name: string | null;
};

const OPT_LABEL: Record<string, string> = {
  A: "AI Report",
  B: "CV + Report",
  C: "Branded CV + Report",
};

export function SubmissionHistoryTable({
  tenantId, jobId, candidateId, refreshKey, onPreview, onResend,
}: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: packs } = await supabase
      .from("client_submission_pack_files")
      .select("id, pack_option, storage_path, file_name, created_at, recruiter_id, report_id")
      .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });

    const list = (packs ?? []) as any[];
    if (list.length === 0) { setRows([]); setLoading(false); return; }

    const reportIds = Array.from(new Set(list.map(r => r.report_id).filter(Boolean)));
    const recruiterIds = Array.from(new Set(list.map(r => r.recruiter_id).filter(Boolean)));

    const sb = supabase as any;
    const [reportsRes, profsRes, candRes, jobRes] = await Promise.all([
      reportIds.length
        ? sb.from("client_submission_reports").select("id, version").in("id", reportIds)
        : Promise.resolve({ data: [] }),
      recruiterIds.length
        ? sb.from("profiles").select("user_id, full_name").in("user_id", recruiterIds)
        : Promise.resolve({ data: [] }),
      sb.from("candidates").select("full_name").eq("id", candidateId).maybeSingle(),
      sb.from("jobs").select("title, client_id").eq("id", jobId).maybeSingle(),
    ]);
    const reports = (reportsRes?.data ?? []) as any[];
    const profs = (profsRes?.data ?? []) as any[];
    const cand = candRes?.data as any;
    const job = jobRes?.data as any;

    let clientName: string | null = null;
    if ((job as any)?.client_id) {
      const { data: cl } = await supabase.from("clients").select("name").eq("id", (job as any).client_id).maybeSingle();
      clientName = (cl as any)?.name ?? null;
    }

    const repMap = new Map((reports ?? []).map((r: any) => [r.id, r.version]));
    const profMap = new Map((profs ?? []).map((p: any) => [p.user_id, p.full_name]));

    setRows(list.map(r => ({
      ...r,
      version: r.report_id ? (repMap.get(r.report_id) ?? null) : null,
      recruiter_name: r.recruiter_id ? (profMap.get(r.recruiter_id) ?? null) : null,
      candidate_name: (cand as any)?.full_name ?? null,
      job_title: (job as any)?.title ?? null,
      client_name: clientName,
    })));
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId, jobId, candidateId, refreshKey]);

  async function download(row: Row) {
    const { data, error } = await supabase.storage.from("submission-packs")
      .createSignedUrl(row.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Download failed"); return; }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <History className="h-4 w-4" />
          </div>
          <h4 className="font-semibold text-sm">Submission History</h4>
          <Badge variant="secondary" className="ml-1">{rows.length}</Badge>
        </div>

        {loading ? (
          <Skeleton className="h-32" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No packs generated yet.</p>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">Version</TableHead>
                  <TableHead>Option</TableHead>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell><Badge variant="outline">v{r.version ?? "—"}</Badge></TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{OPT_LABEL[r.pack_option]}</Badge></TableCell>
                    <TableCell className="text-xs">{r.candidate_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.job_title ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.client_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.recruiter_name ?? "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPreview?.(r.id)} title="Open">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => download(r)} title="Download">
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onResend?.(r.id)} title="Re-send">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
