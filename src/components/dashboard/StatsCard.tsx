import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  change?: {
    value: string;
    positive: boolean;
  };
  variant?: 'default' | 'accent' | 'success' | 'warning';
  delay?: number;
}

const variantStyles = {
  default: 'bg-card border-border',
  accent: 'bg-accent/10 border-accent/30',
  success: 'bg-success/10 border-success/30',
  warning: 'bg-warning/10 border-warning/30',
};

const iconStyles = {
  default: 'bg-muted text-muted-foreground',
  accent: 'bg-accent/20 text-accent',
  success: 'bg-success/20 text-success',
  warning: 'bg-warning/20 text-warning',
};

export function StatsCard({ title, value, icon: Icon, change, variant = 'default', delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        'p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow',
        variantStyles[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
          {change && (
            <p className={cn(
              'text-sm font-medium mt-2',
              change.positive ? 'text-success' : 'text-destructive'
            )}>
              {change.positive ? '+' : ''}{change.value}
              <span className="text-muted-foreground ml-1">vs last month</span>
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-xl', iconStyles[variant])}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </motion.div>
  );
}
