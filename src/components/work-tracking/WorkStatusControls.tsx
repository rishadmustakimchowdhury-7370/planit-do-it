import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Coffee, 
  StopCircle, 
  Loader2,
  Clock,
  Timer
} from 'lucide-react';
import { useWorkTracking, formatDuration, WorkAction, WorkStatus } from '@/hooks/useWorkTracking';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

const statusConfig: Record<WorkStatus, { label: string; color: string; icon: React.ElementType }> = {
  'working': { label: 'Working', color: 'bg-success text-success-foreground', icon: Play },
  'on_break': { label: 'On Break', color: 'bg-warning text-warning-foreground', icon: Coffee },
  'ended': { label: 'Offline', color: 'bg-muted text-muted-foreground', icon: StopCircle },
};

const actionConfig: Record<WorkAction, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  'start_work': { label: 'Start Work', icon: Play, variant: 'default' },
  'start_break': { label: 'Take Break', icon: Coffee, variant: 'secondary' },
  'resume_work': { label: 'Resume Work', icon: Play, variant: 'default' },
  'end_work': { label: 'End Work', icon: StopCircle, variant: 'destructive' },
};

export function WorkStatusControls() {
  const { 
    currentStatus, 
    todaySession, 
    isLoading, 
    isActionLoading, 
    logAction, 
    getAvailableActions,
    fetchTodayLogs,
    calculateMinutesFromLogs,
  } = useWorkTracking();

  const [liveMinutes, setLiveMinutes] = useState({ workMinutes: 0, breakMinutes: 0 });

  // Update live time every minute
  useEffect(() => {
    const updateLiveTime = async () => {
      const logs = await fetchTodayLogs();
      const { workMinutes, breakMinutes } = calculateMinutesFromLogs(logs);
      setLiveMinutes({ workMinutes, breakMinutes });
    };

    updateLiveTime();
    const interval = setInterval(updateLiveTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [currentStatus, fetchTodayLogs, calculateMinutesFromLogs]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const availableActions = getAvailableActions();
  const StatusIcon = statusConfig[currentStatus].icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Work Status
            </CardTitle>
            <CardDescription>Track your working hours</CardDescription>
          </div>
          <Badge className={cn('gap-1.5', statusConfig[currentStatus].color)}>
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig[currentStatus].label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Live time display */}
        <div className="grid grid-cols-2 gap-4">
          <motion.div 
            key={liveMinutes.workMinutes}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-success/10 rounded-lg p-4 text-center"
          >
            <Timer className="h-5 w-5 mx-auto text-success mb-2" />
            <p className="text-2xl font-bold text-success">
              {formatDuration(liveMinutes.workMinutes)}
            </p>
            <p className="text-xs text-muted-foreground">Work Time</p>
          </motion.div>
          
          <motion.div 
            key={liveMinutes.breakMinutes}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-warning/10 rounded-lg p-4 text-center"
          >
            <Coffee className="h-5 w-5 mx-auto text-warning mb-2" />
            <p className="text-2xl font-bold text-warning">
              {formatDuration(liveMinutes.breakMinutes)}
            </p>
            <p className="text-xs text-muted-foreground">Break Time</p>
          </motion.div>
        </div>

        {/* Session info */}
        {todaySession?.started_at && (
          <div className="text-sm text-muted-foreground text-center">
            Started at {new Date(todaySession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {todaySession.ended_at && (
              <> • Ended at {new Date(todaySession.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          {availableActions.map((action) => {
            const config = actionConfig[action];
            const ActionIcon = config.icon;
            
            return (
              <Button
                key={action}
                variant={config.variant}
                size="lg"
                className="gap-2 min-w-[140px]"
                onClick={() => logAction(action)}
                disabled={isActionLoading}
              >
                {isActionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ActionIcon className="h-4 w-4" />
                )}
                {config.label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
