import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send, Loader2, Download, Sparkles, Mail, Paperclip,
  Inbox as InboxIcon, FileText, Archive, FilePlus2,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  /** When set, the matching pack is auto-attached on mount/update. */
  prefillAttachmentId?: string | null;
  /** Bump to force a reload of packs/emails (e.g. after a new pack is built). */
  refreshKey?: number;
}

type PackRow = {
  id: string;
  pack_option: "A" | "B" | "C";
  storage_path: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
};

type EmailRow = {
  id: string;
  to_email: string;
  from_email: string;
  subject: string;
  status: string | null;
  direction: string | null;
  sent_at: string | null;
  created_at: string;
  submission_version: number | null;
  attachments: any;
};

type TemplateRow = { id: string; name: string; subject: string; body_text: string };
type EmailAccount = { id: string; display_name: string; from_email: string; is_default: boolean };

const PACK_LABELS: Record<string, string> = {
  A: "AI Report",
  B: "Original CV + AI Report",
  C: "Branded CV + AI Report",
};

export function ClientDeliveryWorkspace({
  tenantId, jobId, candidateId, candidateName, jobTitle, prefillAttachmentId, refreshKey,
}: Props) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<{ id: string; name: string; contact_name: string | null; contact_email: string | null } | null>(null);
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [latestReport, setLatestReport] = useState<{ id: string; version: number; status: string } | null>(null);

  // Compose state
  const [toEmail, setToEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [selectedPackIds, setSelectedPackIds] = useState<string[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [tab, setTab] = useState("compose");

  async function refresh() {
    setLoading(true);
    // Job → client
    const { data: job } = await supabase
      .from("jobs").select("client_id").eq("id", jobId).maybeSingle();

    let clientRow: any = null;
    if (job?.client_id) {
      const { data } = await supabase
        .from("clients")
        .select("id, name, contact_name, contact_email")
        .eq("id", job.client_id).maybeSingle();
      clientRow = data;
    }

    const [{ data: pks }, { data: rep }, { data: tpls }, { data: accs }] = await Promise.all([
      supabase.from("client_submission_pack_files")
        .select("id, pack_option, storage_path, file_name, file_size, created_at")
        .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
        .order("created_at", { ascending: false }),
      supabase.from("client_submission_reports")
        .select("id, version, status")
        .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
        .order("version", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("user_email_templates")
        .select("id, name, subject, body_text")
        .eq("is_active", true).order("name"),
      user?.id
        ? supabase.from("email_accounts")
            .select("id, display_name, from_email, is_default")
            .eq("user_id", user.id).eq("status", "connected")
            .order("is_default", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);

    let emailRows: EmailRow[] = [];
    if (clientRow?.id) {
      const { data: em } = await supabase
        .from("client_emails")
        .select("id, to_email, from_email, subject, status, direction, sent_at, created_at, submission_version, attachments")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientRow.id)
        .eq("job_id", jobId)
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      emailRows = (em ?? []) as EmailRow[];
    }

    setClient(clientRow);
    setPacks((pks ?? []) as PackRow[]);
    setLatestReport(rep as any);
    setTemplates((tpls ?? []) as TemplateRow[]);
    setAccounts((accs ?? []) as EmailAccount[]);
    setEmails(emailRows);
    if (clientRow?.contact_email && !toEmail) setToEmail(clientRow.contact_email);
    const def = (accs ?? []).find((a: any) => a.is_default) ?? (accs ?? [])[0];
    if (def && !accountId) setAccountId(def.id);
    setLoading(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [tenantId, jobId, candidateId, user?.id, refreshKey]);

  // Honor prefill: when a history row asks us to re-send, auto-attach and jump to compose.
  useEffect(() => {
    if (!prefillAttachmentId) return;
    if (packs.find(p => p.id === prefillAttachmentId)) {
      setSelectedPackIds([prefillAttachmentId]);
      setTab("compose");
    } else {
      // Pack not in current list yet (just built) — refresh to pick it up.
      refresh();
    }
    /* eslint-disable-next-line */
  }, [prefillAttachmentId, packs]);

  const sentItems = useMemo(() => emails.filter(e => e.status === "sent" || e.status === "sending" || e.direction === "outbound"), [emails]);
  const drafts = useMemo(() => emails.filter(e => e.status === "draft"), [emails]);
  const inbox = useMemo(() => emails.filter(e => e.direction === "inbound"), [emails]);

  async function applyTemplate(id: string) {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    const subst = (s: string) => s
      .replace(/\{\{candidate_name\}\}/g, candidateName)
      .replace(/\{\{job_title\}\}/g, jobTitle)
      .replace(/\{\{client_name\}\}/g, client?.name ?? "")
      .replace(/\{\{contact_name\}\}/g, client?.contact_name ?? "")
      .replace(/\{\{recruiter_name\}\}/g, profile?.full_name ?? "");
    setSubject(subst(t.subject ?? ""));
    setBody(subst(t.body_text ?? ""));
  }

  async function generateAI() {
    setAiBusy(true);
    try {
      // Pull candidate summary + recommendation reason from the latest approved report (if any)
      let candidate_summary: string | undefined;
      let candidate_headline: string | undefined;
      let recommendation_reason: string | undefined;
      try {
        const { data: rep } = await supabase
          .from("client_submission_reports")
          .select("report_data, status, version")
          .eq("tenant_id", tenantId).eq("job_id", jobId).eq("candidate_id", candidateId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        const rd: any = (rep as any)?.report_data ?? {};
        candidate_headline = rd?.header?.headline ?? rd?.snapshot?.headline ?? undefined;
        const strengths: string[] = Array.isArray(rd?.key_strengths) ? rd.key_strengths : [];
        const snapBits = [
          rd?.snapshot?.current_title,
          rd?.snapshot?.current_company,
          rd?.snapshot?.years_experience ? `${rd.snapshot.years_experience} yrs experience` : null,
          rd?.snapshot?.location,
        ].filter(Boolean).join(" · ");
        candidate_summary = [snapBits, strengths.slice(0, 4).map(s => `• ${s}`).join("\n")]
          .filter(Boolean).join("\n") || undefined;
        recommendation_reason = rd?.recommendation?.reasoning
          ?? rd?.recommendation?.summary
          ?? undefined;
      } catch { /* non-fatal */ }

      const attachmentNames = packs
        .filter(p => selectedPackIds.includes(p.id))
        .map(p => p.file_name)
        .filter(Boolean);
      const attachments_summary = attachmentNames.length
        ? attachmentNames.join(", ")
        : "Submission pack (CV + AI assessment report)";

      const { data, error } = await supabase.functions.invoke("ai-compose-email", {
        body: {
          mode: "client_submission",
          is_client_email: true,
          candidate_first_name: candidateName.split(" ")[0],
          candidate_last_name: candidateName.split(" ").slice(1).join(" "),
          job_title: jobTitle,
          company_name: client?.name ?? "",
          client_contact_name: client?.contact_name ?? "",
          recruiter_name: profile?.full_name ?? "Recruiter",
          purpose: "client_submission",
          tone: "professional",
          length: "medium",
          candidate_summary,
          candidate_headline,
          recommendation_reason,
          attachments_summary,
          custom_instructions: aiPrompt || undefined,
        },
      });
      if (error) throw error;
      if ((data?.email_subject || data?.suggested_subject) && !subject) {
        setSubject(data.email_subject || data.suggested_subject);
      }
      if (data?.email_body) setBody(data.email_body);
      toast.success("AI draft generated");
    } catch (e: any) {
      toast.error(e?.message ?? "AI generation failed");
    } finally { setAiBusy(false); }
  }

  function togglePack(id: string) {
    setSelectedPackIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  }

  async function downloadPack(p: PackRow) {
    const { data, error } = await supabase.storage.from("submission-packs")
      .createSignedUrl(p.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error(error?.message ?? "Download failed"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function buildAttachmentsPayload(): Promise<{ name: string; url: string; size?: number; type?: string }[]> {
    const chosen = packs.filter(p => selectedPackIds.includes(p.id));
    const out: { name: string; url: string; size?: number; type?: string }[] = [];
    for (const p of chosen) {
      const { data, error } = await supabase.storage.from("submission-packs")
        .createSignedUrl(p.storage_path, 60 * 60 * 24 * 7);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not sign attachment URL");
      out.push({ name: p.file_name, url: data.signedUrl, size: p.file_size ?? undefined, type: "application/pdf" });
    }
    return out;
  }

  function validate(): string | null {
    if (!client?.id) return "This job has no client linked. Add a client to the job first.";
    if (!toEmail.trim()) return "Recipient email is required";
    if (!subject.trim()) return "Subject is required";
    if (!body.trim()) return "Message body is required";
    return null;
  }

  async function saveDraft() {
    const err = validate();
    if (err && err !== "Recipient email is required") { toast.error(err); return; }
    if (!client?.id) return;
    setSavingDraft(true);
    try {
      const primaryPack = packs.find(p => selectedPackIds.includes(p.id));
      const { error } = await supabase.from("client_emails").insert({
        client_id: client.id,
        tenant_id: tenantId,
        job_id: jobId,
        candidate_id: candidateId,
        from_email: accounts.find(a => a.id === accountId)?.from_email ?? profile?.email ?? "",
        to_email: toEmail,
        subject,
        body_text: body,
        status: "draft",
        from_account_id: accountId || null,
        sent_by: user?.id,
        submission_version: latestReport?.version ?? null,
        submission_pack_file_id: primaryPack?.id ?? null,
        submission_report_id: latestReport?.id ?? null,
        attachments: selectedPackIds.length
          ? packs.filter(p => selectedPackIds.includes(p.id)).map(p => ({ pack_file_id: p.id, file_name: p.file_name, pack_option: p.pack_option }))
          : null,
      });
      if (error) throw error;
      toast.success("Draft saved");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally { setSavingDraft(false); }
  }

  async function resolveClientOrgId(): Promise<string> {
    if (!client?.id) throw new Error("No client linked to this job");
    // 1. Try to find existing client_organizations mapped to this client
    const { data: existing, error: findErr } = await supabase
      .from("client_organizations")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("client_id", client.id)
      .maybeSingle();
    if (findErr) throw findErr;
    if (existing?.id) return existing.id;
    // 2. Otherwise create one
    const { data: created, error: createErr } = await supabase
      .from("client_organizations")
      .insert({
        tenant_id: tenantId,
        client_id: client.id,
        name: client.name,
        is_active: true,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();
    if (createErr) throw createErr;
    return created.id;
  }

  async function upsertSubmission(primaryPackId: string | null): Promise<string> {
    const clientOrgId = await resolveClientOrgId();
    const nowIso = new Date().toISOString();

    const { data: existing, error: findErr } = await supabase
      .from("candidate_submissions")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("job_id", jobId)
      .eq("candidate_id", candidateId)
      .eq("client_org_id", clientOrgId)
      .maybeSingle();
    if (findErr) throw new Error(`Pipeline lookup failed: ${findErr.message}`);

    const preSubmitStatuses = ["draft", "ai_validated", "prepared"];

    if (existing?.id) {
      const patch: Record<string, any> = {
        sent_at: nowIso,
        last_activity_at: nowIso,
        submission_message: body || null,
      };
      // Only advance status forward — never regress an existing pipeline stage
      if (preSubmitStatuses.includes(existing.status as string)) {
        patch.status = "submitted";
        patch.submitted_at = nowIso;
        patch.submitted_by = user?.id ?? null;
      }
      const { error: updErr } = await supabase
        .from("candidate_submissions")
        .update(patch)
        .eq("id", existing.id);
      if (updErr) throw new Error(`Pipeline update failed: ${updErr.message}`);
      return existing.id;
    }

    const { data: inserted, error: insErr } = await supabase
      .from("candidate_submissions")
      .insert({
        tenant_id: tenantId,
        job_id: jobId,
        candidate_id: candidateId,
        client_org_id: clientOrgId,
        status: "submitted",
        submission_message: body || null,
        submitted_by: user?.id ?? null,
        submitted_at: nowIso,
        sent_at: nowIso,
        last_activity_at: nowIso,
        pack_status: primaryPackId ? "ready" : "none",
        pack_components: primaryPackId ? { pack_file_id: primaryPackId } : {},
        structured_notes: {},
      } as any)
      .select("id")
      .single();
    if (insErr) throw new Error(`Pipeline insert failed: ${insErr.message}`);
    return inserted!.id;
  }

  async function send() {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!client?.id) return;
    setSending(true);
    try {
      const attachments = await buildAttachmentsPayload();
      const primaryPack = packs.find(p => selectedPackIds.includes(p.id));

      // 1. Log to client_emails (audit + submission link)
      const { error: insErr } = await supabase.from("client_emails").insert({
        client_id: client.id,
        tenant_id: tenantId,
        job_id: jobId,
        candidate_id: candidateId,
        from_email: accounts.find(a => a.id === accountId)?.from_email ?? profile?.email ?? "",
        to_email: toEmail,
        subject,
        body_text: body,
        status: "sending",
        direction: "outbound",
        from_account_id: accountId || null,
        sent_by: user?.id,
        sent_at: new Date().toISOString(),
        submission_version: latestReport?.version ?? null,
        submission_pack_file_id: primaryPack?.id ?? null,
        submission_report_id: latestReport?.id ?? null,
        attachments: attachments.length
          ? attachments.map((a) => ({
              name: a.name, size: a.size, type: a.type,
              pack_file_id: packs.find(p => selectedPackIds.includes(p.id))?.id,
              pack_option: packs.find(p => p.file_name === a.name)?.pack_option,
            }))
          : null,
      });
      if (insErr) throw insErr;

      // 2. Send via existing edge function
      const { error: sendErr } = await supabase.functions.invoke("send-candidate-email", {
        body: {
          client_id: client.id,
          job_id: jobId,
          candidate_id: candidateId,
          to_email: toEmail,
          cc_email: ccEmail || undefined,
          subject,
          body_text: body,
          from_account_id: accountId || undefined,
          attachments: attachments.length ? attachments : undefined,
          use_system_fallback: true,
        },
      });
      if (sendErr) throw sendErr;

      // 3. CRITICAL — create/update pipeline submission. If this fails, surface the
      // real DB error so a candidate cannot be silently "sent" but missing from the pipeline.
      const submissionId = await upsertSubmission(primaryPack?.id ?? null);

      // 4. Activity log
      await supabase.from("client_activities").insert({
        client_id: client.id,
        tenant_id: tenantId,
        activity_type: "submission_email",
        description: `Candidate submitted to client — ${candidateName} → ${toEmail}`,
        created_by: user?.id,
        metadata: {
          job_id: jobId, candidate_id: candidateId,
          submission_id: submissionId,
          submission_version: latestReport?.version ?? null,
          attachments: attachments.map(a => a.name),
        },
      });

      toast.success(`Submission Created ✓ — Pipeline: Submitted (${submissionId.slice(0, 8)})`);
      setSubject(""); setBody(""); setSelectedPackIds([]); setCcEmail("");
      setTab("sent");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
    } finally { setSending(false); }
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
            <h4 className="font-semibold text-sm">Client Delivery Workspace</h4>
          </div>
          {client ? (
            <Badge variant="secondary" className="text-xs">
              {client.name}{client.contact_email ? ` · ${client.contact_email}` : ""}
            </Badge>
          ) : (
            <Badge variant="outline">No client linked</Badge>
          )}
        </div>

        {loading ? <Skeleton className="h-40" /> : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="compose"><FilePlus2 className="h-3 w-3 mr-1" />Compose</TabsTrigger>
              <TabsTrigger value="inbox"><InboxIcon className="h-3 w-3 mr-1" />Inbox</TabsTrigger>
              <TabsTrigger value="sent"><Send className="h-3 w-3 mr-1" />Sent ({sentItems.length})</TabsTrigger>
              <TabsTrigger value="drafts"><Archive className="h-3 w-3 mr-1" />Drafts ({drafts.length})</TabsTrigger>
              <TabsTrigger value="templates"><FileText className="h-3 w-3 mr-1" />Templates</TabsTrigger>
            </TabsList>

            {/* COMPOSE */}
            <TabsContent value="compose" className="space-y-3 pt-3">
              {accounts.length === 0 && (
                <div className="text-xs p-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
                  No SMTP email account connected. The email will be sent via the system fallback.
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">From</Label>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger><SelectValue placeholder="System default" /></SelectTrigger>
                    <SelectContent>
                      {accounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.display_name} &lt;{a.from_email}&gt;
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Template</Label>
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger><SelectValue placeholder="Apply a template..." /></SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 ? (
                        <SelectItem value="__none__" disabled>No templates yet</SelectItem>
                      ) : templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">To</Label>
                  <Input value={toEmail} onChange={e => setToEmail(e.target.value)} placeholder="client@company.com" />
                </div>
                <div>
                  <Label className="text-xs">Cc</Label>
                  <Input value={ccEmail} onChange={e => setCcEmail(e.target.value)} placeholder="optional" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Subject</Label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder={`Candidate submission: ${candidateName} for ${jobTitle}`} />
              </div>

              {/* Pack attachment picker */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1"><Paperclip className="h-3 w-3" />Attach submission pack</Label>
                {packs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No submission packs yet. Build one above first.</p>
                ) : (
                  <div className="space-y-1">
                    {packs.map(p => (
                      <label key={p.id} className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                        <Checkbox checked={selectedPackIds.includes(p.id)} onCheckedChange={() => togglePack(p.id)} />
                        <Badge variant="outline" className="text-[10px]">{PACK_LABELS[p.pack_option]}</Badge>
                        <span className="truncate flex-1">{p.file_name}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" type="button"
                          onClick={(e) => { e.preventDefault(); downloadPack(p); }}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* AI draft */}
              <div className="border rounded-md p-3 bg-muted/30 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span className="text-xs font-medium">AI Email Draft</span>
                </div>
                <Textarea
                  rows={2}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Optional: any specific angle, tone, or details to emphasise…"
                />
                <Button size="sm" variant="secondary" onClick={generateAI} disabled={aiBusy}>
                  {aiBusy ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Drafting…</> : <><Sparkles className="h-3 w-3 mr-1" />Generate AI draft</>}
                </Button>
              </div>

              <div>
                <Label className="text-xs">Message</Label>
                <Textarea rows={10} value={body} onChange={e => setBody(e.target.value)} placeholder="Write your submission email…" />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={saveDraft} disabled={savingDraft || sending}>
                  {savingDraft ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}Save draft
                </Button>
                <Button onClick={send} disabled={sending || !client?.id}>
                  {sending ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Sending…</> : <><Send className="h-3 w-3 mr-1" />Send to client</>}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="inbox" className="pt-3">
              <EmailList rows={inbox} emptyText="No client replies for this submission yet." />
            </TabsContent>

            <TabsContent value="sent" className="pt-3">
              <EmailList rows={sentItems} emptyText="No emails sent for this submission yet." />
            </TabsContent>

            <TabsContent value="drafts" className="pt-3">
              <EmailList rows={drafts} emptyText="No saved drafts." />
            </TabsContent>

            <TabsContent value="templates" className="pt-3">
              {templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No templates yet. Create reusable templates from your Email settings.
                </p>
              ) : (
                <div className="space-y-1">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => { applyTemplate(t.id); setTab("compose"); }}
                      className="w-full text-left border rounded-md px-3 py-2 hover:bg-muted/50">
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
                    </button>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

function EmailList({ rows, emptyText }: { rows: EmailRow[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground py-4 text-center">{emptyText}</p>;
  return (
    <div className="space-y-1.5">
      {rows.map(r => {
        const atts = Array.isArray(r.attachments) ? r.attachments : [];
        return (
          <div key={r.id} className="border rounded-md px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium truncate">{r.subject}</div>
              <span className="text-[10px] text-muted-foreground shrink-0">
                {new Date(r.sent_at ?? r.created_at).toLocaleString()}
              </span>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
              <span>To: {r.to_email}</span>
              {r.submission_version != null && <Badge variant="outline" className="text-[10px]">v{r.submission_version}</Badge>}
              {r.status && <Badge variant="secondary" className="text-[10px]">{r.status}</Badge>}
              {atts.length > 0 && <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{atts.length}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
