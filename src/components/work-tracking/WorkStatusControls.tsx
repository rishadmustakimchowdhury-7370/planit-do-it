import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Play, 
  Pause, 
  Coffee, 
  StopCircle, 
  Loader2,
  Clock,
  Timer,
  Save,
  Calendar as CalendarIcon,
  Globe
} from 'lucide-react';
import { useWorkTracking, formatDuration, WorkAction, WorkStatus } from '@/hooks/useWorkTracking';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { COMMON_TIMEZONES, getUserTimezone } from '@/lib/timezones';

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
    saveSummary,
  } = useWorkTracking();

  const [liveMinutes, setLiveMinutes] = useState({ workMinutes: 0, breakMinutes: 0 });
  const [bodSummary, setBodSummary] = useState('');
  const [eodSummary, setEodSummary] = useState('');
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimezone, setSelectedTimezone] = useState<string>(getUserTimezone());

  // Update live time every minute and load summaries
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

  // Load summaries when session changes
  useEffect(() => {
    if (todaySession) {
      setBodSummary(todaySession.bod_summary || '');
      setEodSummary(todaySession.eod_summary || '');
    }
  }, [todaySession]);

  const handleSaveSummary = async (type: 'bod' | 'eod') => {
    setIsSavingSummary(true);
    try {
      const summary = type === 'bod' ? bodSummary : eodSummary;
      await saveSummary(type, summary);
      toast.success(`${type === 'bod' ? 'BOD' : 'EOD'} summary saved`);
    } catch (error) {
      toast.error('Failed to save summary');
    } finally {
      setIsSavingSummary(false);
    }
  };

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

        {/* Date and Timezone Selectors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(selectedDate, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
              <SelectTrigger>
                <Globe className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

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
                onClick={() => logAction(action, selectedDate, selectedTimezone)}
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

        {/* BOD Summary */}
        {currentStatus !== 'ended' && (
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="bod-summary">Beginning of Day Summary</Label>
            <Textarea
              id="bod-summary"
              placeholder="What are your goals for today?"
              value={bodSummary}
              onChange={(e) => setBodSummary(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button
              onClick={() => handleSaveSummary('bod')}
              disabled={isSavingSummary}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isSavingSummary ? (
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
              ) : (
                <Save className="h-3 w-3 mr-2" />
              )}
              Save BOD Summary
            </Button>
          </div>
        )}

        {/* EOD Summary */}
        {todaySession?.started_at && (
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="eod-summary">End of Day Summary</Label>
            <Textarea
              id="eod-summary"
              placeholder="What did you accomplish today?"
              value={eodSummary}
              onChange={(e) => setEodSummary(e.target.value)}
              rows={3}
              className="resize-none"
            />
            <Button
              onClick={() => handleSaveSummary('eod')}
              disabled={isSavingSummary}
              variant="outline"
              size="sm"
              className="w-full"
            >
              {isSavingSummary ? (
                <Loader2 className="h-3 w-3 animate-spin mr-2" />
              ) : (
                <Save className="h-3 w-3 mr-2" />
              )}
              Save EOD Summary
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
