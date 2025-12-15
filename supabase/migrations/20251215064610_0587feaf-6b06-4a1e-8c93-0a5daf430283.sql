-- Create event type enum
CREATE TYPE public.event_type AS ENUM (
  'interview',
  'client_meeting',
  'internal_meeting',
  'follow_up',
  'custom'
);

-- Create event status enum
CREATE TYPE public.event_status AS ENUM (
  'scheduled',
  'completed',
  'cancelled',
  'rescheduled'
);

-- Create participant role enum
CREATE TYPE public.participant_role AS ENUM (
  'candidate',
  'client',
  'interviewer',
  'observer',
  'organizer'
);

-- Create RSVP status enum
CREATE TYPE public.rsvp_status AS ENUM (
  'pending',
  'accepted',
  'declined',
  'tentative'
);

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type public.event_type NOT NULL DEFAULT 'interview',
  status public.event_status NOT NULL DEFAULT 'scheduled',
  location_type TEXT NOT NULL DEFAULT 'online', -- 'online' or 'physical'
  location_address TEXT,
  meeting_link TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  organizer_id UUID NOT NULL REFERENCES auth.users(id),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  internal_notes TEXT, -- Not visible to participants
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create event participants table
CREATE TABLE public.event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL, -- 'candidate', 'client', 'user', 'external'
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  external_name TEXT,
  external_email TEXT,
  role public.participant_role NOT NULL DEFAULT 'interviewer',
  rsvp_status public.rsvp_status NOT NULL DEFAULT 'pending',
  rsvp_responded_at TIMESTAMP WITH TIME ZONE,
  invitation_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_participant CHECK (
    (participant_type = 'candidate' AND candidate_id IS NOT NULL) OR
    (participant_type = 'client' AND client_id IS NOT NULL) OR
    (participant_type = 'user' AND user_id IS NOT NULL) OR
    (participant_type = 'external' AND external_email IS NOT NULL)
  )
);

-- Create event reminders table
CREATE TABLE public.event_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- '24h', '1h', 'custom'
  reminder_time TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_events_tenant_id ON public.events(tenant_id);
CREATE INDEX idx_events_organizer_id ON public.events(organizer_id);
CREATE INDEX idx_events_start_time ON public.events(start_time);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_event_participants_event_id ON public.event_participants(event_id);
CREATE INDEX idx_event_participants_candidate_id ON public.event_participants(candidate_id);
CREATE INDEX idx_event_participants_client_id ON public.event_participants(client_id);
CREATE INDEX idx_event_reminders_event_id ON public.event_reminders(event_id);
CREATE INDEX idx_event_reminders_reminder_time ON public.event_reminders(reminder_time);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "Users can view events in their tenant"
ON public.events FOR SELECT
USING (tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Users can create events in their tenant"
ON public.events FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Organizers and admins can update events"
ON public.events FOR UPDATE
USING (
  organizer_id = auth.uid() OR 
  has_role(auth.uid(), 'admin') OR 
  is_super_admin(auth.uid())
);

CREATE POLICY "Organizers and admins can delete events"
ON public.events FOR DELETE
USING (
  organizer_id = auth.uid() OR 
  has_role(auth.uid(), 'admin') OR 
  is_super_admin(auth.uid())
);

-- RLS Policies for event_participants
CREATE POLICY "Users can view participants for events in their tenant"
ON public.event_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_participants.event_id 
    AND (e.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "Users can manage participants for their events"
ON public.event_participants FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_participants.event_id 
    AND (e.organizer_id = auth.uid() OR has_role(auth.uid(), 'admin') OR is_super_admin(auth.uid()))
  )
);

-- RLS Policies for event_reminders
CREATE POLICY "Users can view reminders for events in their tenant"
ON public.event_reminders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e 
    WHERE e.id = event_reminders.event_id 
    AND (e.tenant_id = get_user_tenant_id(auth.uid()) OR is_super_admin(auth.uid()))
  )
);

CREATE POLICY "System can manage reminders"
ON public.event_reminders FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_event_participants_updated_at
BEFORE UPDATE ON public.event_participants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();