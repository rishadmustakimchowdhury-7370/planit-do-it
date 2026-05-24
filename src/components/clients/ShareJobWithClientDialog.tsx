import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Send, Building2, UserPlus } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobId: string;
  jobTitle: string;
}

export function ShareJobWithClientDialog({ open, onOpenChange, jobId, jobTitle }: Props) {
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [orgId, setOrgId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'client_user' | 'hiring_manager'>('hiring_manager');
  const [perms, setPerms] = useState({ pipeline: true, interview: true, feedback: true, message: true });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase.from('client_organizations').select('id, name').eq('is_active', true).order('name');
      setOrgs(data || []);
      if (data && data.length) { setMode('existing'); setOrgId(data[0].id); }
      else setMode('new');
    })();
  }, [open]);

  const handleSubmit = async () => {
    setBusy(true);
    try {
      let targetOrgId = orgId;

      // 1) Invite + create org if needed
      if (mode === 'new') {
        if (!orgName.trim() || !email.trim()) {
          toast.error('Organisation name and email are required');
          setBusy(false); return;
        }
        const { data, error } = await supabase.functions.invoke('invite-client-user', {
          body: { org_name: orgName.trim(), email: email.trim(), role },
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'Invite failed');
        targetOrgId = data.client_org_id;
      } else if (email.trim()) {
        const { data, error } = await supabase.functions.invoke('invite-client-user', {
          body: { client_org_id: targetOrgId, email: email.trim(), role },
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'Invite failed');
      }

      if (!targetOrgId) { toast.error('Select a client organisation'); setBusy(false); return; }

      // 2) Create job share
      const { error: shareErr } = await supabase.from('job_client_shares').upsert({
        job_id: jobId,
        client_org_id: targetOrgId,
        can_view_pipeline: perms.pipeline,
        can_request_interview: perms.interview,
        can_leave_feedback: perms.feedback,
        can_message: perms.message,
        shared_by: (await supabase.auth.getUser()).data.user?.id,
      }, { onConflict: 'job_id,client_org_id' });
      if (shareErr) throw shareErr;

      toast.success(email ? 'Job shared and invitation sent' : 'Job shared with client');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to share');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share with Client</DialogTitle>
          <DialogDescription>Give a client visibility into <strong>{jobTitle}</strong>.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={mode === 'existing' ? 'default' : 'outline'} onClick={() => setMode('existing')} disabled={!orgs.length}>
              <Building2 className="w-4 h-4 mr-1" /> Existing client
            </Button>
            <Button type="button" size="sm" variant={mode === 'new' ? 'default' : 'outline'} onClick={() => setMode('new')}>
              <UserPlus className="w-4 h-4 mr-1" /> New client
            </Button>
          </div>

          {mode === 'existing' ? (
            <div className="space-y-2">
              <Label>Client organisation</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Client organisation name</Label>
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Corp" />
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <Label>Invite a contact (optional for existing clients)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="hiring.manager@client.com" />
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                <SelectItem value="client_user">Client User</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Permissions</Label>
            {[
              ['pipeline', 'View pipeline'],
              ['interview', 'Request interviews'],
              ['feedback', 'Leave feedback'],
              ['message', 'Send messages'],
            ].map(([k, label]) => (
              <div key={k} className="flex items-center gap-2">
                <Checkbox checked={(perms as any)[k]} onCheckedChange={(v) => setPerms({ ...perms, [k]: !!v })} />
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Share
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
