import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, UserPlus, Loader2 } from 'lucide-react';

export default function AdminClientPortalPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState({ org_id: '', org_name: '', email: '', role: 'hiring_manager' as 'hiring_manager' | 'client_user' });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: o }, { data: u }, { data: i }] = await Promise.all([
      supabase.from('client_organizations').select('*').order('created_at', { ascending: false }),
      supabase.from('client_portal_users').select('*, profiles:user_id(full_name, email)').order('created_at', { ascending: false }),
      supabase.from('client_invitations').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setOrgs(o || []);
    setUsers(u || []);
    setInvitations(i || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const submitInvite = async () => {
    if (!form.email.trim() || !form.email.includes('@')) return toast.error('Enter a valid email');
    if (!form.org_id && !form.org_name.trim()) return toast.error('Select or name a client organisation');
    setBusy(true);
    try {
      const body: any = { email: form.email.trim(), role: form.role };
      if (form.org_id) body.client_org_id = form.org_id;
      else body.org_name = form.org_name.trim();
      const { data, error } = await supabase.functions.invoke('invite-client-user', { body });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed');
      toast.success('Invitation sent');
      setInviteOpen(false);
      setForm({ org_id: '', org_name: '', email: '', role: 'hiring_manager' });
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to invite');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Client Portal</h1>
            <p className="text-muted-foreground text-sm">Manage external client organisations and their users.</p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />Invite Client
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="w-5 h-5" />Client Organisations</CardTitle>
            <CardDescription>External companies you collaborate with.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Loader2 className="animate-spin" /> : (
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Active</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                <TableBody>
                  {orgs.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No client organisations yet</TableCell></TableRow>}
                  {orgs.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell><Badge variant={o.is_active ? 'default' : 'secondary'}>{o.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Portal Users</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {users.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No portal users yet</TableCell></TableRow>}
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell>{u.profiles?.full_name || '—'}</TableCell>
                    <TableCell>{u.profiles?.email}</TableCell>
                    <TableCell><Badge variant="outline">{u.role}</Badge></TableCell>
                    <TableCell><Badge variant={u.is_active ? 'default' : 'secondary'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Invitations</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
              <TableBody>
                {invitations.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No invitations</TableCell></TableRow>}
                {invitations.map(i => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell><Badge variant="outline">{i.role}</Badge></TableCell>
                    <TableCell><Badge variant={i.status === 'accepted' ? 'default' : i.status === 'pending' ? 'secondary' : 'destructive'}>{i.status}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{new Date(i.expires_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Invite Client User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Existing Organisation</Label>
              <Select value={form.org_id} onValueChange={(v) => setForm({ ...form, org_id: v, org_name: '' })}>
                <SelectTrigger><SelectValue placeholder="Select or create new below" /></SelectTrigger>
                <SelectContent>
                  {orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {!form.org_id && (
              <div className="space-y-2">
                <Label>Or create new organisation</Label>
                <Input value={form.org_name} onChange={(e) => setForm({ ...form, org_name: e.target.value })} placeholder="Acme Corp" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contact@client.com" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hiring_manager">Hiring Manager</SelectItem>
                  <SelectItem value="client_user">Client User</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submitInvite} disabled={busy}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Send Invitation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
