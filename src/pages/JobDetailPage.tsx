import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { KanbanBoard } from '@/components/pipeline/KanbanBoard';
import { jobs, jobCandidates, clients } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  MapPin, 
  DollarSign, 
  Calendar, 
  Users, 
  Sparkles, 
  Edit, 
  Upload, 
  UserPlus,
  Building2,
  FileText
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const statusColors = {
  open: 'bg-success/10 text-success border-success/30',
  closed: 'bg-muted text-muted-foreground border-muted',
  'on-hold': 'bg-warning/10 text-warning border-warning/30',
};

const JobDetailPage = () => {
  const { id } = useParams();
  const job = jobs.find(j => j.id === id);
  const client = clients.find(c => c.id === job?.clientId);
  const candidates = jobCandidates.filter(jc => jc.jobId === id);

  if (!job) {
    return (
      <AppLayout title="Job Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">This job doesn't exist.</p>
          <Link to="/jobs" className="text-accent hover:underline mt-2 inline-block">
            Back to Jobs
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={job.title} subtitle={job.clientName}>
      {/* Header */}
      <div className="mb-6">
        <Link 
          to="/jobs" 
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Jobs
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
                <Badge 
                  variant="outline" 
                  className={cn('capitalize', statusColors[job.status])}
                >
                  {job.status}
                </Badge>
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Building2 className="w-4 h-4 text-accent" />
                <Link 
                  to={`/clients/${job.clientId}`} 
                  className="text-accent hover:underline font-medium"
                >
                  {job.clientName}
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4 text-accent" />
                  <span className="text-sm">{job.location}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-4 h-4 text-success" />
                  <span className="text-sm">{job.salaryRange}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-4 h-4 text-info" />
                  <span className="text-sm">{candidates.length} candidates</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Posted {formatDistanceToNow(job.createdAt, { addSuffix: true })}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Upload className="w-4 h-4" />
                Upload JD
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Edit className="w-4 h-4" />
                Edit Job
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5">
                <UserPlus className="w-4 h-4" />
                Add Candidates
              </Button>
              <Button size="sm" className="gap-1.5">
                <Sparkles className="w-4 h-4" />
                Run AI Match
              </Button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="pipeline" className="gap-2">
            <Users className="w-4 h-4" />
            Pipeline ({candidates.length})
          </TabsTrigger>
          <TabsTrigger value="description" className="gap-2">
            <FileText className="w-4 h-4" />
            Job Description
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="mt-6">
          <KanbanBoard candidates={candidates} />
        </TabsContent>

        <TabsContent value="description" className="mt-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Job Description</h3>
            <p className="text-muted-foreground leading-relaxed">{job.description}</p>
            
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="font-medium mb-3">Requirements</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>5+ years of experience in software development</li>
                <li>Strong proficiency in React and TypeScript</li>
                <li>Experience with modern frontend tooling</li>
                <li>Excellent communication skills</li>
              </ul>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default JobDetailPage;
