import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClientLayout } from '@/components/client/ClientLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Check, MessageSquare, Calendar, Star, Briefcase, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

export default function ClientNotificationsPage() {
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
      .limit(100);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`client-notif-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);
    if (error) return toast.error(error.message);
    toast.success('All caught up');
    load();
  };

  const open = async (n: Notification) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', n.id);
    }
    if (n.link) navigate(n.link);
  };

  const unread = items.filter(i => !i.is_read).length;

  return (
    <ClientLayout title="Notifications" subtitle={unread ? `${unread} unread` : 'Updates from your recruiter'}>
      <div className="flex justify-end mb-3">
        <Button size="sm" variant="outline" onClick={markAllRead} disabled={!unread}>
          <CheckCheck className="h-3.5 w-3.5 mr-2" /> Mark all read
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">You're all caught up.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {items.map(n => {
              const Icon = iconFor(n.type);
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={cn(
                    'w-full text-left p-4 flex gap-3 hover:bg-muted/40 transition',
                    !n.is_read && 'bg-primary/5'
                  )}
                >
                  <div className={cn('h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                    !n.is_read ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{n.title}</span>
                      {!n.is_read && <Badge variant="secondary" className="h-4 text-[10px]">New</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!n.is_read && <Check className="h-4 w-4 text-muted-foreground/40 self-center" />}
                </button>
              );
            })}
          </CardContent>
        </Card>
      )}
    </ClientLayout>
  );
}
