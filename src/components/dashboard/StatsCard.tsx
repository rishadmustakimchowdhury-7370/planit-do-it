import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: number;
    positive: boolean;
  };
  subtitle?: string;
  variant?: 'default' | 'primary' | 'accent' | 'success' | 'warning' | 'info';
  delay?: number;
}

const variantStyles = {
  default: 'bg-card hover:shadow-md',
  primary: 'bg-card hover:shadow-md',
  accent: 'bg-card hover:shadow-md',
  success: 'bg-card hover:shadow-md',
  warning: 'bg-card hover:shadow-md',
  info: 'bg-card hover:shadow-md',
};

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
};

export function StatsCard({ title, value, icon: Icon, change, subtitle, variant = 'default', delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'relative p-3 sm:p-4 lg:p-5 rounded-lg sm:rounded-xl border border-border transition-all duration-200',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-0.5 sm:mb-1 truncate">
            {title}
          </p>
          <p className="text-lg sm:text-xl lg:text-2xl font-semibold tracking-tight text-foreground">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          
          {change && (
            <div className="flex items-center gap-1 sm:gap-1.5 mt-1 sm:mt-2">
              <span className={cn(
                'inline-flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs font-medium',
                change.positive ? 'text-success' : 'text-destructive'
              )}>
                {change.positive ? (
                  <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                ) : (
                  <TrendingDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                )}
                {Math.abs(change.value)}%
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">vs last period</span>
            </div>
          )}
          
          {subtitle && !change && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-1.5 truncate">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className={cn(
          'flex-shrink-0 p-1.5 sm:p-2 lg:p-2.5 rounded-md sm:rounded-lg',
          iconStyles[variant]
        )}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </motion.div>
  );
}