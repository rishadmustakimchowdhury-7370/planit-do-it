import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, MessageSquare, User, Clock, CheckCircle, AlertCircle, Send, Volume2, VolumeX, Bell } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth';

interface ChatConversation {
  id: string;
  visitor_name: string | null;
  visitor_email: string | null;
  visitor_id: string | null;
  status: string;
  is_bot_handled: boolean;
  assigned_to: string | null;
  started_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
}

interface ChatMessage {
  id: string;
  conversation_id: string;
  message: string;
  sender_type: string;
  sender_id: string | null;
  created_at: string | null;
}

// Notification sound - simple beep
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.log('Could not play notification sound');
  }
};

export default function AdminLiveChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevConversationsRef = useRef<ChatConversation[]>([]);

  useEffect(() => {
    fetchConversations();
    
    // Subscribe to real-time updates
    const channel = supabase
      .channel('admin_chat_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const conv = payload.new as ChatConversation;
          
          // Check if this is a new escalated conversation
          if (payload.eventType === 'UPDATE' && conv.status === 'escalated') {
            if (soundEnabled) playNotificationSound();
            toast.info(`${conv.visitor_name || 'Visitor'} is requesting live support!`, {
              duration: 10000,
              action: {
                label: 'View',
                onClick: () => handleSelectConversation(conv)
              }
            });
          }
          
          // Check for new conversations
          if (payload.eventType === 'INSERT') {
            if (soundEnabled) playNotificationSound();
          }
        }
        fetchConversations();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        
        // If message is from visitor and not in currently selected conversation
        if (newMsg.sender_type === 'visitor') {
          if (!selectedConversation || newMsg.conversation_id !== selectedConversation.id) {
            if (soundEnabled) playNotificationSound();
            setUnreadCount(prev => prev + 1);
          }
        }
        
        if (selectedConversation && newMsg.conversation_id === selectedConversation.id) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversation?.id, soundEnabled]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Calculate unread escalated conversations
    const escalatedCount = conversations.filter(c => 
      c.status === 'escalated' && !c.assigned_to
    ).length;
    setUnreadCount(escalatedCount);
  }, [conversations]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setConversations(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch conversations: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast.error('Failed to fetch messages: ' + error.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectConversation = (conversation: ChatConversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  const handleTakeOver = async () => {
    if (!selectedConversation || !user) return;
    
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({ 
          assigned_to: user.id,
          is_bot_handled: false,
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedConversation.id);

      if (error) throw error;
      
      // Send system message
      await supabase.from('chat_messages').insert({
        conversation_id: selectedConversation.id,
        message: "A support agent has joined the conversation. How can I help you?",
        sender_type: 'agent',
        sender_id: user.id,
      });
      
      toast.success('You are now handling this conversation');
      fetchConversations();
      fetchMessages(selectedConversation.id);
    } catch (error: any) {
      toast.error('Failed to take over: ' + error.message);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;

    setSending(true);
    try {
      const { error } = await supabase.from('chat_messages').insert({
        conversation_id: selectedConversation.id,
        message: newMessage,
        sender_type: 'agent',
        sender_id: user.id,
      });

      if (error) throw error;
      
      // Update conversation
      await supabase
        .from('chat_conversations')
        .update({ 
          updated_at: new Date().toISOString(),
          assigned_to: user.id,
          is_bot_handled: false
        })
        .eq('id', selectedConversation.id);
      
      setNewMessage('');
    } catch (error: any) {
      toast.error('Failed to send message: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (conversationId: string, status: string) => {
    try {
      const updates: any = { status, updated_at: new Date().toISOString() };
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('chat_conversations')
        .update(updates)
        .eq('id', conversationId);

      if (error) throw error;
      toast.success('Status updated');
      fetchConversations();
      
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(prev => prev ? { ...prev, status } : null);
      }
    } catch (error: any) {
      toast.error('Failed to update status: ' + error.message);
    }
  };

  const filteredConversations = filter === 'all'
    ? conversations
    : conversations.filter(c => c.status === filter);

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-blue-100 text-blue-800',
    resolved: 'bg-green-100 text-green-800',
    escalated: 'bg-red-100 text-red-800 animate-pulse',
  };

  const statusIcons: Record<string, any> = {
    pending: Clock,
    active: MessageSquare,
    resolved: CheckCircle,
    escalated: AlertCircle,
  };

  return (
    <AdminLayout title="Live Chat" description="Manage support conversations in real-time">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              <Bell className="h-3 w-3 mr-1" />
              {unreadCount} awaiting response
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSoundEnabled(!soundEnabled)}
        >
          {soundEnabled ? (
            <>
              <Volume2 className="h-4 w-4 mr-2" />
              Sound On
            </>
          ) : (
            <>
              <VolumeX className="h-4 w-4 mr-2" />
              Sound Off
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)]">
        {/* Conversations List */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Conversations</CardTitle>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No conversations</p>
                </div>
              ) : (
                <div className="space-y-1 p-3">
                  {filteredConversations.map((conv) => {
                    const StatusIcon = statusIcons[conv.status] || MessageSquare;
                    const isEscalated = conv.status === 'escalated' && !conv.assigned_to;
                    
                    return (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        className={`w-full text-left p-3 rounded-lg transition-colors ${
                          selectedConversation?.id === conv.id
                            ? 'bg-primary/10 border border-primary/20'
                            : isEscalated
                            ? 'bg-red-50 border border-red-200 hover:bg-red-100'
                            : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-4 w-4 ${isEscalated ? 'text-red-500' : 'text-muted-foreground'}`} />
                            <span className="font-medium">
                              {conv.visitor_name || conv.visitor_email || 'Anonymous'}
                            </span>
                          </div>
                          <Badge className={statusColors[conv.status] || 'bg-gray-100'}>
                            {conv.status}
                          </Badge>
                        </div>
                        {conv.visitor_email && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {conv.visitor_email}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {conv.updated_at && formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedConversation ? (
            <>
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {selectedConversation.visitor_name || 'Anonymous Visitor'}
                      {selectedConversation.status === 'escalated' && !selectedConversation.assigned_to && (
                        <Badge variant="destructive" className="animate-pulse">Needs Attention</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {selectedConversation.visitor_email || 'No email provided'}
                      {selectedConversation.assigned_to && ' • Assigned to you'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedConversation.status === 'escalated' && !selectedConversation.assigned_to && (
                      <Button onClick={handleTakeOver} size="sm">
                        Take Over Chat
                      </Button>
                    )}
                    <Select
                      value={selectedConversation.status}
                      onValueChange={(value) => handleUpdateStatus(selectedConversation.id, value)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="escalated">Escalated</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full p-4">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No messages yet</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.sender_type === 'agent' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              msg.sender_type === 'agent'
                                ? 'bg-primary text-primary-foreground'
                                : msg.sender_type === 'bot'
                                ? 'bg-purple-100 text-purple-900'
                                : 'bg-muted'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                            <p className={`text-xs mt-1 ${
                              msg.sender_type === 'agent' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {msg.sender_type === 'bot' ? 'AI Bot' : msg.sender_type === 'agent' ? 'Agent' : 'Visitor'}
                              {' · '}
                              {msg.created_at && format(new Date(msg.created_at), 'HH:mm')}
                            </p>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    disabled={sending}
                  />
                  <Button onClick={handleSendMessage} disabled={sending || !newMessage.trim()}>
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a conversation to view messages</p>
                <p className="text-sm mt-2">Escalated chats will appear with a red badge</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
