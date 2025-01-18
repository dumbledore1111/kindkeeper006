'use client'

import { useState, useRef, useEffect } from 'react'
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Camera, Send, Mic, Check, AlertTriangle, Loader2, X } from 'lucide-react'
import { PhotoCapture } from './photo-capture'
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { AppSettings } from './settings-popup'
import { useWhisper } from '@/hooks/useWhisper'
import { useSpeechOutput } from '@/hooks/useSpeechOutput'
import { isSimpleTransaction } from '@/lib/transaction-processor'
import { processMessage } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { 
  WhisperResponse, 
  AssistantResponse,
  ElevenLabsResponse
} from '@/types/api'
import type { Context, ContextLog, DatabaseOperationStatus } from '@/types/database'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'

interface Message {
  type: 'text' | 'image'
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
  const [useElevenLabs, setUseElevenLabs] = useState(false)
  const [contextHistory, setContextHistory] = useState<ContextLog[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const [failedOperation, setFailedOperation] = useState<any>(null)
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
  const { speak, stop, isSpeaking } = useSpeechOutput()
  const [dbOperations, setDbOperations] = useState<DatabaseOperationStatus[]>([])

  // Debug session state
  useEffect(() => {
    console.log('Session state:', {
      exists: !!session,
      token: session?.access_token?.slice(0, 10) + '...',
      user: session?.user?.id
    });
  }, [session]);

  // Ensure we have a valid session before initializing Whisper
  const { 
    isRecording, 
    transcript, 
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
    authToken: session?.access_token || ''
  });

  // Handle 401 errors by refreshing session
  const handle401Error = async () => {
    console.log('Attempting to refresh session...');
    await refreshSession();
    if (!session?.access_token) {
      handleResponse("Your session has expired. Please log in again.");
      onClose();
    }
  };

  // Handle recording errors with better error handling
  useEffect(() => {
    if (recordingError) {
      console.error('Recording error:', recordingError);
      
      // Handle different error types
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

      // Stop recording if it's still going
      if (isRecording) {
        stopRecording();
      }
    }
  }, [recordingError, isRecording, stopRecording, session, onClose]);

  // Auto-scroll when new messages appear
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (input: string) => {
    if (!session?.access_token) {
      console.error('No session found');
      handleResponse("Please log in to continue.");
      return;
    }

    if (input.trim() && !isProcessing) {
      setIsProcessing(true);
      try {
        // Show user message first
        setMessages(prev => [...prev, { 
          type: 'text', 
          content: input,
          isUser: true,
          status: 'sending',
          needsConfirmation: false
        }]);

        // Send to context API with proper auth
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

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to process message');
        }

        // Update message status
        setMessages(prev => prev.map((msg, i) => 
          i === prev.length - 1 ? { ...msg, status: 'sent' } : msg
        ));

        // Update context
        if (data.context) {
          setContextHistory(prev => [...prev, data.context]);
        }

        // Handle response based on intent
        if (data.needsMoreInfo) {
          speak(data.clarification?.context || data.response);
        } else {
          handleResponse(data.response);
        }

      } catch (error) {
        console.error('Failed to process message:', error);
        
        // Update message status to error
        setMessages(prev => prev.map((msg, i) => 
          i === prev.length - 1 ? { ...msg, status: 'error' } : msg
        ));

        handleResponse("I'm having trouble processing your request. Please try again.");
      } finally {
        setIsProcessing(false);
        setInputMessage('');
      }
    }
  };

  const handlePhotoCapture = (photoUrl: string) => {
    setMessages(prev => [...prev, { type: 'image', content: photoUrl, isUser: true, status: 'sent', needsConfirmation: false }])
    setShowPhotoOptions(false)
  }

  const handleVoiceInput = async () => {
    // Debug session state before voice input
    console.log('Voice input session state:', {
      token: session?.access_token?.slice(0, 10),
      exists: !!session
    });

    if (!session?.access_token) {
      try {
        await refreshSession();
        if (!session?.access_token) {
          handleResponse("Please log in to use voice features.");
          return;
        }
      } catch (error) {
        handleResponse("Please log in to use voice features.");
        return;
      }
    }

    if (isRecording) {
      stopRecording();
    } else {
      try {
        // Clear any previous errors
        setMessages(prev => prev.filter(m => 
          !(m.isUser === false && typeof m.content === 'string' && m.content.includes("error"))
        ));
        
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            channelCount: 1
          }
        });
        
        // Start recording if we got microphone access
        startRecording();
        
        // Cleanup function
        return () => {
          stream.getTracks().forEach(track => track.stop());
        };
      } catch (err) {
        console.error('Microphone error:', err);
        handleResponse("I need permission to use the microphone. Please check your browser settings and try again.");
      }
    }
  };

  const handleResponse = async (text: string) => {
    try {
      const responseType = determineResponseType(text);
      
      if (settings?.voiceType !== 'none') {
        await speak(text, {
          useElevenLabs: true,
          responseType,
          emotion: responseType === 'error' ? 'concerned' : 'friendly'
        });
      }
    } catch (error) {
      console.error('Voice feedback error:', error);
    }
  };

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputMessage);
    }
  };

  // Add welcome message only once when panel opens
  useEffect(() => {
    if (open) {
      setMessages([{ 
        type: 'text', 
        content: "Hello, how can I help you?", 
        isUser: false, 
        status: 'sent', 
        needsConfirmation: false 
      }])
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent">
        <DialogTitle className="sr-only">Chat Assistant</DialogTitle>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[400px] h-[700px] rounded-3xl bg-white shadow-xl p-6 relative">
            {/* Header - Bigger icons */}
            <div className="flex justify-between items-center mb-4">
          <Button 
                variant="ghost" 
                size="icon" 
            onClick={onClose}
                className="rounded-full hover:bg-gray-100 p-2"
          >
                <ArrowLeft className="h-12 w-12 text-gray-700" />
          </Button>
          <Button 
                variant="ghost"
                size="icon"
            onClick={() => setShowPhotoOptions(true)}
                className="rounded-full hover:bg-gray-100 p-2"
          >
                <Camera className="h-12 w-12 text-gray-700" />
          </Button>
        </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto mb-4 h-[calc(100%-180px)]">
              {messages.map((message, index) => (
              <div
                key={index}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'} animate-slide-in mb-2`}
              >
                <div 
                    className={`rounded-lg px-4 py-2 max-w-[80%] ${
                      message.isUser 
                        ? 'bg-[#ffb380] text-gray-900 shadow-md'
                        : 'bg-[#f3f4f6] text-gray-900 shadow-sm'
                    }`}
                  >
                    {index === 0 ? "tell me i am listening" : message.content}
                    <MessageStatus status={message.status} />
                </div>
              </div>
            ))}
              {loadingStates.processing && <ThinkingIndicator />}
              {isRecording && <RecordingIndicator />}
          </div>

          {/* Input Area */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-4">
              {/* Main Record Button - Centered and Large */}
              <Button
                onClick={handleVoiceInput}
                className={`
                  w-24 h-24 rounded-full mx-auto
                  ${isRecording 
                    ? 'bg-red-500 hover:bg-red-600' 
                    : 'bg-[#ff6b00] hover:bg-[#ff8533]'
                  }
                  flex items-center justify-center
                  transition-all duration-300
                  shadow-lg hover:shadow-xl
                `}
              >
                <Mic className="h-8 w-8 text-white" />
              </Button>

              {/* Text Input and Send - More Visible */}
              <div className="flex gap-2 items-center">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 h-12 rounded-full 
                    bg-gray-50 border-2 border-gray-300 
                    text-lg px-6 
                    placeholder:text-gray-600 
                    text-gray-800
                    focus:border-[#ff6b00] focus:ring-2 focus:ring-[#ff6b00]/20
                    shadow-md hover:shadow-lg
                    transition-all duration-300"
                  onKeyDown={handleKeyDown}
                />
                <Button
                  onClick={() => handleSend(inputMessage)}
                  className="h-12 w-12 rounded-full bg-[#ff6b00] hover:bg-[#ff8533]
                    flex items-center justify-center shadow-md"
                >
                  <Send className="h-5 w-5 text-white" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

