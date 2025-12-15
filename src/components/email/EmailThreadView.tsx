import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Mail,
  Send,
  Inbox,
  Reply,
  ReplyAll,
  Forward,
  Clock,
  CheckCircle,
  XCircle,
  Sparkles,
  Eye,
  MousePointer,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Email {
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
  thread_id: string | null;
  metadata: Record<string, any> | null;
  job?: { title: string } | null;
}

interface Thread {
  id: string;
  subject: string;
  emails: Email[];
  lastEmail: Email;
  unread: boolean;
}

interface EmailThreadViewProps {
  candidateId: string;
  onReply: (email: Email) => void;
  onCompose: () => void;
}

const statusConfig: Record<string, { icon: React.ElementType; color: string }> = {
  sent: { icon: CheckCircle, color: 'text-success' },
  delivered: { icon: CheckCircle, color: 'text-success' },
  opened: { icon: Eye, color: 'text-info' },
  clicked: { icon: MousePointer, color: 'text-primary' },
  scheduled: { icon: Clock, color: 'text-warning' },
  failed: { icon: XCircle, color: 'text-destructive' },
};

export function EmailThreadView({ candidateId, onReply, onCompose }: EmailThreadViewProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set());
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

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
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group emails into threads
      const threadMap = new Map<string, Email[]>();
      
      (data || []).forEach(email => {
        const threadId = email.thread_id || email.id;
        const existing = threadMap.get(threadId) || [];
        existing.push({
          ...email,
          direction: email.direction as 'inbound' | 'outbound',
          metadata: email.metadata as Record<string, any> | null,
        });
        threadMap.set(threadId, existing);
      });

      // Convert to thread objects
      const threadList: Thread[] = Array.from(threadMap.entries()).map(([id, emails]) => {
        const sortedEmails = emails.sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const lastEmail = sortedEmails[sortedEmails.length - 1];
        
        return {
          id,
          subject: emails[0].subject,
          emails: sortedEmails,
          lastEmail,
          unread: lastEmail.direction === 'inbound' && lastEmail.status !== 'read',
        };
      });

      // Sort threads by last email date (newest first)
      threadList.sort((a, b) => 
        new Date(b.lastEmail.created_at).getTime() - new Date(a.lastEmail.created_at).getTime()
      );

      setThreads(threadList);
    } catch (error) {
      console.error('Error fetching emails:', error);
      toast.error('Failed to load emails');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleThread = (threadId: string) => {
    setExpandedThreads(prev => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  const getTrackingInfo = (email: Email) => {
    const metadata = email.metadata;
    if (!metadata) return null;
    
    return {
      opens: metadata.open_count || 0,
      clicks: metadata.click_count || 0,
      lastOpened: metadata.last_opened_at,
    };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="text-center py-12">
        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="font-semibold mb-2">No Conversations</h3>
        <p className="text-muted-foreground mb-4">
          Start a conversation with this candidate
        </p>
        <Button onClick={onCompose} className="gap-2">
          <Send className="h-4 w-4" />
          Send Email
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Conversations</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchEmails}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={onCompose}>
            <Send className="h-4 w-4 mr-1" />
            New Email
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {threads.map(thread => {
          const isExpanded = expandedThreads.has(thread.id);
          const StatusIcon = statusConfig[thread.lastEmail.status]?.icon || CheckCircle;
          const statusColor = statusConfig[thread.lastEmail.status]?.color || 'text-muted-foreground';

          return (
            <div
              key={thread.id}
              className="bg-card border border-border rounded-lg overflow-hidden"
            >
              {/* Thread Header */}
              <div
                className={cn(
                  'flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors',
                  thread.unread && 'bg-primary/5'
                )}
                onClick={() => toggleThread(thread.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={cn(
                    'p-2 rounded-lg shrink-0',
                    thread.lastEmail.direction === 'outbound' ? 'bg-primary/10' : 'bg-info/10'
                  )}>
                    {thread.lastEmail.direction === 'outbound' ? (
                      <Send className="h-4 w-4 text-primary" />
                    ) : (
                      <Inbox className="h-4 w-4 text-info" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn('font-medium text-sm truncate', thread.unread && 'font-bold')}>
                        {thread.subject}
                      </span>
                      {thread.emails.length > 1 && (
                        <Badge variant="secondary" className="shrink-0">
                          {thread.emails.length}
                        </Badge>
                      )}
                      {thread.lastEmail.ai_generated && (
                        <Badge variant="outline" className="text-xs gap-1 shrink-0">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {thread.lastEmail.direction === 'outbound' 
                        ? `To: ${thread.lastEmail.to_email}` 
                        : `From: ${thread.lastEmail.from_email}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Tracking info */}
                  {thread.lastEmail.direction === 'outbound' && getTrackingInfo(thread.lastEmail) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {getTrackingInfo(thread.lastEmail)!.opens > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {getTrackingInfo(thread.lastEmail)!.opens}
                        </span>
                      )}
                      {getTrackingInfo(thread.lastEmail)!.clicks > 0 && (
                        <span className="flex items-center gap-1">
                          <MousePointer className="h-3 w-3" />
                          {getTrackingInfo(thread.lastEmail)!.clicks}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className={cn('flex items-center gap-1 text-xs', statusColor)}>
                    <StatusIcon className="h-3 w-3" />
                  </div>
                  
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(thread.lastEmail.created_at), 'MMM d, h:mm a')}
                  </span>
                  
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {/* Expanded Thread */}
              {isExpanded && (
                <div className="border-t border-border">
                  {thread.emails.map((email, index) => (
                    <div
                      key={email.id}
                      className={cn(
                        'p-4 border-b border-border last:border-b-0',
                        index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                            email.direction === 'outbound' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-info text-info-foreground'
                          )}>
                            {email.direction === 'outbound' ? 'ME' : 'C'}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {email.direction === 'outbound' ? 'You' : email.from_email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(email.created_at), 'MMM d, yyyy at h:mm a')}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              onReply(email);
                            }}
                          >
                            <Reply className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="pl-10">
                        <div 
                          className="prose prose-sm max-w-none text-sm"
                          dangerouslySetInnerHTML={{ __html: email.body_text }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {/* Quick Reply */}
                  <div className="p-4 bg-muted/30 flex gap-2">
                    <Input 
                      placeholder="Write a reply..." 
                      className="flex-1"
                      onFocus={() => onReply(thread.lastEmail)}
                    />
                    <Button 
                      size="sm"
                      onClick={() => onReply(thread.lastEmail)}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
