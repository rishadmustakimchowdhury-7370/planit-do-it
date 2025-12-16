import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Users,
  ArrowLeft,
  Edit,
  Trash2,
  Send,
  ExternalLink,
  Building,
  User,
  Check,
  X,
  HelpCircle,
  Copy,
  CalendarPlus,
  Link2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  internal_notes: string | null;
  created_at: string;
  jobs?: { id: string; title: string } | null;
  organizer?: { full_name: string; email: string } | null;
}

interface Participant {
  id: string;
  participant_type: string;
  role: string;
  rsvp_status: string;
  external_name: string | null;
  external_email: string | null;
  candidates?: { id: string; full_name: string; email: string } | null;
  clients?: { id: string; name: string; contact_email: string } | null;
  profiles?: { id: string; full_name: string; email: string } | null;
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
  scheduled: 'bg-success/10 text-success',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  rescheduled: 'bg-warning/10 text-warning'
};

const rsvpIcons: Record<string, React.ReactNode> = {
  accepted: <Check className="w-3.5 h-3.5 text-success" />,
  declined: <X className="w-3.5 h-3.5 text-destructive" />,
  tentative: <HelpCircle className="w-3.5 h-3.5 text-warning" />,
  pending: <Clock className="w-3.5 h-3.5 text-muted-foreground" />
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, tenantId } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id && tenantId) {
      fetchEventDetails();
    }
  }, [id, tenantId]);

  const fetchEventDetails = async () => {
    setIsLoading(true);
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(`
          *,
          jobs(id, title)
        `)
        .eq('id', id)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (eventError) throw eventError;
      if (!eventData) {
        toast.error('Event not found');
        navigate('/events');
        return;
      }

      // Fetch organizer info
      const { data: organizerData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', eventData.organizer_id)
        .maybeSingle();

      setEvent({
        ...eventData,
        organizer: organizerData
      });

      // Fetch participants
      const { data: participantsData, error: participantsError } = await supabase
        .from('event_participants')
        .select(`
          *,
          candidates(id, full_name, email),
          clients(id, name, contact_email)
        `)
        .eq('event_id', id);

      if (participantsError) throw participantsError;
      
      // Fetch user profiles for team participants separately
      const userIds = participantsData?.filter(p => p.user_id).map(p => p.user_id) || [];
      let profilesMap: Record<string, { id: string; full_name: string; email: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        profilesData?.forEach(p => {
          profilesMap[p.id] = p;
        });
      }
      
      setParticipants((participantsData || []).map(p => ({
        ...p,
        profiles: p.user_id ? profilesMap[p.user_id] || null : null
      })) as Participant[]);
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvitations = async () => {
    setIsSendingInvites(true);
    try {
      const { error } = await supabase.functions.invoke('send-event-invitation', {
        body: { event_id: id, action: 'invite' }
      });

      if (error) throw error;
      toast.success('Invitations sent successfully!');
      fetchEventDetails();
    } catch (error: any) {
      console.error('Error sending invitations:', error);
      toast.error(error.message || 'Failed to send invitations');
    } finally {
      setIsSendingInvites(false);
    }
  };

  const handleCancelEvent = async () => {
    setIsCancelling(true);
    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (updateError) throw updateError;

      // Send cancellation emails
      const { error: emailError } = await supabase.functions.invoke('send-event-invitation', {
        body: { event_id: id, action: 'cancel' }
      });

      if (emailError) {
        console.error('Failed to send cancellation emails:', emailError);
      }

      toast.success('Event cancelled');
      navigate('/events');
    } catch (error: any) {
      console.error('Error cancelling event:', error);
      toast.error(error.message || 'Failed to cancel event');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDeleteEvent = async () => {
    setIsDeleting(true);
    try {
      // Delete participants first (due to FK constraint)
      await supabase
        .from('event_participants')
        .delete()
        .eq('event_id', id);

      // Delete reminders
      await supabase
        .from('event_reminders')
        .delete()
        .eq('event_id', id);

      // Delete the event
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Event deleted permanently');
      navigate('/events');
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error.message || 'Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyMeetingLink = () => {
    if (event?.meeting_link) {
      navigator.clipboard.writeText(event.meeting_link);
      toast.success('Meeting link copied!');
    }
  };

  const generateICSLink = () => {
    if (!event) return '';
    
    const startDate = new Date(event.start_time);
    const endDate = new Date(event.end_time);
    
    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(startDate)}`,
      `DTEND:${formatDate(endDate)}`,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
      event.meeting_link ? `URL:${event.meeting_link}` : '',
      event.location_address ? `LOCATION:${event.location_address}` : '',
      'END:VEVENT',
      'END:VCALENDAR'
    ].filter(Boolean).join('\n');
    
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
  };

  const getParticipantInfo = (p: Participant) => {
    if (p.participant_type === 'candidate' && p.candidates) {
      return { name: p.candidates.full_name, email: p.candidates.email };
    }
    if (p.participant_type === 'client' && p.clients) {
      return { name: p.clients.name, email: p.clients.contact_email };
    }
    if (p.participant_type === 'user' && p.profiles) {
      return { name: p.profiles.full_name, email: p.profiles.email };
    }
    return { name: p.external_name || 'Unknown', email: p.external_email || '' };
  };

  if (isLoading) {
    return (
      <AppLayout title="Event Details">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!event) {
    return (
      <AppLayout title="Event Not Found">
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Event not found</h3>
            <p className="text-muted-foreground mb-4">
              The event you're looking for doesn't exist or has been deleted.
            </p>
            <Button onClick={() => navigate('/events')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Events
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const isOrganizer = event.organizer_id === user?.id;
  const isPast = new Date(event.end_time) < new Date();

  return (
    <AppLayout title={event.title}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/events')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={cn(eventTypeColors[event.event_type])}>
                {eventTypeLabels[event.event_type]}
              </Badge>
              <Badge variant="outline" className={cn(statusColors[event.status])}>
                {event.status}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
          </div>
        </div>

        {isOrganizer && (
          <div className="flex gap-2">
            {event.status === 'scheduled' && !isPast && (
              <>
                <Button 
                  variant="outline" 
                  onClick={handleSendInvitations}
                  disabled={isSendingInvites}
                  className="gap-2"
                >
                  {isSendingInvites ? (
                    <Clock className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Resend Invites
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this event?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will cancel the event and notify all participants via email.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Event</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={handleCancelEvent}
                        disabled={isCancelling}
                        className="bg-warning text-warning-foreground hover:bg-warning/90"
                      >
                        {isCancelling ? 'Cancelling...' : 'Cancel Event'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this event permanently?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the event and all associated data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Event</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteEvent}
                    disabled={isDeleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Event Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-accent" />
                Event Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date & Time - Display in event's timezone */}
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">
                    {format(toZonedTime(new Date(event.start_time), event.timezone), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-muted-foreground">
                    {format(toZonedTime(new Date(event.start_time), event.timezone), 'h:mm a')} - {format(toZonedTime(new Date(event.end_time), event.timezone), 'h:mm a')}
                    <span className="ml-2">({event.timezone})</span>
                  </p>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-start gap-3">
                {event.location_type === 'online' ? (
                  <Video className="w-5 h-5 text-muted-foreground mt-0.5" />
                ) : (
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {event.location_type === 'online' ? 'Online Meeting' : 'In Person'}
                  </p>
                  {event.location_type === 'online' && event.meeting_link ? (
                    <div className="flex items-center gap-2 mt-1">
                      <a 
                        href={event.meeting_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-accent hover:underline flex items-center gap-1"
                      >
                        Join Meeting
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <Button variant="ghost" size="sm" onClick={copyMeetingLink} className="h-6 px-2">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : event.location_address ? (
                    <p className="text-muted-foreground">{event.location_address}</p>
                  ) : (
                    <p className="text-muted-foreground italic">No meeting link provided</p>
                  )}
                </div>
              </div>

              {/* Related Job */}
              {event.jobs && (
                <div className="flex items-start gap-3">
                  <Building className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Related Job</p>
                    <Button 
                      variant="link" 
                      className="h-auto p-0 text-accent"
                      onClick={() => navigate(`/jobs/${event.jobs?.id}`)}
                    >
                      {event.jobs.title}
                    </Button>
                  </div>
                </div>
              )}

              {/* Description */}
              {event.description && (
                <>
                  <Separator />
                  <div>
                    <p className="font-medium mb-2">Description</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
                  </div>
                </>
              )}

              {/* Add to Calendar */}
              <Separator />
              <div className="flex items-center gap-2">
                <a
                  href={generateICSLink()}
                  download={`${event.title.replace(/\s+/g, '_')}.ics`}
                  className="inline-flex"
                >
                  <Button variant="outline" size="sm" className="gap-2">
                    <CalendarPlus className="w-4 h-4" />
                    Add to Calendar
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Internal Notes (only for organizer) */}
          {isOrganizer && event.internal_notes && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{event.internal_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Organizer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Organizer</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {event.organizer?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'O'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{event.organizer?.full_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{event.organizer?.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Participants
                </span>
                <Badge variant="secondary">{participants.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No participants added
                </p>
              ) : (
                <div className="space-y-3">
                  {participants.map((p) => {
                    const info = getParticipantInfo(p);
                    return (
                      <div key={p.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarFallback className="text-xs">
                              {info.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{info.name}</p>
                            {info.email && (
                              <p className="text-xs text-muted-foreground truncate">{info.email}</p>
                            )}
                            <Badge variant="outline" className="text-xs capitalize mt-1">
                              {p.role}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" title={`RSVP: ${p.rsvp_status}`}>
                          {rsvpIcons[p.rsvp_status]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
