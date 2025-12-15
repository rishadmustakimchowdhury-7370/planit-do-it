import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, X, Settings, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const notificationTypeIcons: Record<string, string> = {
  candidate_added: '👤',
  candidate_assigned: '📋',
  ai_match_complete: '🤖',
  event_scheduled: '📅',
  event_updated: '🔄',
  event_cancelled: '❌',
  email_sent: '✉️',
  email_failed: '⚠️',
  task_due: '⏰',
  system_alert: '🔔',
};

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'settings'>('notifications');
  
  const {
    notifications,
    unreadCount,
    isLoading,
    preferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
  } = useNotifications();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return dateStr;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center bg-destructive text-destructive-foreground text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setActiveTab(activeTab === 'settings' ? 'notifications' : 'settings')}
            >
              <Settings className="h-4 w-4" />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {activeTab === 'notifications' ? (
          <ScrollArea className="h-[400px]">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 hover:bg-muted/50 cursor-pointer transition-colors relative group",
                      !notification.is_read && "bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 text-lg">
                        {notificationTypeIcons[notification.type] || '🔔'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "font-medium text-sm line-clamp-1",
                            !notification.is_read && "text-foreground"
                          )}>
                            {notification.title}
                          </p>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(notification.created_at)}
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1">
                        {!notification.is_read && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        ) : (
          <div className="p-4 space-y-4">
            <h4 className="font-medium text-sm">Notification Settings</h4>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {preferences.sound_enabled ? (
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm">Sound notifications</span>
                </div>
                <Switch
                  checked={preferences.sound_enabled}
                  onCheckedChange={(checked) => updatePreferences({ sound_enabled: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Email notifications</span>
                <Switch
                  checked={preferences.email_enabled}
                  onCheckedChange={(checked) => updatePreferences({ email_enabled: checked })}
                />
              </div>
              
              <Separator />
              
              <div className="flex items-center justify-between">
                <span className="text-sm">Do not disturb</span>
                <Switch
                  checked={preferences.do_not_disturb}
                  onCheckedChange={(checked) => updatePreferences({ do_not_disturb: checked })}
                />
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => {
                navigate('/settings');
                setOpen(false);
              }}
            >
              All notification settings
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
