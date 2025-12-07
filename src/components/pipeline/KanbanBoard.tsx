import { useState } from 'react';
import { JobCandidate, PipelineStage } from '@/types/recruitment';
import { pipelineStages } from '@/data/mockData';
import { CandidateCard } from '@/components/candidates/CandidateCard';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface KanbanBoardProps {
  candidates: JobCandidate[];
  onMoveCandidate?: (candidateId: string, newStatus: PipelineStage) => void;
}

const stageColors: Record<PipelineStage, string> = {
  new: 'border-t-muted-foreground',
  screening: 'border-t-info',
  shortlisted: 'border-t-warning',
  interview: 'border-t-accent',
  offer: 'border-t-success',
  placed: 'border-t-success',
  rejected: 'border-t-destructive',
};

const activeStages: PipelineStage[] = ['new', 'screening', 'shortlisted', 'interview', 'offer', 'placed'];

export function KanbanBoard({ candidates, onMoveCandidate }: KanbanBoardProps) {
  const [draggedCandidate, setDraggedCandidate] = useState<string | null>(null);

  const getCandidatesForStage = (stage: PipelineStage) => {
    return candidates.filter(c => c.status === stage);
  };

  const handleDragStart = (candidateId: string) => {
    setDraggedCandidate(candidateId);
  };

  const handleDragEnd = () => {
    setDraggedCandidate(null);
  };

  const handleDrop = (stage: PipelineStage) => {
    if (draggedCandidate && onMoveCandidate) {
      onMoveCandidate(draggedCandidate, stage);
    }
    setDraggedCandidate(null);
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {activeStages.map((stage) => {
          const stageInfo = pipelineStages.find(s => s.id === stage);
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
                  <h3 className="font-semibold text-foreground">{stageInfo?.label}</h3>
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
                      draggable
                      onDragStart={() => handleDragStart(jc.candidateId)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        'cursor-grab active:cursor-grabbing',
                        draggedCandidate === jc.candidateId && 'opacity-50'
                      )}
                    >
                      <CandidateCard
                        candidate={jc.candidate}
                        showMatchScore={!!jc.matchScore}
                        compact
                      />
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
