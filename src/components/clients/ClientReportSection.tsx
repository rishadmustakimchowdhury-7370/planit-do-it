import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sparkles, Loader2, Save, RefreshCw, Trash2, Plus, History, CheckCircle2, Lock, AlertTriangle, ChevronDown, Pencil, Eraser } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { PreviousReportsPanel } from "./PreviousReportsPanel";

const FIT_VALUES = ["EXCEEDS", "STRONG", "GOOD", "PARTIAL", "WEAK", "MISSING"] as const;
const RECOMMENDATIONS = ["Strong Shortlist", "Recommended", "Consider", "Transferable", "Do Not Recommend"] as const;

const FIT_COLOR: Record<string, string> = {
  EXCEEDS: "bg-blue-500/15 text-blue-700 border-blue-300",
  STRONG: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  GOOD: "bg-green-500/15 text-green-700 border-green-300",
  PARTIAL: "bg-amber-500/15 text-amber-700 border-amber-300",
  WEAK: "bg-orange-500/15 text-orange-700 border-orange-300",
  MISSING: "bg-rose-500/15 text-rose-700 border-rose-300",
};

interface Props {
  tenantId: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  onReportChanged?: () => void;
}

type ReportRow = {
  id: string;
  version: number;
  status: string;
  report_data: any;
  created_at: string;
};

export function ClientReportSection({ tenantId, jobId, candidateId, candidateName, jobTitle, onReportChanged }: Props) {
  const [versions, setVersions] = useState<ReportRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [staleSources, setStaleSources] = useState<{ label: string; at: string }[]>([]);
  const [staleAck, setStaleAck] = useState(false);

  const active = useMemo(() => versions.find((v) => v.id === activeId) ?? null, [versions, activeId]);

  async function loadVersions() {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_submission_reports")
      .select("id, version, status, report_data, created_at")
      .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
      .order("version", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setVersions((data ?? []) as ReportRow[]);
    if (data && data.length > 0) {
      setActiveId(data[0].id);
      setReport(data[0].report_data);
      setDirty(false);
    } else {
      setActiveId(null); setReport(null);
    }
    onReportChanged?.();
  }

  // Staleness now only checks recruiter notes / candidate / job — the report
  // no longer has any dependency on the AI Match / validator workflow.
  async function checkStaleness(reportCreatedAt: string | null) {
    if (!reportCreatedAt) { setStaleSources([]); return; }
    const reportTs = new Date(reportCreatedAt).getTime();
    const [{ data: notes }, { data: cand }, { data: jb }] = await Promise.all([
      supabase.from("prepare_for_client_assessments")
        .select("updated_at, created_at").eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("candidates").select("updated_at").eq("id", candidateId).maybeSingle(),
      supabase.from("jobs").select("updated_at").eq("id", jobId).maybeSingle(),
    ]);
    const items: { label: string; at: string }[] = [];
    const push = (label: string, at?: string | null) => {
      if (at && new Date(at).getTime() > reportTs) items.push({ label, at });
    };
    push("Recruiter Notes", (notes as any)?.updated_at ?? (notes as any)?.created_at);
    push("Candidate profile", (cand as any)?.updated_at);
    push("Job", (jb as any)?.updated_at);
    setStaleSources(items);
    setStaleAck(false);
  }

  useEffect(() => { loadVersions(); /* eslint-disable-next-line */ }, [tenantId, jobId, candidateId]);

  useEffect(() => {
    if (active) checkStaleness(active.created_at);
    else setStaleSources([]);
    // eslint-disable-next-line
  }, [activeId, versions]);

  useEffect(() => {
    if (active) { setReport(active.report_data); setDirty(false); }
  }, [activeId]); // eslint-disable-line

  async function generate(mode: "with_edits" | "from_original" = "with_edits") {
    setGenerating(true);
    try {
      if (mode === "with_edits" && dirty && activeId) {
        await supabase.from("client_submission_reports").update({ report_data: report }).eq("id", activeId);
        setDirty(false);
      }
      const previous_report = mode === "with_edits" ? (report ?? active?.report_data ?? null) : null;
      const { data, error } = await supabase.functions.invoke("generate-client-report", {
        body: { job_id: jobId, candidate_id: candidateId, anonymous, mode, previous_report },
      });
      if (error) {
        let backendMsg = error.message;
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.text === "function") {
          try {
            const raw = await ctx.text();
            try {
              const parsed = JSON.parse(raw);
              backendMsg = parsed.error || parsed.message || raw || backendMsg;
            } catch { if (raw) backendMsg = raw; }
          } catch { /* ignore */ }
        }
        throw new Error(backendMsg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      const v = (data as any).report.version;
      toast.success(mode === "with_edits"
        ? `Report v${v} regenerated using your edits`
        : `Report v${v} regenerated from original`);
      await loadVersions();
    } catch (e: any) {
      toast.error(e?.message ?? "Generation failed", { duration: 8000 });
    } finally { setGenerating(false); }
  }

  async function saveEdits() {
    if (!activeId) return;
    const wasApproved = active?.status === "approved";
    const { error } = await supabase
      .from("client_submission_reports")
      .update({ report_data: report })
      .eq("id", activeId);
    if (error) { toast.error(error.message); return; }
    toast.success(wasApproved ? "Saved — status reverted to Draft. Re-approve before generating a pack." : "Saved");
    setDirty(false);
    loadVersions();
  }

  async function approve() {
    if (!activeId) return;
    const { error } = await supabase
      .from("client_submission_reports")
      .update({ status: "approved" })
      .eq("id", activeId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Report v${active?.version} approved and locked`);
    loadVersions();
  }

  async function unapprove() {
    if (!activeId) return;
    const { error } = await supabase
      .from("client_submission_reports")
      .update({ status: "draft" })
      .eq("id", activeId);
    if (error) { toast.error(error.message); return; }
    toast.success("Reverted to Draft");
    loadVersions();
  }

  function update(path: (r: any) => void) {
    setReport((prev: any) => {
      const next = structuredClone(prev ?? {});
      path(next);
      return next;
    });
    setDirty(true);
  }

  // --- Empty state ---
  if (!loading && versions.length === 0) {
    return (
      <div className="space-y-3">
        <PreviousReportsPanel
          tenantId={tenantId} jobId={jobId} candidateId={candidateId}
          onAfterCopy={loadVersions}
        />
        <Card>
          <CardContent className="p-5 space-y-3">
            <SectionHeader title="Client Submission Report" />
            <p className="text-sm text-muted-foreground">
              Generate a professional client-facing submission report from the JD, CV, your recruiter notes and any voice transcript.
              This is independent of AI Match — you've already decided to submit this candidate.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch id="anon" checked={anonymous} onCheckedChange={setAnonymous} />
                <Label htmlFor="anon" className="text-sm">Anonymous mode</Label>
              </div>
              <Button onClick={() => generate("from_original")} disabled={generating}>
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) return <Card><CardContent className="p-5"><Loader2 className="h-4 w-4 animate-spin" /></CardContent></Card>;

  const branding = report.branding ?? {};
  const header = report.header ?? {};
  const snap = report.snapshot ?? {};
  const fit: any[] = Array.isArray(report.fit_assessment) ? report.fit_assessment : [];
  const strengths: string[] = report.key_strengths ?? [];
  const considerations: string[] = report.considerations ?? [];
  const rec = report.recommendation ?? {};

  return (
    <Card>
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Client Submission Report</span>
            <Badge variant="outline" className="ml-2"><History className="h-3 w-3 mr-1" />v{active?.version}</Badge>
            {active?.status === "approved" ? (
              <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-white">
                <Lock className="h-3 w-3" /> Approved · Locked
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> Draft
              </Badge>
            )}
            {versions.length > 1 && (
              <Select value={activeId ?? undefined} onValueChange={setActiveId}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.id}>v{v.version} · {v.status} · {new Date(v.created_at).toLocaleDateString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Switch id="anon2" checked={anonymous} onCheckedChange={setAnonymous} />
              <Label htmlFor="anon2" className="text-xs">Anonymous</Label>
            </div>
            <div className="inline-flex rounded-md shadow-sm">
              <Button
                size="sm"
                variant="outline"
                className="rounded-r-none border-r-0"
                onClick={() => generate("with_edits")}
                disabled={generating}
                title="Regenerate using your manual edits as context (default)"
              >
                {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Pencil className="h-3 w-3 mr-1" />}
                Regenerate Using My Edits
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-l-none px-2" disabled={generating}>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs">Regeneration mode</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => generate("with_edits")}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    <div className="flex flex-col">
                      <span>Regenerate Using My Edits</span>
                      <span className="text-[11px] text-muted-foreground">Default — preserves recruiter edits</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => generate("from_original")}>
                    <Eraser className="h-3.5 w-3.5 mr-2" />
                    <div className="flex flex-col">
                      <span>Regenerate From Original</span>
                      <span className="text-[11px] text-muted-foreground">Clean slate — discards manual edits</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button size="sm" variant="outline" onClick={saveEdits} disabled={!dirty}>
              <Save className="h-3 w-3 mr-1" /> Save
            </Button>
            {active?.status === "approved" ? (
              <Button size="sm" variant="outline" onClick={unapprove}>
                <Lock className="h-3 w-3 mr-1" /> Unlock
              </Button>
            ) : (
              <Button size="sm" onClick={approve} disabled={dirty} title={dirty ? "Save your edits first" : "Approve and lock this version"}>
                <CheckCircle2 className="h-3 w-3 mr-1" /> Approve Report
              </Button>
            )}
          </div>
        </div>

        {active?.status === "approved" && (
          <div className="px-3 py-2 text-xs bg-emerald-50 text-emerald-800 border-b flex items-center gap-2">
            <Lock className="h-3 w-3" />
            Version v{active.version} is locked. Any edit will automatically revert this report to Draft and require re-approval.
          </div>
        )}
        {active?.status !== "approved" && (
          <div className="px-3 py-2 text-xs bg-amber-50 text-amber-800 border-b flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            Submission Pack generation is disabled until this report is Approved.
          </div>
        )}

        {staleSources.length > 0 && !staleAck && (
          <div className="px-3 py-2 text-xs bg-amber-100 text-amber-900 border-b">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div>
                  <span className="font-semibold">Report may be outdated.</span> Newer source data exists since v{active?.version} was saved
                  {active?.created_at ? ` (${new Date(active.created_at).toLocaleString()})` : ""}.
                </div>
                <ul className="list-disc ml-4 space-y-0.5">
                  {staleSources.map((s) => (
                    <li key={s.label}>{s.label} updated {new Date(s.at).toLocaleString()}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setStaleAck(true)}>
                    Continue Editing Existing Report
                  </Button>
                  <Button size="sm" className="h-7" onClick={() => { setStaleAck(true); generate("from_original"); }} disabled={generating}>
                    {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    Regenerate Using Current Data
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Branding diagnostics banner */}
        {(() => {
          const hasName = !!branding.company_name;
          const hasLogo = !!branding.logo_url;
          if (hasName && hasLogo) return null;
          return (
            <div className="mx-5 mt-3 rounded-md border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-xs">
              <div className="font-semibold uppercase tracking-wide mb-1">Branding Incomplete</div>
              <div className="space-y-0.5">
                {!hasName && <div>• Agency name missing — set <span className="font-mono">company_name</span> in Branding Settings (or Tenant name).</div>}
                {!hasLogo && <div>• Agency logo missing — upload a PNG/JPG logo in Branding Settings.</div>}
              </div>
            </div>
          );
        })()}

        {/* Report Preview — mirrors the PDF template */}
        <div className="p-5 space-y-6" style={branding.primary_color ? { borderTop: `4px solid ${branding.primary_color}` } : {}}>
          {/* Header — logo only on the left, Candidate Report / CONFIDENTIAL on the right */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b">
            <div className="flex items-center">
              {branding.logo_url ? (
                <img
                  src={branding.logo_url}
                  alt="Agency logo"
                  className="h-14 max-w-[220px] object-contain"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div className="text-xs italic text-rose-700">No agency logo configured</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">Candidate Report</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-rose-700 font-semibold mt-0.5">Confidential</div>
            </div>
          </div>

          {/* Candidate name + position */}
          <div>
            <h2 className="text-2xl font-bold">{header.anonymous ? "Confidential Candidate" : (header.candidate_name || candidateName)}</h2>
            <div className="text-sm text-muted-foreground">{header.position || jobTitle}</div>
          </div>

          {/* Snapshot — 4-up like template */}
          <Subsection title="Snapshot">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Compensation Expectation", "compensation_expectation"],
                ["Availability", "availability"],
                ["Base / Nationality", "nationality"],
                ["Current Role", "current_position"],
                ["Current Location", "current_location"],
                ["Current Employer", "current_employer"],
              ].map(([label, key]) => (
                <div key={key}>
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
                  <Input
                    className="h-8 text-sm"
                    value={snap[key] ?? ""}
                    onChange={(e) => update((r) => { r.snapshot = { ...r.snapshot, [key]: e.target.value }; })}
                  />
                </div>
              ))}
            </div>
          </Subsection>

          {/* Executive Summary */}
          <Subsection title="Executive Summary">
            <Textarea
              className="min-h-[110px] text-sm"
              value={report.executive_summary ?? ""}
              onChange={(e) => update((r) => { r.executive_summary = e.target.value; })}
            />
          </Subsection>

          {/* Candidate Overview */}
          <Subsection title="Candidate Overview">
            <Textarea
              className="min-h-[90px] text-sm"
              value={report.candidate_overview ?? ""}
              onChange={(e) => update((r) => { r.candidate_overview = e.target.value; })}
            />
          </Subsection>

          {/* Fit Assessment */}
          <Subsection
            title="Fit Assessment vs Job Description"
            action={
              <Button size="sm" variant="outline" onClick={() => update((r) => {
                r.fit_assessment = [...(r.fit_assessment ?? []), { requirement: "", evidence: "", fit: "STRONG" }];
              })}><Plus className="h-3 w-3 mr-1" />Add row</Button>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[28%]">Requirement</TableHead>
                  <TableHead>Candidate Evidence</TableHead>
                  <TableHead className="w-[140px]">Fit</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fit.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="align-top">
                      <Textarea
                        className="min-h-[60px] text-sm"
                        value={row.requirement ?? ""}
                        onChange={(e) => update((r) => { r.fit_assessment[i].requirement = e.target.value; })}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Textarea
                        className="min-h-[60px] text-sm"
                        value={row.evidence ?? ""}
                        onChange={(e) => update((r) => { r.fit_assessment[i].evidence = e.target.value; })}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Select value={row.fit} onValueChange={(v) => update((r) => { r.fit_assessment[i].fit = v; })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FIT_VALUES.map((f) => (
                            <SelectItem key={f} value={f}>
                              <span className={`px-2 py-0.5 rounded text-xs border ${FIT_COLOR[f]}`}>{f}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Button size="icon" variant="ghost" onClick={() => update((r) => { r.fit_assessment.splice(i, 1); })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Subsection>

          {/* Two-column Strengths / Considerations */}
          <div className="grid md:grid-cols-2 gap-6">
            <Subsection
              title="Key Strengths"
              action={<Button size="sm" variant="outline" onClick={() => update((r) => { r.key_strengths = [...(r.key_strengths ?? []), ""]; })}><Plus className="h-3 w-3 mr-1" />Add</Button>}
            >
              <div className="space-y-2">
                {strengths.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Textarea className="min-h-[44px] text-sm" value={s} onChange={(e) => update((r) => { r.key_strengths[i] = e.target.value; })} />
                    <Button size="icon" variant="ghost" onClick={() => update((r) => { r.key_strengths.splice(i, 1); })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </Subsection>

            <Subsection
              title="Considerations / Potential Gaps"
              action={<Button size="sm" variant="outline" onClick={() => update((r) => { r.considerations = [...(r.considerations ?? []), ""]; })}><Plus className="h-3 w-3 mr-1" />Add</Button>}
            >
              <div className="space-y-2">
                {considerations.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Textarea className="min-h-[44px] text-sm" value={s} onChange={(e) => update((r) => { r.considerations[i] = e.target.value; })} />
                    <Button size="icon" variant="ghost" onClick={() => update((r) => { r.considerations.splice(i, 1); })}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </Subsection>
          </div>

          {/* Recruiter Assessment */}
          <Subsection title="Recruiter Assessment">
            <Textarea
              className="min-h-[120px] text-sm"
              value={report.recruiter_assessment ?? ""}
              onChange={(e) => update((r) => { r.recruiter_assessment = e.target.value; })}
            />
          </Subsection>

          {/* Salary & Availability */}
          <Subsection title="Salary & Availability">
            <Textarea
              className="min-h-[80px] text-sm"
              value={report.salary_availability ?? ""}
              onChange={(e) => update((r) => { r.salary_availability = e.target.value; })}
            />
          </Subsection>

          {/* Recommendation */}
          <Subsection title="Recommendation">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground w-24">Tier</Label>
                <Select value={rec.tier} onValueChange={(v) => update((r) => { r.recommendation = { ...r.recommendation, tier: v }; })}>
                  <SelectTrigger className="h-9 w-[240px]"><SelectValue placeholder="Select recommendation" /></SelectTrigger>
                  <SelectContent>
                    {RECOMMENDATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                className="min-h-[90px] text-sm"
                placeholder="Reasoning..."
                value={rec.reasoning ?? ""}
                onChange={(e) => update((r) => { r.recommendation = { ...r.recommendation, reasoning: e.target.value }; })}
              />
            </div>
          </Subsection>

          {branding.footer_text && (
            <div className="pt-4 border-t text-xs text-muted-foreground text-center">{branding.footer_text}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
        <Sparkles className="h-4 w-4" />
      </div>
      <h4 className="font-semibold text-sm">{title}</h4>
    </div>
  );
}

function Subsection({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h5>
        {action}
      </div>
      {children}
    </div>
  );
}
