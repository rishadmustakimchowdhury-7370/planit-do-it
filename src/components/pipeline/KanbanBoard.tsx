import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { Link } from 'react-router-dom';
import { X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Database pipeline stages matching the enum
type DatabasePipelineStage = 'applied' | 'screening' | 'interview' | 'technical' | 'offer' | 'hired' | 'rejected';

interface KanbanCandidate {
  id: string;
  jobId: string;
  candidateId: string;
  candidate: {
    id: string;
    name: string;
    currentTitle: string;
    avatar?: string;
    matchScore?: number;
  };
  stage: DatabasePipelineStage;
  matchScore?: number;
  appliedAt: Date;
}

interface KanbanBoardProps {
  candidates: KanbanCandidate[];
  onMoveCandidate?: (candidateId: string, newStage: DatabasePipelineStage) => void;
  onRefresh?: () => void;
}

const stageColors: Record<DatabasePipelineStage, string> = {
  applied: 'border-t-slate-400',
  screening: 'border-t-sky-500',
  interview: 'border-t-amber-500',
  technical: 'border-t-violet-500',
  offer: 'border-t-emerald-500',
  hired: 'border-t-green-600',
  rejected: 'border-t-rose-500',
};

const stageBgColors: Record<DatabasePipelineStage, string> = {
  applied: 'bg-slate-50 dark:bg-slate-900/30',
  screening: 'bg-sky-50 dark:bg-sky-900/20',
  interview: 'bg-amber-50 dark:bg-amber-900/20',
  technical: 'bg-violet-50 dark:bg-violet-900/20',
  offer: 'bg-emerald-50 dark:bg-emerald-900/20',
  hired: 'bg-green-50 dark:bg-green-900/20',
  rejected: 'bg-rose-50 dark:bg-rose-900/20',
};

const stageLabels: Record<DatabasePipelineStage, string> = {
  applied: 'New',
  screening: 'Screening',
  interview: 'Interview',
  technical: 'Technical',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
};

const activeStages: DatabasePipelineStage[] = ['applied', 'screening', 'interview', 'technical', 'offer', 'hired', 'rejected'];

export function KanbanBoard({ candidates, onMoveCandidate, onRefresh }: KanbanBoardProps) {
  const [draggedCandidate, setDraggedCandidate] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<KanbanCandidate | null>(null);

  const getCandidatesForStage = (stage: DatabasePipelineStage) => {
    return candidates.filter(c => c.stage === stage);
  };

  const handleDragStart = (candidateId: string) => {
    setDraggedCandidate(candidateId);
  };

  const handleDragEnd = () => {
    setDraggedCandidate(null);
  };

  // Map pipeline stage to candidate status for sync
  const pipelineToStatus: Record<DatabasePipelineStage, string> = {
    applied: 'new',
    screening: 'screening',
    interview: 'interviewing',
    technical: 'interviewing',
    offer: 'offered',
    hired: 'hired',
    rejected: 'rejected',
  };

  const handleDrop = async (stage: DatabasePipelineStage) => {
    if (!draggedCandidate) return;
    
    const candidate = candidates.find(c => c.candidateId === draggedCandidate);
    if (!candidate || candidate.stage === stage) {
      setDraggedCandidate(null);
      return;
    }

    setIsUpdating(true);
    try {
      // Update job_candidates table
      const { error } = await supabase
        .from('job_candidates')
        .update({ 
          stage,
          stage_updated_at: new Date().toISOString()
        })
        .eq('id', candidate.id);

      if (error) throw error;

      // Also sync candidate status in candidates table
      const candidateStatus = pipelineToStatus[stage];
      await supabase
        .from('candidates')
        .update({ 
          status: candidateStatus as any,
          updated_at: new Date().toISOString()
        })
        .eq('id', candidate.candidateId);

      toast.success(`Moved to ${stageLabels[stage]}`);
      
      if (onMoveCandidate) {
        onMoveCandidate(draggedCandidate, stage);
      }
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error updating stage:', error);
      toast.error('Failed to update stage');
    } finally {
      setIsUpdating(false);
      setDraggedCandidate(null);
    }
  };

  const handleRemoveCandidate = async () => {
    if (!deleteCandidate) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('job_candidates')
        .delete()
        .eq('id', deleteCandidate.id);

      if (error) throw error;

      toast.success(`${deleteCandidate.candidate.name} removed from job`);
      setDeleteCandidate(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error('Error removing candidate:', error);
      toast.error('Failed to remove candidate');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="overflow-x-auto pb-4 -mx-2 px-2">
        <div className="flex gap-4 min-w-max">
          {activeStages.map((stage) => {
            const stageCandidates = getCandidatesForStage(stage);

            return (
              <div
                key={stage}
                className={cn(
                  'w-[280px] flex-shrink-0 rounded-xl border-t-4 shadow-sm transition-all duration-200',
                  stageColors[stage],
                  stageBgColors[stage],
                  draggedCandidate && 'ring-2 ring-accent/20'
                )}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(stage)}
              >
                <div className="p-4 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground text-sm tracking-wide uppercase">
                      {stageLabels[stage]}
                    </h3>
                    <span className="text-xs font-medium text-muted-foreground bg-background/80 px-2.5 py-1 rounded-full shadow-sm">
                      {stageCandidates.length}
                    </span>
                  </div>
                </div>
                <div className="p-3 space-y-2.5 min-h-[250px] max-h-[500px] overflow-y-auto">
                  <AnimatePresence mode="popLayout">
                    {stageCandidates.map((jc) => (
                      <motion.div
                        key={jc.id}
                        layout
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        draggable={!isUpdating}
                        onDragStart={() => handleDragStart(jc.candidateId)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          'group cursor-grab active:cursor-grabbing',
                          draggedCandidate === jc.candidateId && 'opacity-50 scale-95',
                          isUpdating && 'pointer-events-none'
                        )}
                      >
                        <div className="relative bg-card rounded-lg border border-border/60 p-3 hover:shadow-md hover:border-accent/40 transition-all duration-200">
                          {/* Remove button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteCandidate(jc);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-destructive/90 z-10"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                          
                          <Link
                            to={`/candidates/${jc.candidateId}`}
                            className="block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="w-10 h-10 ring-2 ring-background shadow-sm">
                                <AvatarImage src={jc.candidate.avatar} alt={jc.candidate.name} />
                                <AvatarFallback className="text-xs font-medium bg-gradient-to-br from-accent/20 to-accent/10 text-accent">
                                  {jc.candidate.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-foreground truncate">
                                  {jc.candidate.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {jc.candidate.currentTitle || 'No title'}
                                </p>
                              </div>
                              {jc.matchScore && (
                                <MatchScoreCircle score={jc.matchScore} size="sm" showLabel={false} />
                              )}
                            </div>
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {stageCandidates.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                        <span className="text-lg">👤</span>
                      </div>
                      <p className="text-sm">No candidates</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={() => setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Remove Candidate from Job
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteCandidate?.candidate.name}</strong> from this job? 
              This will only remove them from this job's pipeline, not delete the candidate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveCandidate} 
              disabled={isUpdating}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isUpdating ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}