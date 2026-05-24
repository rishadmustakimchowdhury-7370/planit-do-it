import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Check, Link2, Loader2, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shareId: string;
  existingToken?: string | null;
  existingExpiresAt?: string | null;
  onUpdated?: () => void;
}

const EXPIRY_OPTIONS = [
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '0', label: 'Never expires' },
];

function makeToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export function PublicShareDialog({ open, onOpenChange, shareId, existingToken, existingExpiresAt, onUpdated }: Props) {
  const [token, setToken] = useState<string | null>(existingToken || null);
  const [expiry, setExpiry] = useState('7');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = token ? `${window.location.origin}/share/candidate/${token}` : '';

  const generate = async () => {
    setBusy(true);
    try {
      const t = makeToken();
      const days = parseInt(expiry, 10);
      const expires = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
      const { error } = await supabase
        .from('candidate_client_shares')
        .update({ public_share_token: t, public_share_expires_at: expires })
        .eq('id', shareId);
      if (error) throw error;
      setToken(t);
      toast.success('Public link ready');
      onUpdated?.();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const revoke = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('candidate_client_shares')
        .update({ public_share_token: null, public_share_expires_at: null })
        .eq('id', shareId);
      if (error) throw error;
      setToken(null);
      toast.success('Link revoked');
      onUpdated?.();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Public share link
          </DialogTitle>
          <DialogDescription>
            Anyone with this link can view a sanitized candidate profile — no login required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {!token ? (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Link expires after</Label>
                <Select value={expiry} onValueChange={setExpiry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPIRY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={generate} disabled={busy} className="w-full">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Generate link
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Shareable URL</Label>
                <div className="flex gap-2">
                  <Input value={url} readOnly className="text-xs font-mono" />
                  <Button size="icon" variant="outline" onClick={copy}>
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                {existingExpiresAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Expires {new Date(existingExpiresAt).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={generate} disabled={busy} className="flex-1">
                  <RotateCw className="h-3.5 w-3.5 mr-2" /> Regenerate
                </Button>
                <Button variant="outline" size="sm" onClick={revoke} disabled={busy} className="flex-1 text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Revoke
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
