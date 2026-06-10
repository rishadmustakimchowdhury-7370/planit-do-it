import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Eye, Download, Send, RefreshCw, Pencil, Loader2, FileText, KanbanSquare,
} from "lucide-react";
import { toast } from "sonner";
import { AddToPipelineDialog } from "./AddToPipelineDialog";

interface Props {
  tenantId: string;
  jobId: string;
  candidateId: string;
  /** Provide to pin the preview to a specific historical file. */
  pinnedPackId?: string | null;
  /** Bump to force a reload (e.g. after a new pack is built). */
  refreshKey?: number;
  onEditReport?: () => void;
  onRegenerateReport?: () => void;
  onSendToClient?: (packId: string) => void;
}

type PackRow = {
  id: string;
  pack_option: "A" | "B" | "C";
  storage_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  report_id: string | null;
};

const OPTIONS: { key: "A" | "B" | "C"; label: string }[] = [
  { key: "A", label: "AI Report Only" },
  { key: "B", label: "Original CV + Report" },
  { key: "C", label: "Branded CV + Report" },
];

export function SubmissionPackPreview({
  tenantId, jobId, candidateId, pinnedPackId, refreshKey,
  onEditReport, onRegenerateReport, onSendToClient,
}: Props) {
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [activeOption, setActiveOption] = useState<"A" | "B" | "C">("A");
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [pinned, setPinned] = useState<PackRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("client_submission_pack_files")
      .select("id, pack_option, storage_path, file_name, file_size, created_at, report_id")
      .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    setPacks((data ?? []) as PackRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId, jobId, candidateId, refreshKey]);

  // Pinned overrides — if the pinned id isn't in our list yet, force a reload.
  useEffect(() => {
    if (!pinnedPackId) { setPinned(null); return; }
    const found = packs.find(p => p.id === pinnedPackId);
    if (found) { setPinned(found); setActiveOption(found.pack_option); }
    else { load(); }
    /* eslint-disable-next-line */
  }, [pinnedPackId, packs]);

  const latestByOption = useMemo(() => {
    const map: Record<string, PackRow | undefined> = {};
    for (const p of packs) if (!map[p.pack_option]) map[p.pack_option] = p;
    return map;
  }, [packs]);

  const active: PackRow | undefined = pinned ?? latestByOption[activeOption];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSignedUrl(null);
      if (!active) return;
      const { data } = await supabase.storage.from("submission-packs")
        .createSignedUrl(active.storage_path, 3600);
      if (!cancelled) setSignedUrl(data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [active?.id]);

  async function regeneratePack() {
    if (!active?.report_id) {
      toast.error("Approve an AI report first");
      return;
    }
    setBuilding(true);
    try {
      const { data, error } = await supabase.functions.invoke("build-submission-pack", {
        body: { report_id: active.report_id, pack_option: activeOption },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Pack regenerated");
      setPinned(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Build failed");
    } finally { setBuilding(false); }
  }

  function download() {
    if (!signedUrl) return;
    window.open(signedUrl, "_blank");
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Eye className="h-4 w-4" />
            </div>
            <h4 className="font-semibold text-sm">Submission Pack Preview</h4>
            {active && (
              <>
                <Badge variant="outline" className="ml-2 text-[10px]">Option {active.pack_option}</Badge>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(active.created_at).toLocaleString()}
                  {active.file_size ? ` · ${(active.file_size / 1024).toFixed(0)} KB` : ""}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {onEditReport && (
              <Button size="sm" variant="ghost" onClick={onEditReport}>
                <Pencil className="h-3 w-3 mr-1" />Edit Report
              </Button>
            )}
            {onRegenerateReport && (
              <Button size="sm" variant="ghost" onClick={onRegenerateReport}>
                <RefreshCw className="h-3 w-3 mr-1" />Regenerate Report
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={regeneratePack} disabled={building || !active}>
              {building ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Regenerate Pack
            </Button>
            <Button size="sm" variant="outline" onClick={download} disabled={!signedUrl}>
              <Download className="h-3 w-3 mr-1" />Download
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)} disabled={!active}>
              <KanbanSquare className="h-3 w-3 mr-1" />Add To Pipeline
            </Button>
            <Button size="sm" onClick={() => active && onSendToClient?.(active.id)} disabled={!active}>
              <Send className="h-3 w-3 mr-1" />Send To Client
            </Button>
          </div>
        </div>

        <AddToPipelineDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          tenantId={tenantId}
          jobId={jobId}
          candidateId={candidateId}
          primaryPackId={active?.id ?? null}
        />

        {/* Tabs */}
        {!pinned && (
          <div className="px-3 pt-3">
            <Tabs value={activeOption} onValueChange={(v) => setActiveOption(v as any)}>
              <TabsList className="grid grid-cols-3 w-full">
                {OPTIONS.map(o => (
                  <TabsTrigger key={o.key} value={o.key} className="text-xs">
                    {o.label}
                    {latestByOption[o.key] && <span className="ml-1 text-[10px] opacity-60">●</span>}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Viewer */}
        <div className="p-3">
          {loading ? (
            <Skeleton className="h-[640px]" />
          ) : !active ? (
            <div className="border border-dashed rounded-md p-10 text-center text-sm text-muted-foreground space-y-2">
              <FileText className="h-8 w-8 mx-auto opacity-50" />
              <div>No {OPTIONS.find(o => o.key === activeOption)?.label} pack yet.</div>
              <Button size="sm" variant="outline" onClick={regeneratePack} disabled={building}>
                {building ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <FileText className="h-3 w-3 mr-1" />}
                Generate now
              </Button>
            </div>
          ) : !signedUrl ? (
            <Skeleton className="h-[640px]" />
          ) : (
            <iframe
              key={signedUrl}
              src={`${signedUrl}#toolbar=1&view=FitH`}
              className="w-full h-[720px] rounded-md border bg-background"
              title="Submission pack preview"
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
