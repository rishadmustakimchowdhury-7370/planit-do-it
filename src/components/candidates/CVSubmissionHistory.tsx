import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  FileText, 
  User, 
  Calendar, 
  Briefcase,
  Clock
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface CVSubmission {
  id: string;
  candidate_id: string;
  job_id: string;
  submitted_by: string;
  submitted_at: string;
  job?: {
    id: string;
    title: string;
    created_at: string;
    created_by: string;
  };
  submitter?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
  job_creator?: {
    id: string;
    full_name: string;
    email: string;
  };
}

interface CVSubmissionHistoryProps {
  candidateId: string;
}

export function CVSubmissionHistory({ candidateId }: CVSubmissionHistoryProps) {
  const { tenantId } = useAuth();
  const [submissions, setSubmissions] = useState<CVSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (candidateId && tenantId) {
      fetchSubmissions();
    }
  }, [candidateId, tenantId]);

  const fetchSubmissions = async () => {
    try {
      // Fetch submissions
      const { data: submissionData, error: submissionError } = await supabase
        .from('cv_submissions')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('submitted_at', { ascending: false });

      if (submissionError) throw submissionError;

      if (!submissionData || submissionData.length === 0) {
        setSubmissions([]);
        setIsLoading(false);
        return;
      }

      // Fetch related jobs
      const jobIds = submissionData.map(s => s.job_id);
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id, title, created_at, created_by')
        .in('id', jobIds);

      // Fetch submitter profiles
      const submitterIds = [...new Set(submissionData.map(s => s.submitted_by))];
      const { data: submitters } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', submitterIds);

      // Fetch job creator profiles
      const jobCreatorIds = [...new Set(jobs?.map(j => j.created_by).filter(Boolean) || [])];
      const { data: jobCreators } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', jobCreatorIds);

      // Combine data
      const enrichedSubmissions: CVSubmission[] = submissionData.map(submission => {
        const job = jobs?.find(j => j.id === submission.job_id);
        const submitter = submitters?.find(s => s.id === submission.submitted_by);
        const jobCreator = job?.created_by ? jobCreators?.find(c => c.id === job.created_by) : null;

        return {
          ...submission,
          job: job || undefined,
          submitter: submitter || undefined,
          job_creator: jobCreator || undefined,
        };
      });

      setSubmissions(enrichedSubmissions);
    } catch (error) {
      console.error('Error fetching CV submissions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            CV Submission History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4" />
          CV Submission History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">
            This CV hasn't been submitted to any jobs yet
          </p>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission, index) => (
              <motion.div
                key={submission.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-muted/30 rounded-lg p-4 space-y-3"
              >
                {/* Job Info */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-accent" />
                    <Link 
                      to={`/jobs/${submission.job_id}`}
                      className="font-medium hover:underline"
                    >
                      {submission.job?.title || 'Unknown Job'}
                    </Link>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {format(new Date(submission.submitted_at), 'MMM d, yyyy')}
                  </Badge>
                </div>

                {/* Submission Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {/* Submitted By */}
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={submission.submitter?.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {submission.submitter?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs text-muted-foreground">Submitted By</p>
                      <p className="font-medium">{submission.submitter?.full_name || 'Unknown'}</p>
                    </div>
                  </div>

                  {/* Submitted At */}
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Submitted At</p>
                      <p className="font-medium">
                        {format(new Date(submission.submitted_at), 'h:mm a, MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

                  {/* Job Created By */}
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Job Created By</p>
                      <p className="font-medium">{submission.job_creator?.full_name || 'Unknown'}</p>
                    </div>
                  </div>

                  {/* Job Created At */}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Job Created</p>
                      <p className="font-medium">
                        {submission.job?.created_at 
                          ? format(new Date(submission.job.created_at), 'MMM d, yyyy')
                          : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper function to log CV submission
export async function logCVSubmission(
  tenantId: string,
  candidateId: string,
  jobId: string,
  submittedBy: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('cv_submissions')
      .upsert({
        tenant_id: tenantId,
        candidate_id: candidateId,
        job_id: jobId,
        submitted_by: submittedBy,
        submitted_at: new Date().toISOString(),
      }, {
        onConflict: 'candidate_id,job_id',
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error logging CV submission:', error);
    return false;
  }
}
