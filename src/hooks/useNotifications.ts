import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  entity_type?: string;
  entity_id?: string;
  link?: string;
  is_read: boolean;
  is_email_sent: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  read_at?: string;
}

interface NotificationPreferences {
  sound_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
  do_not_disturb: boolean;
  dnd_start?: string;
  dnd_end?: string;
  event_types: Record<string, { in_app: boolean; email: boolean }>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  sound_enabled: true,
  email_enabled: true,
  in_app_enabled: true,
  do_not_disturb: false,
  event_types: {}
};

// Notification sound
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Could not play notification sound');
  }
};

export function useNotifications() {
  const { user, tenantId } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      const notifications = (data || []).map(n => ({
        ...n,
        metadata: (n.metadata as Record<string, any>) || {},
      }));
      setNotifications(notifications);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data } = await supabase
        .from('profiles')
        .select('notification_preferences')
        .eq('id', user.id)
        .single();

      if (data?.notification_preferences) {
        setPreferences(data.notification_preferences as unknown as NotificationPreferences);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    }
  }, [user?.id]);

  // Mark as read
  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  }, [user?.id]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n.id === notificationId);
        return notification && !notification.is_read ? prev - 1 : prev;
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [notifications]);

  // Update preferences
  const updatePreferences = useCallback(async (newPreferences: Partial<NotificationPreferences>) => {
    if (!user?.id) return;
    
    const updated = { ...preferences, ...newPreferences };
    setPreferences(updated);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: updated })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Notification preferences updated');
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences');
    }
  }, [user?.id, preferences]);

  // Setup realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();
    fetchPreferences();

    // Subscribe to realtime notifications
    channelRef.current = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
          
          // Play sound if enabled
          if (preferences.sound_enabled && !preferences.do_not_disturb) {
            playNotificationSound();
          }
          
          // Show toast
          toast.info(newNotification.title, {
            description: newNotification.message,
          });
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user?.id, fetchNotifications, fetchPreferences, preferences.sound_enabled, preferences.do_not_disturb]);

  return {
    notifications,
    unreadCount,
    isLoading,
    preferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreferences,
    refetch: fetchNotifications,
  };
}

// Helper to create notifications from server/edge functions
export async function createNotification(params: {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  metadata?: Record<string, any>;
}) {
  const { error } = await supabase.from('notifications').insert({
    tenant_id: params.tenantId,
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    entity_type: params.entityType,
    entity_id: params.entityId,
    link: params.link,
    metadata: params.metadata || {},
  });

  if (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}
