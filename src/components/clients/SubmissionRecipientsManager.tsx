import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Eye, CheckCircle2, X, CalendarClock, UserPlus, Trash2, Mail, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Props {
  submissionId: string;
  tenantId: string;
  clientOrgId: string;
}

const ROLE_PRESETS = [
  { id: "hiring_manager", label: "Hiring Manager", perms: { approve_reject: true, request_interviews: true, leave_feedback: true } },
  { id: "hr",             label: "HR / Talent",    perms: { approve_reject: false, request_interviews: true, leave_feedback: true } },
  { id: "panel",          label: "Interview Panel",perms: { approve_reject: false, request_interviews: false, leave_feedback: true } },
  { id: "decision",       label: "Decision Maker", perms: { approve_reject: true, request_interviews: true, leave_feedback: true } },
];

export function SubmissionRecipientsManager({ submissionId, tenantId, clientOrgId }: Props) {
  const [recipients, setRecipients] = useState<any[] | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"client_user" | "hiring_manager">("hiring_manager");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [preset, setPreset] = useState("hiring_manager");

  const load = async () => {
    const [{ data: recs }, { data: portalUsers }] = await Promise.all([
      supabase.from("submission_recipients" as any)
        .select("*, user:client_user_id ( id ), portal:client_user_id ( id )")
        .eq("submission_id", submissionId),
      supabase.from("client_portal_users")
        .select("user_id, full_name, email, title, role")
        .eq("client_org_id", clientOrgId)
        .eq("is_active", true),
    ]);
    setUsers(portalUsers ?? []);
    // Enrich recipients with user info
    const enriched = (recs ?? []).map((r: any) => ({
      ...r,
      user: (portalUsers ?? []).find((u: any) => u.user_id === r.client_user_id),
    }));
    setRecipients(enriched);
  };

  useEffect(() => { load(); }, [submissionId, clientOrgId]);

  const addRecipient = async () => {
    if (!selectedUser) return;
    const presetObj = ROLE_PRESETS.find(p => p.id === preset)!;
    const { error } = await supabase.from("submission_recipients" as any).insert({
      submission_id: submissionId,
      tenant_id: tenantId,
      client_org_id: clientOrgId,
      client_user_id: selectedUser,
    });
    if (error) { toast.error(error.message); return; }
    // Upsert permissions for this user
    await supabase.from("client_user_permissions" as any).upsert({
      client_user_id: selectedUser,
      client_org_id: clientOrgId,
      tenant_id: tenantId,
      ...presetObj.perms,
    }, { onConflict: "client_user_id,client_org_id" } as any);
    toast.success("Recipient added");
    setAdding(false);
    setSelectedUser("");
    load();
  };

  const removeRecipient = async (id: string) => {
    const { error } = await supabase.from("submission_recipients" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  if (recipients === null) {
    return <div className="space-y-2">{[1,2].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  const available = users.filter(u => !recipients.some((r: any) => r.client_user_id === u.user_id));

  return (
    <div className="space-y-3">
      {recipients.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No recipients yet. Add client contacts so they receive this submission.
          </CardContent>
        </Card>
      )}

      {recipients.map((r: any) => {
        const u = r.user;
        const initials = (u?.full_name || u?.email || "?").split(" ").map((p: string) => p[0]).slice(0,2).join("").toUpperCase();
        return (
          <Card key={r.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <Avatar className="h-9 w-9"><AvatarFallback className="bg-primary/10 text-primary">{initials}</AvatarFallback></Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{u?.full_name || u?.email || "Unknown contact"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{u?.title || u?.role || u?.email}</div>
              </div>
              <div className="flex items-center gap-1.5">
                {r.viewed_at && <Badge variant="outline" className="text-[10px] gap-1"><Eye className="h-3 w-3" /> Viewed</Badge>}
                {r.decision === "approved" && <Badge className="text-[10px] gap-1 bg-emerald-500/15 text-emerald-700 border-transparent"><CheckCircle2 className="h-3 w-3"/> Approved</Badge>}
                {r.decision === "rejected" && <Badge className="text-[10px] gap-1 bg-destructive/10 text-destructive border-transparent"><X className="h-3 w-3"/> Rejected</Badge>}
                {r.decision === "requested_interview" && <Badge className="text-[10px] gap-1 bg-indigo-500/10 text-indigo-700 border-transparent"><CalendarClock className="h-3 w-3"/> Interview</Badge>}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeRecipient(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {adding ? (
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Client contact</label>
              <select className="w-full h-9 rounded-md border bg-background px-2 text-sm"
                value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                <option value="">Select…</option>
                {available.map((u: any) => (
                  <option key={u.user_id} value={u.user_id}>{u.full_name || u.email}{u.title ? ` · ${u.title}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Role preset</label>
              <div className="grid grid-cols-2 gap-1.5">
                {ROLE_PRESETS.map(p => (
                  <button key={p.id} type="button"
                    onClick={() => setPreset(p.id)}
                    className={`text-xs px-2 py-1.5 rounded border text-left ${preset === p.id ? "bg-primary/10 border-primary text-primary" : "border-border hover:bg-muted"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" onClick={addRecipient} disabled={!selectedUser}>Add</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setAdding(true)} disabled={!available.length}>
          <UserPlus className="h-4 w-4 mr-2" />
          {available.length ? "Add Recipient" : "All contacts added"}
        </Button>
      )}
    </div>
  );
}
