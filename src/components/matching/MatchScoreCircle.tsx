import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { scoreToRecommendation } from '@/lib/recommendation';

interface MatchScoreCircleProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  /** Show the internal numeric score as a small secondary line. Off by default — we lead with the recruiter recommendation. */
  showInternalScore?: boolean;
}

// Backward-compatible export: the historical "score circle" now renders the
// recruiter recommendation as the primary signal. Score is kept internally and
// only shown if `showInternalScore` is true.
const sizeClasses = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export function MatchScoreCircle({ score, size = 'md', showLabel = true, showInternalScore = false }: MatchScoreCircleProps) {
  const meta = scoreToRecommendation(score);

  return (
    <motion.div
      initial={{ opacity: 0, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'inline-flex flex-col items-center justify-center gap-0.5',
      )}
    >
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-medium leading-none',
          meta.badgeClass,
          sizeClasses[size],
        )}
        title={`Internal ranking signal: ${score}`}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotClass)} />
        {showLabel ? meta.label : <span className="sr-only">{meta.label}</span>}
      </span>
      {showInternalScore && (
        <span className="text-[10px] text-muted-foreground font-normal">{score}</span>
      )}
    </motion.div>
  );
}
