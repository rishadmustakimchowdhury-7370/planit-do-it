import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mail,
  Send,
  Inbox,
  Clock,
  CheckCircle,
  XCircle,
  Sparkles,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CandidateEmail {
  id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_email: string;
  subject: string;
  body_text: string;
  status: string;
  ai_generated: boolean;
  sent_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  job?: { title: string } | null;
}

interface CandidateEmailsTabProps {
  candidateId: string;
  onComposeClick: () => void;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  sent: { icon: CheckCircle, color: 'text-success', label: 'Sent' },
  delivered: { icon: CheckCircle, color: 'text-success', label: 'Delivered' },
  opened: { icon: CheckCircle, color: 'text-info', label: 'Opened' },
  scheduled: { icon: Clock, color: 'text-warning', label: 'Scheduled' },
  failed: { icon: XCircle, color: 'text-destructive', label: 'Failed' },
  draft: { icon: Mail, color: 'text-muted-foreground', label: 'Draft' },
  sending: { icon: Send, color: 'text-primary', label: 'Sending' },
  bounced: { icon: XCircle, color: 'text-destructive', label: 'Bounced' },
};

export function CandidateEmailsTab({ candidateId, onComposeClick }: CandidateEmailsTabProps) {
  const [emails, setEmails] = useState<CandidateEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<CandidateEmail | null>(null);

  useEffect(() => {
    fetchEmails();
  }, [candidateId]);

  const fetchEmails = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('candidate_emails')
        .select('*, job:jobs(title)')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmails((data || []).map(e => ({
        ...e,
        direction: e.direction as 'inbound' | 'outbound',
      })));
    } catch (error) {
      console.error('Error fetching emails:', error);
      toast.error('Failed to load emails');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Emails Yet</h3>
        <p className="text-muted-foreground mb-4">
          Start a conversation with this candidate by sending them an email.
        </p>
        <Button onClick={onComposeClick} className="gap-2">
          <Send className="h-4 w-4" />
          Send Email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Email History</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchEmails} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={onComposeClick} className="gap-2">
            <Send className="h-4 w-4" />
            New Email
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {emails.map((email) => {
          const status = statusConfig[email.status] || statusConfig.sent;
          const StatusIcon = status.icon;
          const isOutbound = email.direction === 'outbound';

          return (
            <div
              key={email.id}
              className={cn(
                'bg-card rounded-lg border border-border p-4 cursor-pointer transition-all hover:shadow-md',
                selectedEmail?.id === email.id && 'ring-2 ring-primary'
              )}
              onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={cn(
                      'p-2 rounded-lg shrink-0',
                      isOutbound ? 'bg-primary/10' : 'bg-info/10'
                    )}
                  >
                    {isOutbound ? (
                      <Send className="h-4 w-4 text-primary" />
                    ) : (
                      <Inbox className="h-4 w-4 text-info" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{email.subject}</span>
                      {email.ai_generated && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                      {email.job?.title && (
                        <Badge variant="secondary" className="text-xs">
                          {email.job.title}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {isOutbound ? `To: ${email.to_email}` : `From: ${email.from_email}`}
                    </p>
                    {selectedEmail?.id !== email.id && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                        {email.body_text}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className={cn('flex items-center gap-1 text-xs', status.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {email.sent_at
                      ? format(new Date(email.sent_at), 'MMM d, h:mm a')
                      : email.scheduled_at
                      ? `Scheduled: ${format(new Date(email.scheduled_at), 'MMM d, h:mm a')}`
                      : format(new Date(email.created_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              </div>

              {/* Expanded content */}
              {selectedEmail?.id === email.id && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="bg-muted/30 rounded-lg p-4">
                    <pre className="text-sm whitespace-pre-wrap font-sans text-foreground">
                      {email.body_text}
                    </pre>
                  </div>
                  {email.status === 'failed' && (
                    <div className="mt-3 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
                      This email failed to send. Please try again.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
