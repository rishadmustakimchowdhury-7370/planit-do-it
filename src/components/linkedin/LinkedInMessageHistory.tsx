import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Linkedin, Loader2, User, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface MessageLog {
  id: string;
  message_text: string;
  sent_at: string;
  status: string;
  job_id: string | null;
  template_id: string | null;
  sent_by: string;
  profiles?: { full_name: string | null } | null;
  jobs?: { title: string } | null;
}

interface LinkedInMessageHistoryProps {
  candidateId: string;
}

export function LinkedInMessageHistory({ candidateId }: LinkedInMessageHistoryProps) {
  const { tenantId } = useAuth();
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (candidateId && tenantId) {
      fetchMessages();
    }
  }, [candidateId, tenantId]);

  const fetchMessages = async () => {
    setIsLoading(true);
    try {
      // First fetch message logs
      const { data: logsData, error: logsError } = await supabase
        .from('linkedin_message_logs')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('sent_at', { ascending: false });

      if (logsError) throw logsError;

      // Fetch job titles for messages that have job_id
      const jobIds = logsData?.filter(l => l.job_id).map(l => l.job_id!) || [];
      const { data: jobsData } = await supabase
        .from('jobs')
        .select('id, title')
        .in('id', jobIds);

      // Fetch sender names
      const senderIds = logsData?.map(l => l.sent_by) || [];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds);

      // Combine data
      const data = logsData?.map(log => ({
        ...log,
        profiles: profilesData?.find(p => p.id === log.sent_by) || null,
        jobs: log.job_id ? jobsData?.find(j => j.id === log.job_id) || null : null,
      }));

      if (!data) throw new Error('No data');
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching LinkedIn messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Linkedin className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No LinkedIn messages sent to this candidate yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Linkedin className="w-4 h-4 text-[#0077B5]" />
        LinkedIn Message History
      </h4>
      
      <div className="space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="border rounded-lg p-4 bg-muted/30 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarFallback className="text-xs">
                    {msg.profiles?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">
                  {msg.profiles?.full_name || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {msg.jobs?.title && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Briefcase className="w-3 h-3" />
                    {msg.jobs.title}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs">
                  {msg.status}
                </Badge>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {msg.message_text}
            </p>
            
            <p className="text-xs text-muted-foreground">
              {format(new Date(msg.sent_at), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
