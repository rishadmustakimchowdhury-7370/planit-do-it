import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Users, 
  Plus, 
  X, 
  Send,
  Loader2,
  Search,
  Globe,
  Edit
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventUpdated: () => void;
  eventId: string;
}

interface Participant {
  id?: string;
  type: 'candidate' | 'client' | 'user' | 'external';
  name: string;
  email: string;
  role: 'candidate' | 'client' | 'interviewer' | 'observer' | 'organizer';
  candidateId?: string;
  clientId?: string;
  userId?: string;
  existingId?: string;
}

interface Candidate {
  id: string;
  full_name: string;
  email: string;
}

interface Client {
  id: string;
  name: string;
  contact_email: string | null;
}

interface Job {
  id: string;
  title: string;
}

interface User {
  id: string;
  full_name: string;
  email: string;
}

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'GMT/BST - London' },
  { value: 'Europe/Paris', label: 'CET - Paris' },
  { value: 'Europe/Berlin', label: 'CET - Berlin' },
  { value: 'Asia/Dubai', label: 'Gulf Time - Dubai' },
  { value: 'Asia/Kolkata', label: 'IST - Mumbai' },
  { value: 'Asia/Singapore', label: 'SGT - Singapore' },
  { value: 'Asia/Tokyo', label: 'JST - Tokyo' },
  { value: 'Australia/Sydney', label: 'AEST - Sydney' },
  { value: 'Asia/Dhaka', label: 'BST - Dhaka' },
];

export function EditEventDialog({
  open,
  onOpenChange,
  onEventUpdated,
  eventId
}: EditEventDialogProps) {
  const { user, tenantId } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'participants'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sendUpdateNotification, setSendUpdateNotification] = useState(true);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState<string>('interview');
  const [locationType, setLocationType] = useState<'online' | 'physical'>('online');
  const [locationAddress, setLocationAddress] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('11:00');
  const [timezone, setTimezone] = useState('UTC');
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>();
  const [internalNotes, setInternalNotes] = useState('');

  // Participants
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [originalParticipantIds, setOriginalParticipantIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{
    candidates: Candidate[];
    clients: Client[];
    users: User[];
  }>({ candidates: [], clients: [], users: [] });

  // Data
  const [jobs, setJobs] = useState<Job[]>([]);
  const [externalName, setExternalName] = useState('');
  const [externalEmail, setExternalEmail] = useState('');

  useEffect(() => {
    if (open && tenantId && eventId) {
      fetchEventData();
      fetchJobs();
    }
  }, [open, tenantId, eventId]);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .order('title');
    setJobs(data || []);
  };

  const fetchEventData = async () => {
    setIsLoading(true);
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      // Convert UTC times to the event's timezone for display
      const zonedStart = toZonedTime(new Date(eventData.start_time), eventData.timezone);
      const zonedEnd = toZonedTime(new Date(eventData.end_time), eventData.timezone);

      setTitle(eventData.title);
      setDescription(eventData.description || '');
      setEventType(eventData.event_type);
      setLocationType(eventData.location_type as 'online' | 'physical');
      setLocationAddress(eventData.location_address || '');
      setMeetingLink(eventData.meeting_link || '');
      setStartDate(format(zonedStart, 'yyyy-MM-dd'));
      setStartTime(format(zonedStart, 'HH:mm'));
      setEndTime(format(zonedEnd, 'HH:mm'));
      setTimezone(eventData.timezone);
      setSelectedJobId(eventData.job_id || undefined);
      setInternalNotes(eventData.internal_notes || '');

      // Fetch participants
      const { data: participantsData } = await supabase
        .from('event_participants')
        .select(`
          *,
          candidates(id, full_name, email),
          clients(id, name, contact_email)
        `)
        .eq('event_id', eventId);

      if (participantsData) {
        const userIds = participantsData.filter(p => p.user_id).map(p => p.user_id);
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

        const mappedParticipants: Participant[] = participantsData.map(p => {
          if (p.participant_type === 'candidate' && p.candidates) {
            return {
              existingId: p.id,
              type: 'candidate' as const,
              name: p.candidates.full_name,
              email: p.candidates.email,
              role: p.role as any,
              candidateId: p.candidate_id
            };
          }
          if (p.participant_type === 'client' && p.clients) {
            return {
              existingId: p.id,
              type: 'client' as const,
              name: p.clients.name,
              email: p.clients.contact_email || '',
              role: p.role as any,
              clientId: p.client_id
            };
          }
          if (p.participant_type === 'user' && p.user_id) {
            const profile = profilesMap[p.user_id];
            return {
              existingId: p.id,
              type: 'user' as const,
              name: profile?.full_name || 'Unknown',
              email: profile?.email || '',
              role: p.role as any,
              userId: p.user_id
            };
          }
          return {
            existingId: p.id,
            type: 'external' as const,
            name: p.external_name || '',
            email: p.external_email || '',
            role: p.role as any
          };
        });

        setParticipants(mappedParticipants);
        setOriginalParticipantIds(participantsData.map(p => p.id));
      }
    } catch (error) {
      console.error('Error fetching event:', error);
      toast.error('Failed to load event data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults({ candidates: [], clients: [], users: [] });
      return;
    }

    const [candidatesRes, clientsRes, usersRes] = await Promise.all([
      supabase
        .from('candidates')
        .select('id, full_name, email')
        .eq('tenant_id', tenantId)
        .ilike('full_name', `%${query}%`)
        .limit(5),
      supabase
        .from('clients')
        .select('id, name, contact_email')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${query}%`)
        .limit(5),
      supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('tenant_id', tenantId)
        .ilike('full_name', `%${query}%`)
        .limit(5)
    ]);

    setSearchResults({
      candidates: candidatesRes.data || [],
      clients: clientsRes.data || [],
      users: usersRes.data || []
    });
  };

  const addParticipant = (participant: Participant) => {
    const exists = participants.some(p => 
      (p.candidateId && p.candidateId === participant.candidateId) ||
      (p.clientId && p.clientId === participant.clientId) ||
      (p.userId && p.userId === participant.userId) ||
      (p.email === participant.email)
    );
    if (exists) {
      toast.info('Participant already added');
      return;
    }
    setParticipants([...participants, participant]);
    setSearchQuery('');
    setSearchResults({ candidates: [], clients: [], users: [] });
  };

  const addExternalParticipant = () => {
    if (!externalEmail || !externalName) {
      toast.error('Please enter name and email');
      return;
    }
    addParticipant({
      type: 'external',
      name: externalName,
      email: externalEmail,
      role: 'observer'
    });
    setExternalName('');
    setExternalEmail('');
  };

  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter an event title');
      return;
    }

    setIsSubmitting(true);
    try {
      // Convert local time in selected timezone to UTC
      const localStartDate = new Date(`${startDate}T${startTime}:00`);
      const localEndDate = new Date(`${startDate}T${endTime}:00`);
      
      const startDateTime = fromZonedTime(localStartDate, timezone).toISOString();
      const endDateTime = fromZonedTime(localEndDate, timezone).toISOString();

      // Update event
      const { error: eventError } = await supabase
        .from('events')
        .update({
          title,
          description,
          event_type: eventType as any,
          location_type: locationType,
          location_address: locationType === 'physical' ? locationAddress : null,
          meeting_link: locationType === 'online' ? meetingLink : null,
          start_time: startDateTime,
          end_time: endDateTime,
          timezone,
          job_id: selectedJobId || null,
          internal_notes: internalNotes
        })
        .eq('id', eventId);

      if (eventError) throw eventError;

      // Handle participants - delete removed, add new
      const currentIds = participants.filter(p => p.existingId).map(p => p.existingId!);
      const toDelete = originalParticipantIds.filter(id => !currentIds.includes(id));
      const toAdd = participants.filter(p => !p.existingId);

      if (toDelete.length > 0) {
        await supabase
          .from('event_participants')
          .delete()
          .in('id', toDelete);
      }

      if (toAdd.length > 0) {
        const newParticipants = toAdd.map(p => ({
          event_id: eventId,
          participant_type: p.type,
          candidate_id: p.candidateId || null,
          client_id: p.clientId || null,
          user_id: p.userId || null,
          external_name: p.type === 'external' ? p.name : null,
          external_email: p.type === 'external' ? p.email : null,
          role: p.role
        }));

        await supabase
          .from('event_participants')
          .insert(newParticipants);
      }

      // Update reminders
      await supabase
        .from('event_reminders')
        .delete()
        .eq('event_id', eventId);

      const reminderTimes = [
        { type: '24h', time: new Date(new Date(startDateTime).getTime() - 24 * 60 * 60 * 1000) },
        { type: '1h', time: new Date(new Date(startDateTime).getTime() - 60 * 60 * 1000) }
      ].filter(r => r.time > new Date());

      if (reminderTimes.length > 0) {
        await supabase.from('event_reminders').insert(
          reminderTimes.map(r => ({
            event_id: eventId,
            reminder_type: r.type,
            reminder_time: r.time.toISOString()
          }))
        );
      }

      // Send update notification
      if (sendUpdateNotification && participants.length > 0) {
        await supabase.functions.invoke('send-event-invitation', {
          body: { event_id: eventId, action: 'update' }
        });
      }

      toast.success('Event updated successfully!');
      onEventUpdated();
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast.error(error.message || 'Failed to update event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5 text-accent" />
            Edit Event
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'details' | 'participants')} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-2 shrink-0">
              <TabsTrigger value="details">Event Details</TabsTrigger>
              <TabsTrigger value="participants" className="gap-2">
                Participants
                {participants.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{participants.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4 pr-2">
              <TabsContent value="details" className="space-y-4 m-0 pb-4">
                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Technical Interview - Backend Developer"
                  />
                </div>

                {/* Event Type */}
                <div className="space-y-2">
                  <Label>Event Type</Label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interview">Interview</SelectItem>
                      <SelectItem value="client_meeting">Client Meeting</SelectItem>
                      <SelectItem value="internal_meeting">Internal Meeting</SelectItem>
                      <SelectItem value="follow_up">Follow-up Call</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Related Job */}
                <div className="space-y-2">
                  <Label>Related Job (Optional)</Label>
                  <Select value={selectedJobId || ''} onValueChange={setSelectedJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job..." />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map(job => (
                        <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time *</Label>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time *</Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* Timezone */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    Timezone
                  </Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Location Type */}
                <div className="space-y-2">
                  <Label>Location Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={locationType === 'online' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLocationType('online')}
                      className="gap-2"
                    >
                      <Video className="w-4 h-4" />
                      Online
                    </Button>
                    <Button
                      type="button"
                      variant={locationType === 'physical' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setLocationType('physical')}
                      className="gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      In Person
                    </Button>
                  </div>
                </div>

                {/* Meeting Link or Address */}
                {locationType === 'online' ? (
                  <div className="space-y-2">
                    <Label>Meeting Link</Label>
                    <Input
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Location Address</Label>
                    <Input
                      value={locationAddress}
                      onChange={(e) => setLocationAddress(e.target.value)}
                      placeholder="123 Main St, City, Country"
                    />
                  </div>
                )}

                {/* Description */}
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Event details, agenda, notes..."
                    rows={3}
                  />
                </div>

                {/* Internal Notes */}
                <div className="space-y-2">
                  <Label>Internal Notes (not visible to participants)</Label>
                  <Textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Private notes..."
                    rows={2}
                  />
                </div>
              </TabsContent>

              <TabsContent value="participants" className="space-y-4 m-0 pb-4">
                {/* Search */}
                <div className="space-y-2">
                  <Label>Search Candidates, Clients, or Team Members</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Type to search..."
                      className="pl-9"
                    />
                  </div>

                  {/* Search Results */}
                  {(searchResults.candidates.length > 0 || searchResults.clients.length > 0 || searchResults.users.length > 0) && (
                    <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                      {searchResults.candidates.map(c => (
                        <button
                          key={c.id}
                          onClick={() => addParticipant({
                            type: 'candidate',
                            name: c.full_name,
                            email: c.email,
                            role: 'candidate',
                            candidateId: c.id
                          })}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                        >
                          <Badge variant="outline" className="text-xs">Candidate</Badge>
                          <span>{c.full_name}</span>
                          <span className="text-muted-foreground text-sm ml-auto">{c.email}</span>
                        </button>
                      ))}
                      {searchResults.clients.map(c => (
                        <button
                          key={c.id}
                          onClick={() => addParticipant({
                            type: 'client',
                            name: c.name,
                            email: c.contact_email || '',
                            role: 'client',
                            clientId: c.id
                          })}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                        >
                          <Badge variant="outline" className="text-xs">Client</Badge>
                          <span>{c.name}</span>
                          <span className="text-muted-foreground text-sm ml-auto">{c.contact_email}</span>
                        </button>
                      ))}
                      {searchResults.users.map(u => (
                        <button
                          key={u.id}
                          onClick={() => addParticipant({
                            type: 'user',
                            name: u.full_name,
                            email: u.email,
                            role: 'interviewer',
                            userId: u.id
                          })}
                          className="w-full px-3 py-2 text-left hover:bg-muted flex items-center gap-2"
                        >
                          <Badge variant="outline" className="text-xs">Team</Badge>
                          <span>{u.full_name}</span>
                          <span className="text-muted-foreground text-sm ml-auto">{u.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add External */}
                <div className="space-y-2">
                  <Label>Add External Participant</Label>
                  <div className="flex gap-2">
                    <Input
                      value={externalName}
                      onChange={(e) => setExternalName(e.target.value)}
                      placeholder="Name"
                      className="flex-1"
                    />
                    <Input
                      value={externalEmail}
                      onChange={(e) => setExternalEmail(e.target.value)}
                      placeholder="Email"
                      className="flex-1"
                    />
                    <Button type="button" size="icon" onClick={addExternalParticipant}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Participants List */}
                <div className="space-y-2">
                  <Label>Participants ({participants.length})</Label>
                  {participants.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">
                      No participants added yet
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {participants.map((p, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {p.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{p.name}</p>
                            <p className="text-sm text-muted-foreground truncate">{p.email}</p>
                          </div>
                          <Badge variant="outline" className="capitalize">{p.role}</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeParticipant(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>

            <DialogFooter className="mt-4 pt-4 border-t shrink-0">
              <div className="flex items-center gap-2 mr-auto">
                <Switch
                  id="sendNotification"
                  checked={sendUpdateNotification}
                  onCheckedChange={setSendUpdateNotification}
                />
                <Label htmlFor="sendNotification" className="text-sm font-normal cursor-pointer">
                  Send update notification to participants
                </Label>
              </div>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Edit className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
