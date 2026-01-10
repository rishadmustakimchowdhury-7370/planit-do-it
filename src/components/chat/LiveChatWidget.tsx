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
        const visitorId = getVisitorId();
        
        // Use secure RPC to validate conversation
        const { data, error } = await supabase.rpc('get_visitor_conversation', {
          p_visitor_id: visitorId,
        });
        
        const conv = data && data.length > 0 ? data[0] : null;
        
        if (error || !conv || conv.status === 'resolved') {
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
      
      // Create new conversation using secure RPC function
      const { data: conversationIdResult, error: createError } = await supabase
        .rpc('create_chat_conversation', {
          p_visitor_id: visitorId,
          p_visitor_name: visitorInfo.name,
          p_visitor_email: visitorInfo.email || null,
        });

      if (createError) throw createError;

      const newConvId = conversationIdResult as string;
      setConversationId(newConvId);
      localStorage.setItem('chat_conversation_id', newConvId);
      localStorage.setItem('chat_visitor_name', visitorInfo.name);
      if (visitorInfo.email) localStorage.setItem('chat_visitor_email', visitorInfo.email);
      
      setShowForm(false);

      // Send welcome message from bot using secure RPC function
      const welcomeMessage = `Hello ${visitorInfo.name}! 👋 I'm the HireMetrics AI assistant. How can I help you today?\n\nI can answer questions about:\n• Our pricing plans\n• Features & capabilities\n• Getting started\n\nOr type "agent" to connect with a live support agent.`;
      
      const { data: welcomeMsgId } = await supabase.rpc('add_chat_message', {
        p_conversation_id: newConvId,
        p_visitor_id: visitorId,
        p_message: welcomeMessage,
        p_sender_type: 'bot',
      });
      
      // Add message immediately (create local message object)
      if (welcomeMsgId) {
        setMessages([{
          id: welcomeMsgId as string,
          message: welcomeMessage,
          sender_type: 'bot',
          created_at: new Date().toISOString(),
        }]);
      }
      
    } catch (error) {
      console.error('Failed to start conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (convId: string) => {
    try {
      const visitorId = getVisitorId();
      
      // Fetch messages using secure RPC function
      const { data, error } = await supabase.rpc('get_chat_messages', {
        p_conversation_id: convId,
        p_visitor_id: visitorId,
      });

      if (error) throw error;
      
      // Map RPC result to ChatMessage format
      const mappedMessages: ChatMessage[] = (data || []).map((m: any) => ({
        id: m.id,
        message: m.message,
        sender_type: m.sender_type,
        created_at: m.created_at,
      }));
      
      setMessages(mappedMessages);
      
      // Check if already in agent mode using secure RPC
      const { data: convData } = await supabase.rpc('get_visitor_conversation', {
        p_visitor_id: visitorId,
      });
        
      if (convData && convData.length > 0) {
        const conv = convData[0];
        if (!conv.is_bot_handled) {
          setIsAgentMode(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  const requestLiveAgent = async () => {
    if (!conversationId) return;
    
    setWaitingForAgent(true);
    const visitorId = getVisitorId();
    
    try {
      // Use edge function to escalate (it has service role access)
      await supabase.functions.invoke('notify-chat-escalation', {
        body: { 
          conversationId,
          visitorId,
          visitorName: visitorInfo.name,
          visitorEmail: visitorInfo.email,
          escalate: true
        }
      });

      // Add system message locally
      const systemMessage = "You've requested to speak with a live agent. Please wait, someone will be with you shortly.";
      const { data: msgId } = await supabase.rpc('add_chat_message', {
        p_conversation_id: conversationId,
        p_visitor_id: visitorId,
        p_message: systemMessage,
        p_sender_type: 'bot',
      });
      
      if (msgId) {
        setMessages(prev => {
          const newMsg: ChatMessage = {
            id: msgId as string,
            message: systemMessage,
            sender_type: 'bot',
            created_at: new Date().toISOString(),
          };
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
      
    } catch (error) {
      console.error('Failed to request agent:', error);
      setWaitingForAgent(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    setSending(true);
    const messageText = newMessage.trim();
    const visitorId = getVisitorId();
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
        // Send user message first using secure RPC
        const { data: sentMsgId } = await supabase.rpc('add_chat_message', {
          p_conversation_id: conversationId,
          p_visitor_id: visitorId,
          p_message: messageText,
          p_sender_type: 'visitor',
        });
        
        // Replace optimistic message with real one
        if (sentMsgId) {
          setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? {
            ...optimisticMsg,
            id: sentMsgId as string,
          } : m));
        }
        
        await requestLiveAgent();
        setSending(false);
        return;
      }

      // Send user message using secure RPC
      const { data: sentMsgId, error: sendError } = await supabase.rpc('add_chat_message', {
        p_conversation_id: conversationId,
        p_visitor_id: visitorId,
        p_message: messageText,
        p_sender_type: 'visitor',
      });

      if (sendError) throw sendError;
      
      // Replace optimistic message with real one
      if (sentMsgId) {
        setMessages(prev => prev.map(m => m.id === optimisticMsg.id ? {
          ...optimisticMsg,
          id: sentMsgId as string,
        } : m));
      }

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
            const botMessage = botResponse.response || "I'm here to help! Could you please rephrase your question?";
            
            // Add bot response using secure RPC
            const { data: botMsgId } = await supabase.rpc('add_chat_message', {
              p_conversation_id: conversationId,
              p_visitor_id: visitorId,
              p_message: botMessage,
              p_sender_type: 'bot',
            });
            
            if (botMsgId) {
              const newBotMsg: ChatMessage = {
                id: botMsgId as string,
                message: botMessage,
                sender_type: 'bot',
                created_at: new Date().toISOString(),
              };
              setMessages(prev => {
                if (prev.find(m => m.id === newBotMsg.id)) return prev;
                return [...prev, newBotMsg];
              });
            }

            // If AI suggests escalation
            if (botResponse.shouldEscalate) {
              setTimeout(async () => {
                const escalateMessage = "Would you like me to connect you with a live support agent? Just type 'agent' and I'll get someone for you.";
                const { data: escalateMsgId } = await supabase.rpc('add_chat_message', {
                  p_conversation_id: conversationId,
                  p_visitor_id: visitorId,
                  p_message: escalateMessage,
                  p_sender_type: 'bot',
                });
                
                if (escalateMsgId) {
                  const escalateMsg: ChatMessage = {
                    id: escalateMsgId as string,
                    message: escalateMessage,
                    sender_type: 'bot',
                    created_at: new Date().toISOString(),
                  };
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
          const fallbackMessage = "Thanks for your message! I'm processing your request. Would you like to speak with a live agent? Just type 'agent'.";
          const { data: fallbackMsgId } = await supabase.rpc('add_chat_message', {
            p_conversation_id: conversationId,
            p_visitor_id: visitorId,
            p_message: fallbackMessage,
            p_sender_type: 'bot',
          });
          
          if (fallbackMsgId) {
            const fallbackMsg: ChatMessage = {
              id: fallbackMsgId as string,
              message: fallbackMessage,
              sender_type: 'bot',
              created_at: new Date().toISOString(),
            };
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
                        HireMetrics Assistant
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
                          <h3 className="font-semibold text-lg">Welcome to HireMetrics!</h3>
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
