import { useState } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MatchScoreCircle } from '@/components/matching/MatchScoreCircle';
import { Link } from 'react-router-dom';

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
  applied: 'border-t-muted-foreground',
  screening: 'border-t-info',
  interview: 'border-t-warning',
  technical: 'border-t-accent',
  offer: 'border-t-success',
  hired: 'border-t-success',
  rejected: 'border-t-destructive',
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

const activeStages: DatabasePipelineStage[] = ['applied', 'screening', 'interview', 'technical', 'offer', 'hired'];

export function KanbanBoard({ candidates, onMoveCandidate, onRefresh }: KanbanBoardProps) {
  const [draggedCandidate, setDraggedCandidate] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {activeStages.map((stage) => {
          const stageCandidates = getCandidatesForStage(stage);

          return (
            <div
              key={stage}
              className={cn(
                'w-72 flex-shrink-0 bg-muted/30 rounded-xl border-t-4 transition-colors',
                stageColors[stage],
                draggedCandidate && 'opacity-90'
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(stage)}
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{stageLabels[stage]}</h3>
                  <span className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {stageCandidates.length}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-3 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {stageCandidates.map((jc) => (
                    <motion.div
                      key={jc.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      draggable={!isUpdating}
                      onDragStart={() => handleDragStart(jc.candidateId)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'cursor-grab active:cursor-grabbing',
                        draggedCandidate === jc.candidateId && 'opacity-50',
                        isUpdating && 'pointer-events-none'
                      )}
                    >
                      <Link
                        to={`/candidates/${jc.candidateId}`}
                        className="block bg-card rounded-lg border border-border p-3 hover:shadow-md hover:border-accent/30 transition-all"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={jc.candidate.avatar} alt={jc.candidate.name} />
                            <AvatarFallback className="text-xs bg-accent/10 text-accent">
                              {jc.candidate.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-foreground truncate">{jc.candidate.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{jc.candidate.currentTitle || 'No title'}</p>
                          </div>
                          {jc.matchScore && (
                            <MatchScoreCircle score={jc.matchScore} size="sm" showLabel={false} />
                          )}
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {stageCandidates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No candidates
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
