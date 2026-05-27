// Recruiter Workflow Optimization — Phase 2 (Communication Layer)
// Embedded communication drawer for a single candidate ↔ client thread.
// Reuses the existing `generate-client-comms` edge function so AI replies
// stay recruiter-grade (tone tuned in the function) instead of chatbot-ish.
// Email tab: open via mailto for now (no extra infra). WhatsApp tab: wa.me
// click-to-chat (no Twilio account required). Templates tab: per-recruiter
// snippets in localStorage (DB-backed templates land in the next phase).

import { useState, useMemo, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, MessageSquare, Sparkles, Copy, Send, Phone } from "lucide-react";
import { toast } from "sonner";
import {
  useGenerateClientComms,
  type ClientCommType,
} from "@/hooks/useRecruiterCopilot";

const TEMPLATES_KEY = "hm.recruiterTemplates.v1";

interface PersonalTemplate {
  id: string;
  label: string;
  body: string;
}

function loadTemplates(): PersonalTemplate[] {
  try {
    const raw = window.localStorage.getItem(TEMPLATES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PersonalTemplate[];
  } catch {
    return [];
  }
}
function saveTemplates(list: PersonalTemplate[]) {
  try {
    window.localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
  } catch {}
}

const COMM_TYPES: { value: ClientCommType; label: string }[] = [
  { value: "submission_summary",   label: "Submission summary" },
  { value: "positioning_note",     label: "Positioning note" },
  { value: "interview_scheduling", label: "Interview scheduling" },
  { value: "follow_up",            label: "Follow-up nudge" },
  { value: "objection_response",   label: "Objection response" },
];

export interface CommunicationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  candidateId: string;
  candidateName?: string;
  clientName?: string;
  /** Optional default recipient email / phone to prefill the action buttons. */
  defaultEmail?: string | null;
  defaultPhone?: string | null;
}

export function CommunicationDrawer({
  open,
  onOpenChange,
  jobId,
  candidateId,
  candidateName,
  clientName,
  defaultEmail,
  defaultPhone,
}: CommunicationDrawerProps) {
  const [tab, setTab] = useState<"email" | "whatsapp" | "templates">("email");
  const [type, setType] = useState<ClientCommType>("submission_summary");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipient, setRecipient] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [objection, setObjection] = useState("");
  const [templates, setTemplates] = useState<PersonalTemplate[]>([]);

  useEffect(() => { if (open) setTemplates(loadTemplates()); }, [open]);
  useEffect(() => { setRecipient(defaultEmail ?? ""); }, [defaultEmail]);
  useEffect(() => { setPhone(defaultPhone ?? ""); }, [defaultPhone]);

  const generate = useGenerateClientComms();

  const handleGenerate = async () => {
    const result = await generate.mutateAsync({
      jobId,
      candidateId,
      type,
      objection: type === "objection_response" ? objection : undefined,
    });
    if (result.subject) setSubject(result.subject);
    setBody(result.body);
  };

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const mailtoHref = useMemo(() => {
    const to = encodeURIComponent(recipient || "");
    const s = encodeURIComponent(subject || "");
    const b = encodeURIComponent(body || "");
    return `mailto:${to}?subject=${s}&body=${b}`;
  }, [recipient, subject, body]);

  const waHref = useMemo(() => {
    const digits = (phone || "").replace(/[^0-9]/g, "");
    const text = encodeURIComponent(body || "");
    return digits ? `https://wa.me/${digits}?text=${text}` : null;
  }, [phone, body]);

  const saveAsTemplate = () => {
    if (!body.trim()) return;
    const label = window.prompt("Template name?", `${type} – ${new Date().toLocaleDateString()}`);
    if (!label) return;
    const next = [
      ...templates,
      { id: crypto.randomUUID(), label, body },
    ];
    setTemplates(next);
    saveTemplates(next);
    toast.success("Template saved");
  };

  const applyTemplate = (t: PersonalTemplate) => {
    setBody(t.body);
    setTab("email");
  };

  const deleteTemplate = (id: string) => {
    const next = templates.filter(t => t.id !== id);
    setTemplates(next);
    saveTemplates(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Communication
          </SheetTitle>
          <SheetDescription className="text-xs">
            {candidateName && <span className="font-medium text-foreground">{candidateName}</span>}
            {candidateName && clientName && <span> · </span>}
            {clientName && <span>{clientName}</span>}
            <span className="block mt-1 text-muted-foreground/80">
              Recruiter-grade drafts. You always edit and send.
            </span>
          </SheetDescription>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-5 mt-3 grid w-auto grid-cols-3">
            <TabsTrigger value="email" className="text-xs"><Mail className="h-3.5 w-3.5 mr-1" /> Email</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs"><Phone className="h-3.5 w-3.5 mr-1" /> WhatsApp</TabsTrigger>
            <TabsTrigger value="templates" className="text-xs">Templates</TabsTrigger>
          </TabsList>

          {/* ===== EMAIL ===== */}
          <TabsContent value="email" className="flex-1 overflow-y-auto px-5 py-4 space-y-3 mt-0">
            <div className="space-y-1.5">
              <Label className="text-xs">Message intent</Label>
              <div className="flex flex-wrap gap-1.5">
                {COMM_TYPES.map(t => (
                  <Badge
                    key={t.value}
                    variant={type === t.value ? "default" : "outline"}
                    className="cursor-pointer text-[11px]"
                    onClick={() => setType(t.value)}
                  >
                    {t.label}
                  </Badge>
                ))}
              </div>
            </div>

            {type === "objection_response" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Client objection</Label>
                <Textarea
                  rows={2}
                  placeholder="e.g. Concerned about industry experience…"
                  value={objection}
                  onChange={(e) => setObjection(e.target.value)}
                />
              </div>
            )}

            <Button
              size="sm"
              variant="secondary"
              className="w-full"
              onClick={handleGenerate}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-2" />
              )}
              Draft with Recruiter Copilot
            </Button>

            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input
                type="email"
                placeholder="client@example.com"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Body</Label>
              <Textarea
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Draft your message, or generate a starting point with Recruiter Copilot."
              />
              <p className="text-[10px] text-muted-foreground">
                Tone: executive search-grade. Always recruiter-reviewed before sending.
              </p>
            </div>
          </TabsContent>

          {/* ===== WHATSAPP ===== */}
          <TabsContent value="whatsapp" className="flex-1 overflow-y-auto px-5 py-4 space-y-3 mt-0">
            <div className="space-y-1.5">
              <Label className="text-xs">Phone (E.164)</Label>
              <Input
                placeholder="+447700900123"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Message</Label>
              <Textarea
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Short, professional WhatsApp note."
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Opens WhatsApp Web / mobile app via click-to-chat. Recruiter sends from their own account.
            </p>
          </TabsContent>

          {/* ===== TEMPLATES ===== */}
          <TabsContent value="templates" className="flex-1 overflow-y-auto px-5 py-4 space-y-2 mt-0">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">Personal templates</div>
              <Button size="sm" variant="outline" onClick={saveAsTemplate} disabled={!body.trim()}>
                Save current as template
              </Button>
            </div>
            {templates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">
                No templates yet. Save a draft you'll reuse — it stays on this device.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {templates.map(t => (
                  <li key={t.id} className="border rounded-md p-2 text-xs flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.label}</div>
                      <div className="text-muted-foreground line-clamp-2">{t.body}</div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => applyTemplate(t)}>Use</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTemplate(t.id)}>×</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer actions */}
        <div className="border-t px-5 py-3 flex items-center justify-between gap-2 bg-muted/20">
          <Button variant="ghost" size="sm" onClick={copyBody} disabled={!body.trim()}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
          </Button>
          {tab === "whatsapp" ? (
            <Button asChild size="sm" disabled={!waHref || !body.trim()}>
              <a href={waHref ?? "#"} target="_blank" rel="noreferrer">
                <Send className="h-3.5 w-3.5 mr-1.5" /> Open WhatsApp
              </a>
            </Button>
          ) : (
            <Button asChild size="sm" disabled={!recipient || !body.trim()}>
              <a href={mailtoHref}>
                <Send className="h-3.5 w-3.5 mr-1.5" /> Open in email client
              </a>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
