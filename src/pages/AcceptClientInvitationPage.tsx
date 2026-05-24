import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/brand/Logo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function AcceptClientInvitationPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: '', password: '', confirm: '' });

  useEffect(() => {
    (async () => {
      if (!token) { setError('Invalid invitation link'); setLoading(false); return; }
      const { data, error } = await supabase.rpc('get_client_invitation_by_token', { p_token: token });
      if (error || !data || !data.length) {
        setError('This invitation is invalid or has expired.');
      } else {
        setInvite(data[0]);
      }
      setLoading(false);
    })();
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error('Enter your full name');
    if (form.password.length < 8) return toast.error('Password must be 8+ characters');
    if (form.password !== form.confirm) return toast.error('Passwords do not match');

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('accept-client-invitation', {
        body: { token, full_name: form.full_name.trim(), password: form.password },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Failed');

      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: invite.email, password: form.password,
      });
      if (signErr) {
        toast.success('Account created. Please sign in.');
        navigate('/auth');
        return;
      }
      toast.success('Welcome to the Client Portal!');
      navigate('/client/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invitation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invitation</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/auth')}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><Logo size="lg" /></div>
          <CardTitle>Join the Client Portal</CardTitle>
          <CardDescription>
            You've been invited as a <strong>{invite?.role === 'hiring_manager' ? 'Hiring Manager' : 'Client User'}</strong>. Create your account to start collaborating.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={invite?.email} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" required />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating Account...</> : <><CheckCircle className="h-4 w-4 mr-2" />Accept & Enter Portal</>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
