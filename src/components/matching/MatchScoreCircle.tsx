import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface MatchScoreCircleProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeClasses = {
  sm: 'w-12 h-12 text-sm',
  md: 'w-20 h-20 text-xl',
  lg: 'w-32 h-32 text-3xl',
};

export function MatchScoreCircle({ score, size = 'md', showLabel = true }: MatchScoreCircleProps) {
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 90) return { stroke: 'stroke-success', text: 'text-success', glow: 'shadow-success/30' };
    if (score >= 70) return { stroke: 'stroke-accent', text: 'text-accent', glow: 'shadow-accent/30' };
    if (score >= 50) return { stroke: 'stroke-warning', text: 'text-warning', glow: 'shadow-warning/30' };
    return { stroke: 'stroke-destructive', text: 'text-destructive', glow: 'shadow-destructive/30' };
  };

  const colors = getScoreColor(score);

  return (
    <div className={cn('relative flex items-center justify-center', sizeClasses[size])}>
      <svg
        className="absolute inset-0 -rotate-90"
        viewBox="0 0 100 100"
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        {/* Progress circle */}
        <motion.circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          className={colors.stroke}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className={cn('font-bold', colors.text)}
        >
          {score}%
        </motion.span>
        {showLabel && size === 'lg' && (
          <span className="text-xs text-muted-foreground mt-1">Match Score</span>
        )}
      </div>
    </div>
  );
}
