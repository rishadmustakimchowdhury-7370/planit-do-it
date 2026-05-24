import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, CalendarClock } from 'lucide-react';

interface Slot {
  start_time: string; // ISO local datetime-local value
  end_time?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobCandidateId: string;
  jobId: string;
  candidateName?: string;
  onCreated?: () => void;
}

export function RequestInterviewDialog({ open, onOpenChange, jobCandidateId, jobId, candidateName, onCreated }: Props) {
  const { user, clientPortal } = useAuth();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [format, setFormat] = useState<'video' | 'phone' | 'onsite'>('video');
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState<Slot[]>([{ start_time: '' }]);
  const [saving, setSaving] = useState(false);

  const setSlot = (i: number, val: string) => {
    const next = [...slots];
    next[i] = { start_time: val };
    setSlots(next);
  };
  const addSlot = () => slots.length < 5 && setSlots([...slots, { start_time: '' }]);
  const removeSlot = (i: number) => setSlots(slots.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!user || !clientPortal) return;
    const valid = slots.filter(s => s.start_time);
    if (!valid.length) return toast.error('Add at least one proposed time slot.');
    setSaving(true);
    try {
      const payload = valid.map(s => {
        const start = new Date(s.start_time);
        const end = new Date(start.getTime() + duration * 60_000);
        return { start_time: start.toISOString(), end_time: end.toISOString(), timezone: tz };
      });
      const { error } = await supabase.from('interview_requests' as any).insert({
        tenant_id: clientPortal.tenant_id,
        client_org_id: clientPortal.client_org_id,
        job_id: jobId,
        job_candidate_id: jobCandidateId,
        requested_by: user.id,
        meeting_format: format,
        duration_minutes: duration,
        proposed_slots: payload,
        client_notes: notes || null,
      });
      if (error) throw error;
      toast.success('Interview requested — your recruiter has been notified.');
      onCreated?.();
      onOpenChange(false);
      setSlots([{ start_time: '' }]);
      setNotes('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to create request');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" style={{ fontFamily: "'Poppins', sans-serif" }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Request Interview
          </DialogTitle>
          <DialogDescription>
            Propose times for {candidateName || 'this candidate'}. Your recruiter will confirm one slot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v: any) => setFormat(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video call</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="onsite">On-site</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[15, 30, 45, 60, 90].map(n => <SelectItem key={n} value={String(n)}>{n} minutes</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Proposed time slots <span className="text-xs text-muted-foreground">({tz})</span></Label>
            {slots.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  type="datetime-local"
                  value={s.start_time}
                  onChange={e => setSlot(i, e.target.value)}
                  className="flex-1"
                />
                {slots.length > 1 && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeSlot(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {slots.length < 5 && (
              <Button type="button" size="sm" variant="ghost" onClick={addSlot} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add another slot
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Notes for the recruiter (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any context, panel members, prep, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
