import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  FileText, Eye, Download, Copy, RefreshCw, ExternalLink, Loader2, Archive, History,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const OPTION_LABEL: Record<string, string> = {
  A: "AI Report",
  B: "Original CV + Report",
  C: "Branded CV + Report",
};

type PackRow = {
  id: string;
  pack_option: "A" | "B" | "C" | string;
  storage_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  report_id: string | null;
  job_id: string;
  status: string | null;
  report?: { version: number | null; status: string | null } | null;
  job?: { id: string; title: string | null } | null;
};

interface Props {
  candidateId: string;
  tenantId: string;
}

export function CandidateSubmissionAssets({ candidateId, tenantId }: Props) {
  const { user } = useAuth();
  const [rows, setRows] = useState<PackRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("client_submission_pack_files")
      .select(`id, pack_option, storage_path, file_name, file_size, created_at, report_id, job_id, status,
        report:report_id ( version, status ),
        job:job_id ( id, title )`)
      .eq("tenant_id", tenantId)
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); setRows([]); return; }
    setRows((data as any[]) ?? []);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [candidateId, tenantId]);

  const groupedByJob = useMemo(() => {
    const map = new Map<string, { jobId: string; jobTitle: string; items: PackRow[] }>();
    (rows ?? []).forEach((r) => {
      const jid = r.job_id;
      if (!map.has(jid)) map.set(jid, { jobId: jid, jobTitle: r.job?.title || "Untitled job", items: [] });
      map.get(jid)!.items.push(r);
    });
    return Array.from(map.values());
  }, [rows]);

  async function viewOrDownload(row: PackRow, mode: "view" | "download") {
    const { data, error } = await supabase.storage.from("submission-packs")
      .createSignedUrl(row.storage_path, 3600, mode === "download" ? { download: row.file_name } : undefined);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Could not open file"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function duplicate(row: PackRow) {
    if (!row.report_id) { toast.error("Original report missing — cannot regenerate."); return; }
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("build-submission-pack", {
        body: { report_id: row.report_id, pack_option: row.pack_option },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("New version generated");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Regeneration failed");
    } finally { setBusyId(null); }
  }

  if (rows === null) return <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>;

  if (!rows.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10 text-center gap-2 text-muted-foreground">
          <Archive className="h-8 w-8" />
          <p className="text-sm">No submission packs yet for this candidate.</p>
          <p className="text-[11px]">Approved reports and generated packs will be permanently archived here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Submission Asset Library</h3>
        <Badge variant="outline" className="ml-auto text-[10px]">
          {rows.length} file{rows.length === 1 ? "" : "s"} · all versions retained
        </Badge>
      </div>

      <Tabs defaultValue={groupedByJob[0]?.jobId} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          {groupedByJob.map((g) => (
            <TabsTrigger key={g.jobId} value={g.jobId} className="text-xs">
              {g.jobTitle}
              <Badge variant="outline" className="ml-2 text-[10px]">{g.items.length}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {groupedByJob.map((g) => (
          <TabsContent key={g.jobId} value={g.jobId} className="mt-4 space-y-2">
            {g.items.map((row) => {
              const optLabel = OPTION_LABEL[row.pack_option] ?? `Option ${row.pack_option}`;
              const version = row.report?.version ?? null;
              return (
                <Card key={row.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-3 flex flex-wrap items-center gap-3">
                    <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{optLabel}</span>
                        {version != null && (
                          <Badge variant="secondary" className="text-[10px]">v{version}</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">Option {row.pack_option}</Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {row.file_name}
                        {row.file_size ? ` · ${(row.file_size / 1024).toFixed(0)} KB` : ""}
                        {" · "}Built {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => viewOrDownload(row, "view")}>
                        <Eye className="h-3 w-3 mr-1" /> View
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => viewOrDownload(row, "download")}>
                        <Download className="h-3 w-3 mr-1" /> Download
                      </Button>
                      <Button size="sm" variant="ghost" disabled={busyId === row.id || !row.report_id}
                        onClick={() => duplicate(row)}
                        title={!row.report_id ? "Original report missing" : "Build a new version from the same report"}>
                        {busyId === row.id
                          ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          : <Copy className="h-3 w-3 mr-1" />}
                        Duplicate
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/jobs/${row.job_id}`}>
                          <RefreshCw className="h-3 w-3 mr-1" /> Reuse
                          <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
