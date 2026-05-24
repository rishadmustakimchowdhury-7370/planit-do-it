import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Activity, Bell, MessageSquare, Calendar, Star, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const iconFor = (type: string) => {
  if (type.includes('discussion')) return MessageSquare;
  if (type.includes('interview')) return Calendar;
  if (type.includes('feedback')) return Star;
  if (type.includes('job')) return Briefcase;
  return Bell;
};

export function ClientActivityFeed({ limit = 8 }: { limit?: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, link, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`client-feed-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" /> Recent Activity
        </h3>
        <button onClick={() => navigate('/client/notifications')} className="text-xs text-primary hover:underline">
          View all
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-6 text-xs text-muted-foreground">
          <Bell className="h-6 w-6 mx-auto mb-2 opacity-40" />
          No activity yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map(n => {
            const Icon = iconFor(n.type);
            return (
              <li key={n.id}>
                <button
                  onClick={() => n.link && navigate(n.link)}
                  className={cn(
                    'w-full text-left flex gap-3 p-2 rounded-lg hover:bg-muted/40 transition',
                    !n.is_read && 'bg-primary/5'
                  )}
                >
                  <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                    !n.is_read ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium truncate">{n.title}</p>
                      {!n.is_read && <Badge variant="secondary" className="h-3.5 text-[9px] px-1">New</Badge>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
