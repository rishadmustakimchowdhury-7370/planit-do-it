-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'candidate_added', 'ai_match_complete', 'event_scheduled', 'email_sent', 'email_failed', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT, -- 'candidate', 'job', 'event', 'email', etc.
  entity_id UUID,
  link TEXT, -- URL to navigate to when clicked
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_email_sent BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (user_id = auth.uid() OR is_super_admin(auth.uid()));

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE
USING (user_id = auth.uid());

-- Create indexes for performance
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_tenant ON public.notifications(tenant_id);

-- Add notification preferences to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "sound_enabled": true,
  "email_enabled": true,
  "in_app_enabled": true,
  "do_not_disturb": false,
  "dnd_start": null,
  "dnd_end": null,
  "event_types": {
    "candidate_added": {"in_app": true, "email": false},
    "candidate_assigned": {"in_app": true, "email": false},
    "ai_match_complete": {"in_app": true, "email": false},
    "event_scheduled": {"in_app": true, "email": true},
    "event_updated": {"in_app": true, "email": true},
    "event_cancelled": {"in_app": true, "email": true},
    "email_sent": {"in_app": true, "email": false},
    "email_failed": {"in_app": true, "email": true},
    "task_due": {"in_app": true, "email": true},
    "system_alert": {"in_app": true, "email": true}
  }
}'::jsonb;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;