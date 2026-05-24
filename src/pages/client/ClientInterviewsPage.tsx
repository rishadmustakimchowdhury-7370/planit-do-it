import { useEffect, useState } from 'react';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { CalendarClock, Video, Phone, MapPin, ExternalLink } from 'lucide-react';
import { format as fmt } from 'date-fns';

const fmtIcon = (t: string) => t === 'phone' ? Phone : t === 'in_person' || t === 'onsite' ? MapPin : Video;
const reqIcon = (t: string) => t === 'phone' ? Phone : t === 'onsite' ? MapPin : Video;

export default function ClientInterviewsPage() {
  const { clientPortal } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!clientPortal?.client_org_id) return;
    (async () => {
      setLoading(true);
      const [reqRes, evRes] = await Promise.all([
        supabase
          .from('interview_requests' as any)
          .select('*')
          .eq('client_org_id', clientPortal.client_org_id)
          .order('created_at', { ascending: false }),
        supabase
          .from('events')
          .select('id, title, start_time, end_time, timezone, location_type, meeting_link, status, interview_request_id')
          .order('start_time', { ascending: true }),
      ]);
      // Filter events: only those tied to a request from this org
      const orgReqIds = new Set((reqRes.data as any[] || []).map(r => r.id));
      setRequests((reqRes.data as any[]) || []);
      setEvents((evRes.data || []).filter(e => e.interview_request_id && orgReqIds.has(e.interview_request_id)));
      setLoading(false);
    })();

    const ch = supabase.channel(`client-interviews-${clientPortal.client_org_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'interview_requests', filter: `client_org_id=eq.${clientPortal.client_org_id}` }, () => {
        // refetch
        supabase.from('interview_requests' as any).select('*').eq('client_org_id', clientPortal.client_org_id)
          .order('created_at', { ascending: false }).then(({ data }) => setRequests((data as any[]) || []));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [clientPortal?.client_org_id]);

  const upcoming = events.filter(e => new Date(e.end_time) >= new Date());
  const past = events.filter(e => new Date(e.end_time) < new Date());
  const pending = requests.filter(r => r.status === 'pending');

  return (
    <ClientLayout title="Interviews" subtitle="Requests, confirmations and upcoming sessions">
      {loading ? <Skeleton className="h-64 w-full" /> : (
        <div className="space-y-8">
          <section>
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">Upcoming</h3>
            {upcoming.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                <CalendarClock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No upcoming interviews scheduled.
              </CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {upcoming.map(ev => {
                  const Icon = fmtIcon(ev.location_type);
                  return (
                    <Card key={ev.id}>
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">{ev.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {fmt(new Date(ev.start_time), 'EEE, MMM d · p')} ({ev.timezone})
                            </div>
                          </div>
                        </div>
                        {ev.meeting_link && (
                          <a href={ev.meeting_link} target="_blank" rel="noopener noreferrer"
                             className="text-xs text-primary hover:underline flex items-center gap-1">
                            Join <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">Pending requests</h3>
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests awaiting recruiter confirmation.</p>
            ) : (
              <div className="grid gap-3">
                {pending.map(r => {
                  const Icon = reqIcon(r.meeting_format);
                  return (
                    <Card key={r.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" /> {r.duration_minutes}m {r.meeting_format}</span>
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-200">Awaiting confirmation</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-muted-foreground">
                        Proposed: {(r.proposed_slots || []).map((s: any) => fmt(new Date(s.start_time), 'MMM d p')).join(' · ')}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-3 uppercase tracking-wide text-muted-foreground">Past</h3>
              <div className="grid gap-2">
                {past.map(ev => (
                  <Card key={ev.id}><CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm">{ev.title}</span>
                    <span className="text-xs text-muted-foreground">{fmt(new Date(ev.start_time), 'PP')}</span>
                  </CardContent></Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </ClientLayout>
  );
}
