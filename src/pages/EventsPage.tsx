import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  Clock, 
  MapPin, 
  Users, 
  Video,
  Building,
  Filter,
  ChevronRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format, isPast, isToday, isTomorrow, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { CreateEventDialog } from '@/components/events/CreateEventDialog';
import { motion } from 'framer-motion';

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  status: string;
  location_type: string;
  location_address: string | null;
  meeting_link: string | null;
  start_time: string;
  end_time: string;
  timezone: string;
  organizer_id: string;
  job_id: string | null;
  created_at: string;
  participant_count?: number;
  jobs?: { title: string } | null;
}

const eventTypeLabels: Record<string, string> = {
  interview: 'Interview',
  client_meeting: 'Client Meeting',
  internal_meeting: 'Internal Meeting',
  follow_up: 'Follow-up',
  custom: 'Event'
};

const eventTypeColors: Record<string, string> = {
  interview: 'bg-accent/10 text-accent border-accent/30',
  client_meeting: 'bg-info/10 text-info border-info/30',
  internal_meeting: 'bg-warning/10 text-warning border-warning/30',
  follow_up: 'bg-success/10 text-success border-success/30',
  custom: 'bg-muted text-muted-foreground border-muted'
};

const statusColors: Record<string, string> = {
  scheduled: 'bg-success/10 text-success border-success/30',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/30',
  rescheduled: 'bg-warning/10 text-warning border-warning/30'
};

export default function EventsPage() {
  const navigate = useNavigate();
  const { tenantId } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  useEffect(() => {
    if (tenantId) {
      fetchEvents();
    }
  }, [tenantId, activeTab]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const now = new Date().toISOString();
      
      let query = supabase
        .from('events')
        .select(`
          *,
          jobs(title)
        `)
        .eq('tenant_id', tenantId);

      if (activeTab === 'upcoming') {
        query = query.gte('start_time', now).order('start_time', { ascending: true });
      } else {
        query = query.lt('start_time', now).order('start_time', { ascending: false });
      }

      const { data, error } = await query.limit(100);

      if (error) throw error;

      // Fetch participant counts
      const eventIds = data?.map(e => e.id) || [];
      if (eventIds.length > 0) {
        const { data: participants } = await supabase
          .from('event_participants')
          .select('event_id')
          .in('event_id', eventIds);

        const counts: Record<string, number> = {};
        participants?.forEach(p => {
          counts[p.event_id] = (counts[p.event_id] || 0) + 1;
        });

        setEvents((data || []).map(e => ({
          ...e,
          participant_count: counts[e.id] || 0
        })));
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    const matchesSearch = 
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || event.event_type === filterType;
    return matchesSearch && matchesType;
  });

  const groupedEvents = filteredEvents.reduce((groups, event) => {
    const date = startOfDay(new Date(event.start_time));
    const key = date.toISOString();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(event);
    return groups;
  }, {} as Record<string, Event[]>);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const renderEventCard = (event: Event) => (
    <motion.div
      key={event.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ x: 4 }}
      className="cursor-pointer"
      onClick={() => navigate(`/events/${event.id}`)}
    >
      <Card className="hover:shadow-md transition-all hover:border-accent/30">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={cn('text-xs', eventTypeColors[event.event_type])}>
                  {eventTypeLabels[event.event_type]}
                </Badge>
                {event.status !== 'scheduled' && (
                  <Badge variant="outline" className={cn('text-xs', statusColors[event.status])}>
                    {event.status}
                  </Badge>
                )}
              </div>
              <h3 className="font-semibold text-foreground truncate">{event.title}</h3>
              {event.jobs?.title && (
                <p className="text-sm text-muted-foreground">Job: {event.jobs.title}</p>
              )}
              
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                </span>
                <span className="flex items-center gap-1">
                  {event.location_type === 'online' ? (
                    <>
                      <Video className="w-3.5 h-3.5" />
                      Online
                    </>
                  ) : (
                    <>
                      <MapPin className="w-3.5 h-3.5" />
                      {event.location_address || 'In Person'}
                    </>
                  )}
                </span>
                {event.participant_count && event.participant_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {event.participant_count} participant{event.participant_count > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <AppLayout title="Events" subtitle="Manage interviews, meetings, and follow-ups">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[160px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="interview">Interviews</SelectItem>
              <SelectItem value="client_meeting">Client Meetings</SelectItem>
              <SelectItem value="internal_meeting">Internal Meetings</SelectItem>
              <SelectItem value="follow_up">Follow-ups</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'upcoming' | 'past')}>
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming" className="gap-2">
            <CalendarIcon className="w-4 h-4" />
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" className="gap-2">
            <Clock className="w-4 h-4" />
            Past
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="m-0">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No {activeTab} events</h3>
                <p className="text-muted-foreground mb-4">
                  {activeTab === 'upcoming' 
                    ? "You don't have any upcoming events scheduled."
                    : "No past events found."}
                </p>
                {activeTab === 'upcoming' && (
                  <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Schedule an Event
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedEvents).map(([date, dayEvents]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {formatDateHeader(date)}
                  </h3>
                  <div className="space-y-3">
                    {dayEvents.map(renderEventCard)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onEventCreated={() => {
          fetchEvents();
          setCreateDialogOpen(false);
        }}
      />
    </AppLayout>
  );
}
