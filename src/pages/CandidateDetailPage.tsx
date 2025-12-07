import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { candidates, sampleMatchScore, jobs } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  MapPin, 
  Mail, 
  Phone, 
  Calendar, 
  Sparkles, 
  FileText,
  Download,
  Edit,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { PipelineStage } from '@/types/recruitment';

const statusColors: Record<PipelineStage, string> = {
  new: 'bg-muted text-muted-foreground',
  screening: 'bg-info/10 text-info border-info/30',
  shortlisted: 'bg-warning/10 text-warning border-warning/30',
  interview: 'bg-accent/10 text-accent border-accent/30',
  offer: 'bg-success/10 text-success border-success/30',
  placed: 'bg-success/20 text-success border-success/40',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};

const statusLabels: Record<PipelineStage, string> = {
  new: 'New',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  placed: 'Placed',
  rejected: 'Rejected',
};

const CandidateDetailPage = () => {
  const { id } = useParams();
  const candidate = candidates.find(c => c.id === id);
  const matchScore = candidate?.id === '1' ? sampleMatchScore : null;

  if (!candidate) {
    return (
      <AppLayout title="Candidate Not Found">
        <div className="text-center py-12">
          <p className="text-muted-foreground">This candidate doesn't exist.</p>
          <Link to="/candidates" className="text-accent hover:underline mt-2 inline-block">
            Back to Candidates
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={candidate.name} subtitle={candidate.currentTitle}>
      {/* Header */}
      <div className="mb-6">
        <Link 
          to="/candidates" 
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Candidates
        </Link>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-xl border border-border p-6 shadow-sm"
        >
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={candidate.avatar} alt={candidate.name} />
                <AvatarFallback className="text-2xl bg-accent/10 text-accent">
                  {candidate.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">{candidate.name}</h1>
                  <Badge 
                    variant="outline" 
                    className={cn('capitalize', statusColors[candidate.status])}
                  >
                    {statusLabels[candidate.status]}
                  </Badge>
                </div>
                <p className="text-accent text-lg mt-1">{candidate.currentTitle}</p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4 text-accent" />
                    <span className="text-sm">{candidate.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 text-info" />
                    <span className="text-sm">{candidate.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 text-success" />
                    <span className="text-sm">{candidate.phone}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-4">
                  {candidate.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              {candidate.matchScore && (
                <MatchScoreCircle score={candidate.matchScore} size="lg" />
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="w-4 h-4" />
                  Download CV
                </Button>
                <Button size="sm" className="gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Run AI Match
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="match" className="w-full">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="match" className="gap-2">
            <Sparkles className="w-4 h-4" />
            AI Match Analysis
          </TabsTrigger>
          <TabsTrigger value="cv" className="gap-2">
            <FileText className="w-4 h-4" />
            CV & Experience
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Calendar className="w-4 h-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="match" className="mt-6">
          {matchScore ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Score Summary */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-1 bg-card rounded-xl border border-border p-6 text-center"
              >
                <h3 className="text-lg font-semibold mb-4">Match Score</h3>
                <div className="flex justify-center mb-4">
                  <MatchScoreCircle score={matchScore.score} size="lg" />
                </div>
                <p className="text-sm text-muted-foreground">{matchScore.summary}</p>
              </motion.div>

              {/* Strengths & Weaknesses */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="lg:col-span-2 space-y-4"
              >
                {/* Strengths */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-success" />
                    Strengths
                  </h3>
                  <ul className="space-y-2">
                    {matchScore.strengths.map((strength, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-success mt-2 flex-shrink-0" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <AlertCircle className="w-5 h-5 text-warning" />
                    Areas to Consider
                  </h3>
                  <ul className="space-y-2">
                    {matchScore.weaknesses.map((weakness, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-warning mt-2 flex-shrink-0" />
                        {weakness}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Skill Gaps */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                    <XCircle className="w-5 h-5 text-destructive" />
                    Skill Gaps
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {matchScore.skillGaps.map((gap, i) => (
                      <Badge key={i} variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                        {gap}
                      </Badge>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No AI Match Results</h3>
              <p className="text-muted-foreground mb-4">Run an AI match to see how this candidate fits your jobs.</p>
              <Button className="gap-2">
                <Sparkles className="w-4 h-4" />
                Run AI Match
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cv" className="mt-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Resume</h3>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <h4>Experience</h4>
              <p><strong>{candidate.currentTitle}</strong> - {candidate.experienceYears} years of experience</p>
              <p>Full resume preview would be displayed here with parsed CV data.</p>
              
              <h4>Skills</h4>
              <div className="flex flex-wrap gap-2 not-prose">
                {candidate.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card rounded-xl border border-border p-6 shadow-sm"
          >
            <h3 className="text-lg font-semibold mb-4">Activity Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-accent mt-2" />
                <div>
                  <p className="text-sm font-medium">Moved to {statusLabels[candidate.status]}</p>
                  <p className="text-xs text-muted-foreground">2 days ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-info mt-2" />
                <div>
                  <p className="text-sm font-medium">AI Match completed - {candidate.matchScore}% match</p>
                  <p className="text-xs text-muted-foreground">3 days ago</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-success mt-2" />
                <div>
                  <p className="text-sm font-medium">CV uploaded and parsed</p>
                  <p className="text-xs text-muted-foreground">5 days ago</p>
                </div>
              </div>
            </div>
          </motion.div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default CandidateDetailPage;
