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
  default: 'bg-card border-border/50 hover:border-border',
  primary: 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 hover:border-primary/40',
  accent: 'bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20 hover:border-accent/40',
  success: 'bg-gradient-to-br from-success/5 to-success/10 border-success/20 hover:border-success/40',
  warning: 'bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20 hover:border-warning/40',
  info: 'bg-gradient-to-br from-info/5 to-info/10 border-info/20 hover:border-info/40',
};

const iconStyles = {
  default: 'bg-muted/80 text-muted-foreground',
  primary: 'bg-primary/15 text-primary',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
};

const valueStyles = {
  default: 'text-foreground',
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
};

export function StatsCard({ title, value, icon: Icon, change, subtitle, variant = 'default', delay = 0 }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={cn(
        'relative p-5 rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group',
        variantStyles[variant]
      )}
    >
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-current blur-2xl" />
      </div>
      
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 truncate">
            {title}
          </p>
          <p className={cn(
            'text-2xl lg:text-3xl font-bold mt-1.5 tracking-tight',
            valueStyles[variant]
          )}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          
          {change && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className={cn(
                'flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold',
                change.positive 
                  ? 'bg-success/15 text-success' 
                  : 'bg-destructive/15 text-destructive'
              )}>
                {change.positive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                <span>{Math.abs(change.value)}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground/70">vs last period</span>
            </div>
          )}
          
          {subtitle && !change && (
            <p className="text-xs text-muted-foreground/70 mt-2 truncate">
              {subtitle}
            </p>
          )}
        </div>
        
        <div className={cn(
          'flex-shrink-0 p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110',
          iconStyles[variant]
        )}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </motion.div>
  );
}
