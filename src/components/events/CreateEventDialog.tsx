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

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Globe
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { format, addHours } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEventCreated: () => void;
  preSelectedCandidateId?: string;
  preSelectedClientId?: string;
  preSelectedJobId?: string;
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

// IANA Timezones
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

export function CreateEventDialog({
  open,
  onOpenChange,
  onEventCreated,
  preSelectedCandidateId,
  preSelectedClientId,
  preSelectedJobId
}: CreateEventDialogProps) {
  const { user, tenantId, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'details' | 'participants'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sendInvites, setSendInvites] = useState(true);

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
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(preSelectedJobId);
  const [internalNotes, setInternalNotes] = useState('');

  // Participants
  const [participants, setParticipants] = useState<Participant[]>([]);
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
    try {
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const found = TIMEZONES.find(tz => tz.value === userTz);
      if (found) setTimezone(userTz);
    } catch (e) {
      console.log('Could not detect timezone');
    }
  }, []);

  useEffect(() => {
    if (open && tenantId) {
      fetchJobs();
      if (preSelectedCandidateId) fetchPreSelectedCandidate();
      if (preSelectedClientId) fetchPreSelectedClient();
    }
  }, [open, tenantId, preSelectedCandidateId, preSelectedClientId]);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .order('title');
    setJobs(data || []);
  };

  const fetchPreSelectedCandidate = async () => {
    if (!preSelectedCandidateId) return;
    const { data } = await supabase
      .from('candidates')
      .select('id, full_name, email')
      .eq('id', preSelectedCandidateId)
      .single();
    if (data) {
      setParticipants([{
        type: 'candidate',
        name: data.full_name,
        email: data.email,
        role: 'candidate',
        candidateId: data.id
      }]);
      setTitle(`Interview with ${data.full_name}`);
    }
  };

  const fetchPreSelectedClient = async () => {
    if (!preSelectedClientId) return;
    const { data } = await supabase
      .from('clients')
      .select('id, name, contact_email')
      .eq('id', preSelectedClientId)
      .single();
    if (data && data.contact_email) {
      setParticipants([{
        type: 'client',
        name: data.name,
        email: data.contact_email,
        role: 'client',
        clientId: data.id
      }]);
      setTitle(`Meeting with ${data.name}`);
      setEventType('client_meeting');
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
    if (!startDate || !startTime || !endTime) {
      toast.error('Please select date and time');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create event - convert local time in selected timezone to UTC
      const localStartDate = new Date(`${startDate}T${startTime}:00`);
      const localEndDate = new Date(`${startDate}T${endTime}:00`);
      
      // fromZonedTime converts a time that's expressed in a specific timezone to UTC
      const startDateTime = fromZonedTime(localStartDate, timezone).toISOString();
      const endDateTime = fromZonedTime(localEndDate, timezone).toISOString();

      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert([{
          tenant_id: tenantId,
          title,
          description,
          event_type: eventType as any,
          location_type: locationType,
          location_address: locationType === 'physical' ? locationAddress : null,
          meeting_link: locationType === 'online' ? meetingLink : null,
          start_time: startDateTime,
          end_time: endDateTime,
          timezone,
          organizer_id: user?.id,
          job_id: selectedJobId || null,
          internal_notes: internalNotes
        }])
        .select()
        .single();

      if (eventError) throw eventError;

      // Add participants
      if (participants.length > 0) {
        const participantRecords = participants.map(p => ({
          event_id: event.id,
          participant_type: p.type,
          candidate_id: p.candidateId || null,
          client_id: p.clientId || null,
          user_id: p.userId || null,
          external_name: p.type === 'external' ? p.name : null,
          external_email: p.type === 'external' ? p.email : null,
          role: p.role
        }));

        const { error: participantsError } = await supabase
          .from('event_participants')
          .insert(participantRecords);

        if (participantsError) throw participantsError;
      }

      // Create reminders
      const reminderTimes = [
        { type: '24h', time: new Date(new Date(startDateTime).getTime() - 24 * 60 * 60 * 1000) },
        { type: '1h', time: new Date(new Date(startDateTime).getTime() - 60 * 60 * 1000) }
      ].filter(r => r.time > new Date());

      if (reminderTimes.length > 0) {
        await supabase.from('event_reminders').insert(
          reminderTimes.map(r => ({
            event_id: event.id,
            reminder_type: r.type,
            reminder_time: r.time.toISOString()
          }))
        );
      }

      // Send invitations
      if (sendInvites && participants.length > 0) {
        const { error: inviteError } = await supabase.functions.invoke('send-event-invitation', {
          body: { event_id: event.id, action: 'invite' }
        });

        if (inviteError) {
          console.error('Failed to send invitations:', inviteError);
          toast.warning('Event created but invitations failed to send');
        } else {
          toast.success('Event created and invitations sent!');
        }
      } else {
        toast.success('Event created successfully!');
      }

      resetForm();
      onEventCreated();
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error(error.message || 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setEventType('interview');
    setLocationType('online');
    setLocationAddress('');
    setMeetingLink('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setStartTime('10:00');
    setEndTime('11:00');
    setSelectedJobId(undefined);
    setInternalNotes('');
    setParticipants([]);
    setActiveTab('details');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent" />
            Create Event
          </DialogTitle>
        </DialogHeader>

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
                    min={format(new Date(), 'yyyy-MM-dd')}
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
                <Label>Location</Label>
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

              {/* Meeting Link - shown when Online is selected */}
              {locationType === 'online' && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                  <Label className="flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-primary" />
                    Meeting Link *
                  </Label>
                  <Input
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://meet.google.com/... or https://zoom.us/j/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste your Google Meet, Zoom, or Microsoft Teams meeting link
                  </p>
                </div>
              )}

              {/* Location Address - shown when In Person is selected */}
              {locationType === 'physical' && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
                  <Label className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    Location Address *
                  </Label>
                  <Textarea
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                    placeholder="Enter full address (e.g., 123 Main St, Suite 100, City, Country)"
                    rows={2}
                  />
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add event details, agenda, or notes for participants..."
                  rows={3}
                />
              </div>

              {/* Internal Notes */}
              <div className="space-y-2">
                <Label className="text-muted-foreground">Internal Notes (not visible to participants)</Label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Private notes for your team..."
                  rows={2}
                  className="border-dashed"
                />
              </div>
            </TabsContent>

            <TabsContent value="participants" className="space-y-4 m-0">
              {/* Search */}
              <div className="space-y-2">
                <Label>Add Participants</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search candidates, clients, or team members..."
                    className="pl-10"
                  />
                </div>

                {/* Search Results */}
                {(searchResults.candidates.length > 0 || searchResults.clients.length > 0 || searchResults.users.length > 0) && (
                  <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
                    {searchResults.candidates.map(c => (
                      <div
                        key={`candidate-${c.id}`}
                        className="p-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                        onClick={() => addParticipant({
                          type: 'candidate',
                          name: c.full_name,
                          email: c.email,
                          role: 'candidate',
                          candidateId: c.id
                        })}
                      >
                        <Badge variant="outline" className="text-xs">Candidate</Badge>
                        <span className="font-medium">{c.full_name}</span>
                        <span className="text-muted-foreground text-sm">{c.email}</span>
                      </div>
                    ))}
                    {searchResults.clients.map(c => (
                      <div
                        key={`client-${c.id}`}
                        className="p-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                        onClick={() => c.contact_email && addParticipant({
                          type: 'client',
                          name: c.name,
                          email: c.contact_email,
                          role: 'client',
                          clientId: c.id
                        })}
                      >
                        <Badge variant="outline" className="text-xs">Client</Badge>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground text-sm">{c.contact_email || 'No email'}</span>
                      </div>
                    ))}
                    {searchResults.users.map(u => (
                      <div
                        key={`user-${u.id}`}
                        className="p-2 hover:bg-muted cursor-pointer flex items-center gap-2"
                        onClick={() => addParticipant({
                          type: 'user',
                          name: u.full_name,
                          email: u.email,
                          role: 'interviewer',
                          userId: u.id
                        })}
                      >
                        <Badge variant="outline" className="text-xs">Team</Badge>
                        <span className="font-medium">{u.full_name}</span>
                        <span className="text-muted-foreground text-sm">{u.email}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* External Participant */}
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
                    type="email"
                    value={externalEmail}
                    onChange={(e) => setExternalEmail(e.target.value)}
                    placeholder="Email"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={addExternalParticipant}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Participant List */}
              <div className="space-y-2">
                <Label>Participants ({participants.length})</Label>
                {participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
                    No participants added yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {participants.map((p, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs">
                              {p.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{p.name}</p>
                            <p className="text-xs text-muted-foreground">{p.email}</p>
                          </div>
                          <Badge variant="outline" className="text-xs capitalize">{p.role}</Badge>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
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
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <div className="flex items-center gap-2 flex-1">
            <Switch
              id="send-invites"
              checked={sendInvites}
              onCheckedChange={setSendInvites}
            />
            <Label htmlFor="send-invites" className="text-sm">
              Send email invitations
            </Label>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : sendInvites ? (
                <Send className="w-4 h-4" />
              ) : (
                <Calendar className="w-4 h-4" />
              )}
              {sendInvites ? 'Create & Send Invites' : 'Create Event'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
