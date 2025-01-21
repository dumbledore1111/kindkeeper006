'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Camera, Send, Mic, Check, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { AppSettings } from './settings-popup'
import { useWhisper } from '@/hooks/useWhisper'
import { useSpeechOutput } from '@/hooks/useSpeechOutput'
import type { 
  WhisperError
} from '@/types/api'
import type { ContextLog } from '@/types/database'
import { useAuth } from '@/hooks/useAuth'

interface Message {
  type: 'text' | 'image' | 'reminder'
  content: string
  isUser: boolean
  status: 'sending' | 'sent' | 'error'
  needsConfirmation: boolean
}

interface ChatPanelProps {
  open: boolean
  onClose: () => void
  settings?: AppSettings
}

interface ApiError {
  type: string;
  message: string;
  details?: unknown;
}

const defaultSettings: AppSettings = {
  textSize: 'medium',
  volume: 50,
  currency: 'INR',
  language: 'en',
  voiceType: 'default',
  theme: 'dark'
}

// Components for animations
function ThinkingIndicator() {
  return (
    <div className="flex gap-1 items-center p-2">
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-thinking" />
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-thinking [animation-delay:0.2s]" />
      <div className="w-2 h-2 bg-blue-500 rounded-full animate-thinking [animation-delay:0.4s]" />
    </div>
  )
}

function RecordingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Mic className="w-5 h-5 text-red-500" />
        <div className="absolute inset-0 rounded-full border-2 border-red-500 animate-mic-pulse" />
      </div>
      <span className="text-sm text-red-500">Recording...</span>
    </div>
  )
}

function MessageStatus({ status }: { status: 'sending' | 'sent' | 'error' }) {
  const icons = {
    sending: <div className="w-2 h-2 bg-gray-400 rounded-full animate-thinking" />,
    sent: <Check className="w-4 h-4 text-green-500" />,
    error: <AlertTriangle className="w-4 h-4 text-red-500" />
  }
  return (
    <span className="ml-2 inline-flex items-center animate-fade-in">
      {icons[status]}
    </span>
  )
}

export function ChatPanel({ 
  open, 
  onClose, 
  settings = defaultSettings 
}: ChatPanelProps) {
  const { session, refreshSession } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const [failedOperation, setFailedOperation] = useState<ApiError | null>(null)
  const [loadingStates, setLoadingStates] = useState({
    processing: false,
    speaking: false,
    recording: false,
    retrying: false
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const [inputMessage, setInputMessage] = useState('')
  const [showPhotoOptions, setShowPhotoOptions] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const { speak } = useSpeechOutput()
  const [contextHistory, setContextHistory] = useState<ContextLog[]>([])

  const handleResponse = useCallback(async (text: string) => {
    setMessages(prev => [...prev, {
      type: 'text',
      content: text,
      isUser: false,
      status: 'sent',
      needsConfirmation: false
    }]);

    // If this is a reminder response, add the confirmation message
    if (text.toLowerCase().includes('remind you')) {
      setMessages(prev => [...prev, {
        type: 'reminder',
        content: '✓ Reminder set',
        isUser: false,
        status: 'sent',
        needsConfirmation: false
      }]);
    }

    if (settings.voiceType !== 'none') {
      await speak(text);
    }
  }, [settings.voiceType, speak]);

  const handle401Error = useCallback(async () => {
    console.log('Attempting to refresh session...');
    await refreshSession();
    if (!session?.access_token) {
      handleResponse("Your session has expired. Please log in again.");
      onClose();
    }
  }, [refreshSession, session?.access_token, handleResponse, onClose]);

  const { 
    isRecording, 
    error: recordingError, 
    startRecording, 
    stopRecording 
  } = useWhisper({
    onTranscript: (text: string) => {
      if (text.trim()) {
        setInputMessage(text);
        handleSend(text);
      }
    },
    authToken: session?.access_token || '',
    onError: async (error: WhisperError) => {
      console.error('Whisper error:', error);
      if (error.type === 'network' && error.message.includes('401')) {
        await refreshSession();
        if (!session?.access_token) {
          handleResponse("Your session has expired. Please log in again.");
          onClose();
        }
      }
    },
  });

  // Auto-scroll when new messages appear
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle recording errors
  useEffect(() => {
    if (recordingError) {
      console.error('Recording error:', recordingError);
      
      switch(recordingError.type) {
        case 'network':
          if (recordingError.message.includes('401')) {
            handle401Error();
          } else {
            handleResponse("Network error. Please check your connection and try again.");
          }
          break;
        case 'microphone':
          handleResponse("Microphone access is needed. Please check your browser settings.");
          break;
        default:
          handleResponse("There was an error with the recording. Please try again.");
      }

      if (isRecording) {
        stopRecording();
      }
    }
  }, [recordingError, isRecording, stopRecording, handle401Error, handleResponse]);

  const handlePhotoCapture = useCallback((photoUrl: string) => {
    setMessages(prev => [...prev, { 
      type: 'image', 
      content: photoUrl, 
      isUser: true, 
      status: 'sent', 
      needsConfirmation: false 
    }]);
    setShowPhotoOptions(false);
  }, []);

  const handleVoiceInput = useCallback(async () => {
    if (isRecording) {
      stopRecording();
      setLoadingStates(prev => ({ ...prev, recording: false }));
    } else {
      setLoadingStates(prev => ({ ...prev, recording: true }));
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleSend = useCallback(async (input: string) => {
    if (!session?.access_token) {
      console.error('No session found');
      handleResponse("Please log in to continue.");
      return;
    }

    if (input.trim() && !isProcessing) {
      setIsProcessing(true);
      try {
        setMessages(prev => [...prev, { 
          type: 'text', 
          content: input,
          isUser: true,
          status: 'sending',
          needsConfirmation: false
        }]);

        const response = await fetch('/api/context', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
            body: JSON.stringify({ 
              userId: session.user.id,
              message: input,
              context: contextHistory[contextHistory.length - 1]
            })
          });
        
        if (response.status === 401) {
          await handle401Error();
          return;
        }
          
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          
          const data = await response.json();

          if (!data.success) {
            throw new Error(data.error || 'Failed to process message');
          }

        setMessages(prev => 
          prev.map(m => 
            m.content === input && m.isUser 
              ? { ...m, status: 'sent' } 
              : m
          )
        );

        if (data.response) {
            handleResponse(data.response);
        }

            if (data.context) {
              setContextHistory(prev => [...prev, data.context]);
        }

      } catch (error) {
        console.error('Error processing message:', error);
        setMessages(prev => 
          prev.map(m => 
            m.content === input && m.isUser 
              ? { ...m, status: 'error' } 
              : m
          )
        );
        handleResponse("I'm having trouble processing your message. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    }
  }, [session, isProcessing, handleResponse, contextHistory, handle401Error]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputMessage);
    }
  }, [handleSend, inputMessage]);

  // Add welcome message only once when panel opens
  useEffect(() => {
    if (open) {
      setMessages([{ 
        type: 'text', 
        content: "Hello, how can I help you?", 
        isUser: false, 
        status: 'sent', 
        needsConfirmation: false 
      }]);
    }
  }, [open]);

  // Helper functions for response classification
  function determineResponseType(text: string): 'simple' | 'complex' | 'query' | 'error' {
    if (!text) return 'simple';
    
    return text.includes('sorry') || text.includes('error') 
      ? 'error'
      : text.length > 100 
        ? 'complex' 
        : 'simple';
  }

  function determineEmotion(text: string): 'neutral' | 'concerned' | 'friendly' {
    if (text.includes('sorry') || text.includes('error')) return 'concerned'
    if (text.includes('great') || text.includes('sure')) return 'friendly'
    return 'neutral'
  }

  function needsElevenLabs(text: string): boolean {
    return (
      text.includes('₹') ||          // Contains currency
      text.includes('reminder') ||    // Is a reminder
      text.includes('?') ||          // Is a question
      text.length > 100              // Is a long response
    )
  }

  // Loading indicator component
  function LoadingIndicator({ type }: { type: keyof typeof loadingStates }) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        <span className="text-sm text-gray-400">
          {type === 'processing' && 'Processing...'}
          {type === 'speaking' && 'Speaking...'}
          {type === 'recording' && 'Listening...'}
          {type === 'retrying' && 'Retrying...'}
        </span>
      </div>
    )
  }

  // Add retry logic
  const handleRetry = async () => {
    if (retryCount >= 3 || !failedOperation) return;
    
    try {
      setLoadingStates(prev => ({ ...prev, retrying: true }));
      setRetryCount(prev => prev + 1);

      const response = await fetch('/api/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          operation: failedOperation,
          attempt: retryCount + 1
        })
      });

      const data = await response.json();
      if (data.success) {
        handleResponse("Successfully completed the operation!");
        setFailedOperation(null);
        setRetryCount(0);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      handleResponse(
        `Retry failed (Attempt ${retryCount + 1}/3). Would you like to try again?`
      );
    } finally {
      setLoadingStates(prev => ({ ...prev, retrying: false }));
    }
  };

  // Used for ongoing conversations and complex queries
  const handleMessage = async (input: string) => {
    setIsProcessing(true);
    try {
      // Add user message with needsConfirmation
      setMessages(prev => [...prev, {
        type: 'text',
        content: input,
        isUser: true,
        status: 'sending',
        needsConfirmation: false
      }]);

      const response = await fetch('/api/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          message: input,
          context: contextHistory[contextHistory.length - 1]
        })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      // Update context
      setContextHistory(prev => [...prev, data.context]);

      // Add AI response with needsConfirmation
      setMessages(prev => [...prev, {
        type: 'text',
        content: data.response,
        isUser: false,
        status: 'sent',
        needsConfirmation: false
      }]);

      // Handle voice if needed
      if (settings?.voiceType !== 'none') {
        await handleResponse(data.response);
      }

    } catch (error) {
      console.error('Message processing error:', error);
      setMessages(prev => [...prev, {
        type: 'text',
        content: 'Sorry, I had trouble processing that. Could you try again?',
        isUser: false,
        status: 'error',
        needsConfirmation: false
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-[400px] h-[700px] bg-[#FFFBEB] rounded-3xl p-0 animate-slide-in"
        aria-describedby="chat-panel-description"
      >
        <div id="chat-panel-description" className="sr-only">
          Chat panel for interacting with your financial assistant
        </div>
        <DialogTitle className="sr-only">Chat Assistant</DialogTitle>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[400px] h-[700px] rounded-3xl bg-[#FFFBEB] shadow-xl p-6 relative">
            {/* Header - Bigger icons */}
            <div className="flex justify-between items-center mb-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose}
                className="rounded-full hover:bg-[#FFEDD5] p-2"
              >
                <ArrowLeft className="h-12 w-12 text-[#EA580C]" />
              </Button>
              <Button 
                variant="ghost"
                size="icon"
                onClick={() => setShowPhotoOptions(true)}
                className="rounded-full hover:bg-[#FFEDD5] p-2"
              >
                <Camera className="h-12 w-12 text-[#EA580C]" />
              </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto mb-4 h-[calc(100%-180px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:none]">
              {messages.map((message, index) => (
              <div
                key={index}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} animate-slide-in mb-2`}
              >
                <div 
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      message.type === 'reminder' 
                        ? 'bg-green-500 text-white shadow-md'
                        : message.isUser 
                          ? 'bg-[#ffb380] text-gray-900 shadow-md'
                          : 'bg-[#f3f4f6] text-gray-900 shadow-sm'
                    }`}
                  >
                    {message.type === 'reminder' ? (
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4" />
                        {message.content}
                      </div>
                    ) : (
                      index === 0 ? "tell me i am listening" : message.content
                    )}
                    <MessageStatus status={message.status} />
                </div>
              </div>
            ))}
              {loadingStates.processing && <ThinkingIndicator />}
              {isRecording && <RecordingIndicator />}
          </div>

          {/* Input Area */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-4">
              <Button
                onClick={handleVoiceInput}
                className={`h-24 w-24 mx-auto rounded-full ${
                  isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-[#ff6b00] hover:bg-[#ff8533]'
                } text-white shadow-lg transition-all duration-300`}
              >
                {isRecording ? (
                  <div className="w-3 h-3 rounded-full bg-white animate-pulse" />
                ) : (
                  <Mic className="w-10 h-10" />
                )}
              </Button>

              <div className="flex items-center gap-2 bg-[#8B4513] rounded-full p-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type here....."
                  className="flex-1 bg-transparent border-none text-white placeholder-gray-400 focus:ring-0"
                />
                <Button
                  onClick={() => handleSend(inputMessage)}
                  className="bg-[#ff6b00] hover:bg-[#ff8533] text-white rounded-full p-3 h-auto w-auto"
                  disabled={isProcessing}
                >
                  <Send className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

