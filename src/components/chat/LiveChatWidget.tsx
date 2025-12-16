import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, X, Send, Loader2, Minimize2, Maximize2, Bot, User, Headphones } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatMessage {
  id: string;
  message: string;
  sender_type: string;
  created_at: string | null;
}

export function LiveChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [visitorInfo, setVisitorInfo] = useState({ name: '', email: '' });
  const [showForm, setShowForm] = useState(true);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [waitingForAgent, setWaitingForAgent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generate/get visitor ID from localStorage
  const getVisitorId = () => {
    let visitorId = localStorage.getItem('chat_visitor_id');
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chat_visitor_id', visitorId);
    }
    return visitorId;
  };

  useEffect(() => {
    // Check for existing conversation in localStorage and validate it still exists
    const savedConvId = localStorage.getItem('chat_conversation_id');
    const savedName = localStorage.getItem('chat_visitor_name');
    const savedEmail = localStorage.getItem('chat_visitor_email');
    
    const validateConversation = async () => {
      if (savedConvId) {
        const { data, error } = await supabase
          .from('chat_conversations')
          .select('id, status')
          .eq('id', savedConvId)
          .maybeSingle();
        
        if (error || !data || data.status === 'resolved') {
          // Clear invalid/resolved conversation
          localStorage.removeItem('chat_conversation_id');
          localStorage.removeItem('chat_visitor_name');
          localStorage.removeItem('chat_visitor_email');
          return;
        }
      }
      
      if (savedConvId && savedName) {
        setConversationId(savedConvId);
        setVisitorInfo({ name: savedName, email: savedEmail || '' });
        setShowForm(false);
      }
    };
    
    validateConversation();
  }, []);

  useEffect(() => {
    if (isOpen && conversationId && !showForm) {
      fetchMessages(conversationId);
    }
  }, [isOpen, conversationId, showForm]);

  useEffect(() => {
    if (conversationId) {
      // Subscribe to new messages in real-time
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
            const newMsg = payload.new as ChatMessage;
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            
            // If agent responds, we're now in agent mode
            if (newMsg.sender_type === 'agent') {
              setIsAgentMode(true);
              setWaitingForAgent(false);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_conversations',
            filter: `id=eq.${conversationId}`,
          },
          (payload) => {
            const updated = payload.new as any;
            if (updated.assigned_to) {
              setIsAgentMode(true);
              setWaitingForAgent(false);
            }
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

  const startConversation = async () => {
    if (!visitorInfo.name.trim()) return;
    
    setLoading(true);
    try {
      const visitorId = getVisitorId();
      
      // Create new conversation
      const { data: newConversation, error: createError } = await supabase
        .from('chat_conversations')
        .insert({
          visitor_name: visitorInfo.name,
          visitor_email: visitorInfo.email || null,
          visitor_id: visitorId,
          status: 'active',
          is_bot_handled: true,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;

      setConversationId(newConversation.id);
      localStorage.setItem('chat_conversation_id', newConversation.id);
      localStorage.setItem('chat_visitor_name', visitorInfo.name);
      if (visitorInfo.email) localStorage.setItem('chat_visitor_email', visitorInfo.email);
      
      setShowForm(false);

      // Send welcome message from bot and add it immediately
      const welcomeMessage = `Hello ${visitorInfo.name}! 👋 I'm the Recruitify AI assistant. How can I help you today?\n\nI can answer questions about:\n• Our pricing plans\n• Features & capabilities\n• Getting started\n\nOr type "agent" to connect with a live support agent.`;
      
      const { data: welcomeMsg } = await supabase.from('chat_messages').insert({
        conversation_id: newConversation.id,
        message: welcomeMessage,
        sender_type: 'bot',
      }).select().single();
      
      // Add message immediately
      if (welcomeMsg) {
        setMessages([welcomeMsg]);
      }
      
    } catch (error) {
      console.error('Failed to start conversation:', error);
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
      
      // Check if already in agent mode
      const { data: convData } = await supabase
        .from('chat_conversations')
        .select('assigned_to, is_bot_handled')
        .eq('id', convId)
        .single();
        
      if (convData?.assigned_to || !convData?.is_bot_handled) {
        setIsAgentMode(true);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const requestLiveAgent = async () => {
    if (!conversationId) return;
    
    setWaitingForAgent(true);
    
    try {
      // Update conversation to escalated status
      await supabase
        .from('chat_conversations')
        .update({ 
          status: 'escalated',
          is_bot_handled: false,
          updated_at: new Date().toISOString() 
        })
        .eq('id', conversationId);

      // Send system message and add immediately
      const { data: systemMsg } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        message: "You've requested to speak with a live agent. Please wait, someone will be with you shortly.",
        sender_type: 'bot',
      }).select().single();
      
      if (systemMsg) {
        setMessages(prev => {
          if (prev.find(m => m.id === systemMsg.id)) return prev;
          return [...prev, systemMsg];
        });
      }

      // Trigger notification edge function
      await supabase.functions.invoke('notify-chat-escalation', {
        body: { 
          conversationId,
          visitorName: visitorInfo.name,
          visitorEmail: visitorInfo.email
        }
      }).catch(err => console.log('Notification function not available:', err));
      
    } catch (error) {
      console.error('Failed to request agent:', error);
      setWaitingForAgent(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    setSending(true);
    const messageText = newMessage.trim();
    setNewMessage('');

    // Create optimistic message for immediate display
    const optimisticMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      message: messageText,
      sender_type: 'visitor',
      created_at: new Date().toISOString(),
    };
    
    // Add message immediately (optimistic update)
    setMessages(prev => [...prev, optimisticMsg]);

    try {
      // Check if user wants live agent
      const wantsAgent = /\b(agent|human|support|help me|speak to someone|real person|live chat)\b/i.test(messageText);
      
      if (wantsAgent && !isAgentMode) {
        // Send user message first
        const { data: sentMsg } = await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          message: messageText,
          sender_type: 'visitor',
        }).select().single();
        
        // Replace optimistic message with real one
        if (sentMsg) {
          setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? sentMsg : m));
        }
        
        await requestLiveAgent();
        setSending(false);
        return;
      }

      // Send user message
      const { data: sentMsg, error: sendError } = await supabase.from('chat_messages').insert({
        conversation_id: conversationId,
        message: messageText,
        sender_type: 'visitor',
      }).select().single();

      if (sendError) throw sendError;
      
      // Replace optimistic message with real one
      if (sentMsg) {
        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? sentMsg : m));
      }

      // Update conversation
      await supabase
        .from('chat_conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conversationId);

      // If in bot mode, get AI response
      if (!isAgentMode && !waitingForAgent) {
        // Build conversation history for context
        const history = messages.slice(-10).map(m => ({
          role: m.sender_type === 'visitor' ? 'user' : 'assistant',
          content: m.message
        }));
        
        try {
          const { data: botResponse, error: botError } = await supabase.functions.invoke('chatbot', {
            body: { 
              message: messageText,
              conversationHistory: history,
            }
          });

          if (!botError && botResponse) {
            // Add bot response with optimistic update
            const { data: botMsg } = await supabase.from('chat_messages').insert({
              conversation_id: conversationId,
              message: botResponse.response || "I'm here to help! Could you please rephrase your question?",
              sender_type: 'bot',
            }).select().single();
            
            if (botMsg) {
              setMessages(prev => {
                if (prev.find(m => m.id === botMsg.id)) return prev;
                return [...prev, botMsg];
              });
            }

            // If AI suggests escalation
            if (botResponse.shouldEscalate) {
              setTimeout(async () => {
                const { data: escalateMsg } = await supabase.from('chat_messages').insert({
                  conversation_id: conversationId,
                  message: "Would you like me to connect you with a live support agent? Just type 'agent' and I'll get someone for you.",
                  sender_type: 'bot',
                }).select().single();
                
                if (escalateMsg) {
                  setMessages(prev => {
                    if (prev.find(m => m.id === escalateMsg.id)) return prev;
                    return [...prev, escalateMsg];
                  });
                }
              }, 1000);
            }
          }
        } catch (aiError) {
          console.error('AI response error:', aiError);
          // Fallback response
          const { data: fallbackMsg } = await supabase.from('chat_messages').insert({
            conversation_id: conversationId,
            message: "Thanks for your message! I'm processing your request. Would you like to speak with a live agent? Just type 'agent'.",
            sender_type: 'bot',
          }).select().single();
          
          if (fallbackMsg) {
            setMessages(prev => {
              if (prev.find(m => m.id === fallbackMsg.id)) return prev;
              return [...prev, fallbackMsg];
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const endChat = () => {
    localStorage.removeItem('chat_conversation_id');
    localStorage.removeItem('chat_visitor_name');
    localStorage.removeItem('chat_visitor_email');
    setConversationId(null);
    setMessages([]);
    setShowForm(true);
    setIsAgentMode(false);
    setWaitingForAgent(false);
    setIsOpen(false);
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
              className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-shadow bg-primary"
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
            <Card className={`w-96 shadow-2xl border-primary/20 ${isMinimized ? 'h-auto' : 'h-[520px]'} flex flex-col`}>
              {/* Header */}
              <CardHeader className="p-4 bg-primary text-primary-foreground rounded-t-lg flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {isAgentMode ? (
                      <>
                        <Headphones className="h-5 w-5" />
                        Live Support
                      </>
                    ) : (
                      <>
                        <Bot className="h-5 w-5" />
                        Recruitify Assistant
                      </>
                    )}
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
                {waitingForAgent && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-primary-foreground/80">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting you to an agent...
                  </div>
                )}
              </CardHeader>

              {!isMinimized && (
                <>
                  {showForm ? (
                    /* Visitor Info Form */
                    <CardContent className="flex-1 p-4 flex flex-col justify-center">
                      <div className="space-y-4">
                        <div className="text-center mb-6">
                          <Bot className="h-12 w-12 mx-auto mb-3 text-primary" />
                          <h3 className="font-semibold text-lg">Welcome to Recruitify!</h3>
                          <p className="text-sm text-muted-foreground">Please enter your details to start chatting</p>
                        </div>
                        <div>
                          <Input
                            placeholder="Your name *"
                            value={visitorInfo.name}
                            onChange={(e) => setVisitorInfo({ ...visitorInfo, name: e.target.value })}
                            className="mb-3"
                          />
                          <Input
                            placeholder="Email (optional)"
                            type="email"
                            value={visitorInfo.email}
                            onChange={(e) => setVisitorInfo({ ...visitorInfo, email: e.target.value })}
                          />
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={startConversation}
                          disabled={!visitorInfo.name.trim() || loading}
                        >
                          {loading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <MessageCircle className="h-4 w-4 mr-2" />
                          )}
                          Start Chat
                        </Button>
                      </div>
                    </CardContent>
                  ) : (
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
                                  <div className="flex items-end gap-2 max-w-[85%]">
                                    {msg.sender_type !== 'visitor' && (
                                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                                        msg.sender_type === 'agent' ? 'bg-green-100' : 'bg-primary/10'
                                      }`}>
                                        {msg.sender_type === 'agent' ? (
                                          <User className="h-3 w-3 text-green-600" />
                                        ) : (
                                          <Bot className="h-3 w-3 text-primary" />
                                        )}
                                      </div>
                                    )}
                                    <div
                                      className={`rounded-2xl px-4 py-2 ${
                                        msg.sender_type === 'visitor'
                                          ? 'bg-primary text-primary-foreground rounded-br-md'
                                          : msg.sender_type === 'agent'
                                          ? 'bg-green-100 text-green-900 rounded-bl-md'
                                          : 'bg-muted rounded-bl-md'
                                      }`}
                                    >
                                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <div ref={messagesEndRef} />
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>

                      {/* Quick Actions & Input */}
                      <div className="border-t flex-shrink-0">
                        {!isAgentMode && !waitingForAgent && (
                          <div className="px-4 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs"
                              onClick={requestLiveAgent}
                            >
                              <Headphones className="h-3 w-3 mr-1" />
                              Talk to Live Agent
                            </Button>
                          </div>
                        )}
                        <div className="p-4 flex gap-2">
                          <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={waitingForAgent ? "Waiting for agent..." : "Type your message..."}
                            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
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
                        <div className="px-4 pb-3">
                          <button 
                            onClick={endChat}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            End conversation
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
