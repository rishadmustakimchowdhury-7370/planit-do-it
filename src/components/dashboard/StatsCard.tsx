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
        'relative p-5 rounded-xl border border-border transition-all duration-200',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground mb-1">
            {title}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          
          {change && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className={cn(
                'inline-flex items-center gap-1 text-xs font-medium',
                change.positive ? 'text-success' : 'text-destructive'
              )}>
                {change.positive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(change.value)}%
              </span>
              <span className="text-xs text-muted-foreground">vs last period</span>
            </div>
          )}
          
          {subtitle && !change && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className={cn(
          'flex-shrink-0 p-2.5 rounded-lg',
          iconStyles[variant]
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}