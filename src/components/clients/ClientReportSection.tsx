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
import { Sparkles, Loader2, Save, RefreshCw, Trash2, Plus, History, CheckCircle2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const FIT_VALUES = ["STRONG", "GOOD", "PARTIAL", "WEAK", "MISSING"] as const;
const RECOMMENDATIONS = ["Strong Shortlist", "Recommended", "Consider", "Transferable", "Do Not Recommend"] as const;

const FIT_COLOR: Record<string, string> = {
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
  const [liveAiMatch, setLiveAiMatch] = useState<{
    validation_score: number | null; validation_tier: string | null; validation_id: string | null;
    mirror_score: number | null; mirror_tier: string | null;
  } | null>(null);

  const active = useMemo(() => versions.find((v) => v.id === activeId) ?? null, [versions, activeId]);

  async function loadLiveAiMatch() {
    const [{ data: v }, { data: m }] = await Promise.all([
      supabase.from("ai_candidate_validations")
        .select("id, final_score, fit_score, recommendation_tier, recommendation")
        .eq("job_id", jobId).eq("candidate_id", candidateId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("rediscovered_matches")
        .select("final_score, ai_score, recommendation_tier")
        .eq("job_id", jobId).eq("candidate_id", candidateId).maybeSingle(),
    ]);
    setLiveAiMatch({
      validation_id: (v as any)?.id ?? null,
      validation_score: (v as any)?.final_score ?? (v as any)?.fit_score ?? null,
      validation_tier: ((v as any)?.recommendation_tier ?? (v as any)?.recommendation ?? null),
      mirror_score: (m as any)?.final_score ?? (m as any)?.ai_score ?? null,
      mirror_tier: (m as any)?.recommendation_tier ?? null,
    });
  }


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

  useEffect(() => { loadVersions(); /* eslint-disable-next-line */ }, [tenantId, jobId, candidateId]);

  useEffect(() => {
    if (active) { setReport(active.report_data); setDirty(false); }
  }, [activeId]); // eslint-disable-line

  async function generate() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-client-report", {
        body: { job_id: jobId, candidate_id: candidateId, anonymous },
      });
      if (error) {
        // supabase-js hides the response body on non-2xx — read it from context.
        let backendMsg = error.message;
        const ctx: any = (error as any).context;
        if (ctx && typeof ctx.text === "function") {
          try {
            const raw = await ctx.text();
            try {
              const parsed = JSON.parse(raw);
              backendMsg = parsed.error || parsed.message || raw || backendMsg;
            } catch {
              if (raw) backendMsg = raw;
            }
          } catch { /* ignore */ }
        }
        throw new Error(backendMsg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Report v${(data as any).report.version} generated`);
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
      <Card>
        <CardContent className="p-5 space-y-3">
          <SectionHeader title="AI Client Submission Report" />
          <p className="text-sm text-muted-foreground">
            Generate an AI-powered recruiter assessment report combining the JD, CV, validation results, and your recruiter notes.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="anon" checked={anonymous} onCheckedChange={setAnonymous} />
              <Label htmlFor="anon" className="text-sm">Anonymous mode</Label>
            </div>
            <Button onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate Report
            </Button>
          </div>
        </CardContent>
      </Card>
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
            <span className="font-semibold text-sm">AI Client Submission Report</span>
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
            <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
              {generating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              Regenerate
            </Button>
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

        {/* AI Match provenance banner — proves report inherits from validated AI Match */}
        {(report.meta?.match_score != null || report.meta?.interview_probability != null || rec.tier) && (
          <div className="px-3 py-2 text-xs bg-primary/5 text-foreground border-b flex flex-wrap items-center gap-2">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="font-semibold">Inherited from AI Match:</span>
            {rec.tier && <Badge variant="default">{rec.tier}</Badge>}
            {report.meta?.match_score != null && (
              <Badge variant="outline">Match Score {report.meta.match_score}%</Badge>
            )}
            {report.meta?.interview_probability != null && (
              <Badge variant="outline">Interview Probability {report.meta.interview_probability}%</Badge>
            )}
            <span className="text-muted-foreground ml-auto">
              Recruiter Notes enrich the narrative — they do not change the score.
            </span>
          </div>
        )}


        {/* Report Preview */}
        <div className="p-5 space-y-6" style={branding.primary_color ? { borderTop: `4px solid ${branding.primary_color}` } : {}}>
          {/* Header */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b">
            <div className="flex items-center gap-3">
              {branding.logo_url ? (
                <img src={branding.logo_url} alt="Agency logo" className="h-12 max-w-[180px] object-contain" />
              ) : (
                <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {(branding.company_name || "A").charAt(0)}
                </div>
              )}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Client Submission Report</div>
                <div className="font-semibold">{branding.company_name || "Agency"}</div>
              </div>
            </div>
            <Badge variant="destructive" className="uppercase">Confidential</Badge>
          </div>

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Candidate</div>
            <h2 className="text-2xl font-bold">{header.anonymous ? "Confidential Candidate" : (header.candidate_name || candidateName)}</h2>
            <div className="text-sm text-muted-foreground">Position: {header.position || jobTitle}</div>
          </div>

          {/* Snapshot */}
          <Subsection title="Candidate Snapshot">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                ["Compensation Expectation", "compensation_expectation"],
                ["Availability", "availability"],
                ["Nationality", "nationality"],
                ["Current Location", "current_location"],
                ["Current Employer", "current_employer"],
                ["Current Position", "current_position"],
              ].map(([label, key]) => (
                <div key={key}>
                  <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
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

          {/* Fit Assessment */}
          <Subsection
            title="Fit Assessment vs Job Description"
            action={
              <Button size="sm" variant="outline" onClick={() => update((r) => {
                r.fit_assessment = [...(r.fit_assessment ?? []), { requirement: "", evidence: "", fit: "PARTIAL" }];
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

          {/* Strengths */}
          <Subsection
            title="Key Strengths"
            action={<Button size="sm" variant="outline" onClick={() => update((r) => { r.key_strengths = [...(r.key_strengths ?? []), ""]; })}><Plus className="h-3 w-3 mr-1" />Add</Button>}
          >
            <div className="space-y-2">
              {strengths.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={s} onChange={(e) => update((r) => { r.key_strengths[i] = e.target.value; })} />
                  <Button size="icon" variant="ghost" onClick={() => update((r) => { r.key_strengths.splice(i, 1); })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Subsection>

          {/* Considerations */}
          <Subsection
            title="Considerations"
            action={<Button size="sm" variant="outline" onClick={() => update((r) => { r.considerations = [...(r.considerations ?? []), ""]; })}><Plus className="h-3 w-3 mr-1" />Add</Button>}
          >
            <div className="space-y-2">
              {considerations.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={s} onChange={(e) => update((r) => { r.considerations[i] = e.target.value; })} />
                  <Button size="icon" variant="ghost" onClick={() => update((r) => { r.considerations.splice(i, 1); })}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </Subsection>

          {/* Recruiter Notes */}
          <Subsection title="Recruiter Notes">
            <Textarea
              className="min-h-[120px] text-sm"
              value={report.recruiter_notes ?? ""}
              onChange={(e) => update((r) => { r.recruiter_notes = e.target.value; })}
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
