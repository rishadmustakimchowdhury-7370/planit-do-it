import { AppLayout } from '@/components/layout/AppLayout';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { jobs, candidates, sampleMatchScore } from '@/data/mockData';
import { Sparkles, Upload, FileText, Users, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AIMatchPage = () => {
  return (
    <AppLayout title="AI Matching" subtitle="Match candidates to jobs using AI-powered analysis.">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Selection Panel */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              Select Job
            </h3>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Choose a job..." />
              </SelectTrigger>
              <SelectContent>
                {jobs.map(job => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.title} - {job.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-4 text-center">
              <span className="text-sm text-muted-foreground">or</span>
            </div>
            <Button variant="outline" className="w-full mt-2 gap-2">
              <Upload className="w-4 h-4" />
              Upload Job Description
            </Button>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-accent" />
              Select Candidate
            </h3>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Choose a candidate..." />
              </SelectTrigger>
              <SelectContent>
                {candidates.map(candidate => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.name} - {candidate.currentTitle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-4 text-center">
              <span className="text-sm text-muted-foreground">or</span>
            </div>
            <Button variant="outline" className="w-full mt-2 gap-2">
              <Upload className="w-4 h-4" />
              Upload CV
            </Button>
          </Card>

          <Button className="w-full gap-2 h-12 text-lg">
            <Sparkles className="w-5 h-5" />
            Run AI Match
          </Button>
        </motion.div>

        {/* Right: Results Panel */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-2 space-y-6"
        >
          <Card className="p-8 text-center">
            <h3 className="text-xl font-semibold mb-4">Match Score</h3>
            <div className="flex justify-center mb-6">
              <MatchScoreCircle score={sampleMatchScore.score} size="lg" />
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">{sampleMatchScore.summary}</p>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-success" />
                Strengths
              </h3>
              <ul className="space-y-2">
                {sampleMatchScore.strengths.slice(0, 3).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-success mt-2" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-6">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-destructive" />
                Skill Gaps
              </h3>
              <div className="flex flex-wrap gap-2">
                {sampleMatchScore.skillGaps.map((gap, i) => (
                  <Badge key={i} variant="outline" className="bg-destructive/10 text-destructive">
                    {gap}
                  </Badge>
                ))}
              </div>
            </Card>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default AIMatchPage;
