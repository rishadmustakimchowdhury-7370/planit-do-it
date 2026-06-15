import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Search, UserPlus, Building2, CalendarCheck, Trophy, Loader2, Lock } from 'lucide-react';

interface Metrics {
  searches: number;
  leadsSaved: number;
  companiesSaved: number;
  meetings: number;
  clientsWon: number;
}

const ZERO: Metrics = { searches: 0, leadsSaved: 0, companiesSaved: 0, meetings: 0, clientsWon: 0 };

export default function LeadAnalyticsPage() {
  const { user, tenantId, isOwner, isManager, isRecruiter, isSuperAdmin } = useAuth();
  const [metrics, setMetrics] = useState<Metrics>(ZERO);
  const [loading, setLoading] = useState(true);

  const recruiterOnly = isRecruiter && !isOwner && !isManager;

  useEffect(() => {
    (async () => {
      if (!tenantId || !user || isSuperAdmin) { setLoading(false); return; }
      setLoading(true);

      const count = async (table: string, build: (q: ReturnType<typeof supabase.from>) => unknown) => {
        let q = supabase.from(table as 'lead_contacts').select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId).is('deleted_at', null);
        if (recruiterOnly && (table === 'lead_contacts' || table === 'lead_companies')) {
          q = q.eq('assigned_to', user.id);
        }
        const built = build(q) as typeof q;
        const { count: c } = await built;
        return c ?? 0;
      };

      // Searches: lead_search_history (recruiter sees own)
      let sq = supabase.from('lead_search_history').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId);
      if (recruiterOnly) sq = sq.eq('searched_by', user.id);
      const [{ count: searches }, leadsSaved, companiesSaved, meetings, clientsWon] = await Promise.all([
        sq,
        count('lead_contacts', (q) => q),
        count('lead_companies', (q) => q),
        count('lead_contacts', (q) => (q as ReturnType<typeof supabase.from>).eq('status', 'meeting_booked')),
        count('lead_contacts', (q) => (q as ReturnType<typeof supabase.from>).eq('status', 'client_won')),
      ]);

      setMetrics({
        searches: searches ?? 0,
        leadsSaved,
        companiesSaved,
        meetings,
        clientsWon,
      });
      setLoading(false);
    })();
  }, [tenantId, user, recruiterOnly, isSuperAdmin]);

  if (isSuperAdmin) {
    return (
      <AppLayout>
        <div className="max-w-xl mx-auto p-8">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="w-5 h-5" /> Not available</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Lead Intelligence analytics are not part of Super Admin operations.</p></CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const cards = [
    { label: 'Searches', value: metrics.searches, icon: Search, color: 'text-blue-500' },
    { label: 'Leads Saved', value: metrics.leadsSaved, icon: UserPlus, color: 'text-violet-500' },
    { label: 'Companies Saved', value: metrics.companiesSaved, icon: Building2, color: 'text-amber-500' },
    { label: 'Meetings Booked', value: metrics.meetings, icon: CalendarCheck, color: 'text-emerald-500' },
    { label: 'Clients Won', value: metrics.clientsWon, icon: Trophy, color: 'text-rose-500' },
  ];

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Lead Intelligence Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {recruiterOnly ? 'Showing your assigned leads only.' : 'Tenant-wide metrics across all team members.'}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{c.value.toLocaleString()}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Conversion funnel</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <FunnelRow label="Searches" value={metrics.searches} total={metrics.searches} />
              <FunnelRow label="Leads Saved" value={metrics.leadsSaved} total={metrics.searches || metrics.leadsSaved} />
              <FunnelRow label="Meetings Booked" value={metrics.meetings} total={metrics.leadsSaved || 1} />
              <FunnelRow label="Clients Won" value={metrics.clientsWon} total={metrics.meetings || metrics.leadsSaved || 1} />
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function FunnelRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span>{label}</span>
        <span className="text-muted-foreground">{value.toLocaleString()} ({pct}%)</span>
      </div>
      <div className="h-2 bg-muted rounded overflow-hidden">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
