import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { MessageCircle, X, Send, Loader2, Minimize2, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  message: string;
  sender_type: string;
  created_at: string | null;
}

export function LiveChatWidget() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && !conversationId) {
      initializeConversation();
    }
  }, [isOpen]);

  useEffect(() => {
    if (conversationId) {
      // Subscribe to new messages
      const channel = supabase
        .channel(`chat_${conversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeConversation = async () => {
    setLoading(true);
    try {
      // Check for existing active conversation
      const { data: existingConversation, error: fetchError } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('visitor_email', profile?.email || user?.email)
        .neq('status', 'resolved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingConversation) {
        setConversationId(existingConversation.id);
        fetchMessages(existingConversation.id);
      } else {
        // Create new conversation
        const { data: newConversation, error: createError } = await supabase
          .from('chat_conversations')
          .insert({
            visitor_name: profile?.full_name || 'User',
            visitor_email: profile?.email || user?.email,
            visitor_id: user?.id,
            status: 'pending',
            is_bot_handled: true,
          })
          .select()
          .single();

        if (createError) throw createError;

        setConversationId(newConversation.id);

        // Send welcome message
        await supabase.from('chat_messages').insert({
          conversation_id: newConversation.id,
          message: "Hello! 👋 How can I help you today?",
          sender_type: 'bot',
        });
      }
    } catch (error) {
      console.error('Failed to initialize conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    setSending(true);
    const messageText = newMessage;
    setNewMessage('');

    try {
      // Send user message
      const { error: sendError } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        message: messageText,
        sender_type: 'visitor',
        sender_id: user?.id,
      });

      if (sendError) throw sendError;

      // Update conversation status to active
      await supabase
        .from('chat_conversations')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      // Simple bot response (you can enhance this with AI)
      setTimeout(async () => {
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          message: "Thanks for your message! Our team will get back to you shortly. In the meantime, feel free to explore our documentation or FAQ.",
          sender_type: 'bot',
        });
      }, 1000);
    } catch (error) {
      console.error('Failed to send message:', error);
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              size="lg"
              className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-shadow"
              onClick={() => setIsOpen(true)}
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Card className={`w-96 shadow-2xl border-primary/20 ${isMinimized ? 'h-auto' : 'h-[500px]'} flex flex-col`}>
              {/* Header */}
              <CardHeader className="p-4 bg-primary text-primary-foreground rounded-t-lg flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Support Chat
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => setIsMinimized(!isMinimized)}
                    >
                      {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                      onClick={() => setIsOpen(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {!isMinimized && (
                <>
                  {/* Messages */}
                  <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full p-4">
                      {loading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Start a conversation</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.sender_type === 'visitor' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                                  msg.sender_type === 'visitor'
                                    ? 'bg-primary text-primary-foreground rounded-br-md'
                                    : msg.sender_type === 'bot'
                                    ? 'bg-muted rounded-bl-md'
                                    : 'bg-green-100 text-green-900 rounded-bl-md'
                                }`}
                              >
                                <p className="text-sm">{msg.message}</p>
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>

                  {/* Input */}
                  <div className="p-4 border-t flex-shrink-0">
                    <div className="flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        disabled={sending || loading}
                        className="flex-1"
                      />
                      <Button
                        size="icon"
                        onClick={handleSendMessage}
                        disabled={sending || loading || !newMessage.trim()}
                      >
                        {sending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
