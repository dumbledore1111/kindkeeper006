'use client'

import { useState, useRef, useEffect } from 'react'
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Camera, Send, Mic } from 'lucide-react'
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
import type { Context } from '@/types/database'

interface Message {
  type: 'text' | 'image'
  content: string
  isUser: boolean
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

export function ChatPanel({ 
  open, 
  onClose, 
  settings = defaultSettings 
}: ChatPanelProps) {
  const [useElevenLabs, setUseElevenLabs] = useState(false)
  const { userId } = useAuth()
  const [messages, setMessages] = useState<Message[]>([
    { type: 'text', content: "hello,how can i help you?", isUser: false }
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [inputMessage, setInputMessage] = useState('')
  const [showPhotoOptions, setShowPhotoOptions] = useState(false)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const { 
    isRecording, 
    transcript, 
    error: recordingError, 
    startRecording, 
    stopRecording 
  } = useWhisper()
  const { speak, stop, isSpeaking } = useSpeechOutput()
  const [contextHistory, setContextHistory] = useState<Context[]>([])

  // Handle transcript updates
  useEffect(() => {
    if (transcript) {
      setInputMessage(transcript)
      handleSend(transcript)
    }
  }, [transcript])

  const handleSend = async (messageToSend: string) => {
    if (messageToSend.trim() && !isProcessing) {
      setIsProcessing(true);
      try {
        if (!userId) {
          setMessages(prev => [...prev, { 
            type: 'text', 
            content: "Please log in first", 
            isUser: false 
          }])
          return
        }

        setMessages(prev => [...prev, { 
          type: 'text', 
          content: messageToSend, 
          isUser: true 
        }])
        
        const data = await processMessage(messageToSend, userId)
        
        setUseElevenLabs(data.needsMoreInfo || !isSimpleTransaction(messageToSend))
        
        if (data.success) {
          handleResponse(data.response)
        } else {
          handleResponse("I'm sorry, I couldn't process that. Could you try again?")
        }
      } catch (error) {
        console.error('Failed to process message:', error)
        handleResponse("I'm having trouble understanding. Could you rephrase that?")
      } finally {
        setIsProcessing(false)
      }
      setInputMessage('')
    }
  }

  const handlePhotoCapture = (photoUrl: string) => {
    setMessages(prev => [...prev, { type: 'image', content: photoUrl, isUser: true }])
    setShowPhotoOptions(false)
  }

  const handleVoiceInput = async () => {
    if (isRecording) {
      stopRecording()
    } else {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
        startRecording()
        // Clear any previous errors
        setMessages(prev => prev.filter(m => 
          !(m.isUser === false && m.content.includes("error"))
        ))
      } catch (err) {
        handleResponse("I need permission to use the microphone. Please try again.")
      }
    }
  }

  const handleResponse = async (response: string) => {
    try {
      setMessages(prev => [...prev, { 
        type: 'text', 
        content: response, 
        isUser: false 
      }])
      
      // Determine response type
      const responseType = determineResponseType(response)
      
      // Use new speak function with options
      await speak(response, {
        responseType,
        emotion: determineEmotion(response),
        useElevenLabs: needsElevenLabs(response)
      })
    } catch (error) {
      console.error('Voice feedback error:', error)
    }
  }

  // Helper functions for response classification
  function determineResponseType(text: string): 'simple' | 'complex' | 'query' | 'error' {
    if (text.includes('sorry') || text.includes('error')) return 'error'
    if (text.includes('?')) return 'query'
    if (text.includes('₹') || text.includes('reminder') || text.length > 100) return 'complex'
    return 'simple'
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

  // Used for ongoing conversations and complex queries
  const handleMessage = async (input: string) => {
    if (!userId) {
      setMessages(prev => [...prev, {
        type: 'text',
        content: "Please log in first",
        isUser: false
      }])
      return
    }

    try {
      const response = await fetch('/api/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          input,
          context: contextHistory[contextHistory.length - 1]
        })
      })

      const data: AssistantResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to process message');
      }

      // Update context history
      if (data.data?.context) {
        setContextHistory(prev => [...prev, data.data.context]);
      }

      // Handle response based on type
      if (data.needsMoreInfo) {
        // Use ElevenLabs for clarification questions
        setUseElevenLabs(true);
        handleResponse(data.clarification?.context || "Could you provide more details?");
      } else {
        // Use appropriate voice based on response complexity
        setUseElevenLabs(!isSimpleTransaction(input));
        handleResponse(data.response);
      }
    } catch (error) {
      console.error('Error:', error);
      handleResponse("I'm sorry, I'm having trouble understanding. Could you try again?");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="left" 
        className="w-full sm:w-[400px] p-0 bg-white border-0 flex flex-col h-full"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4">
          <Button 
            onClick={onClose}
            className="text-white bg-[#F47521] px-6 py-2 rounded-full flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            back
          </Button>

          <Button 
            onClick={() => setShowPhotoOptions(true)}
            className="text-white bg-[#F47521] px-6 py-2 rounded-full flex items-center gap-2 text-sm"
          >
            <Camera className="h-4 w-4" />
            photo
          </Button>
        </div>

        {/* Speak Button */}
        <div className="flex justify-center my-8">
          <button
            onClick={handleVoiceInput}
            className={`w-32 h-32 rounded-full flex flex-col items-center justify-center 
              text-white font-bold transition-all duration-300 transform hover:scale-105
              ${isRecording 
                ? 'bg-green-500 animate-pulse' 
                : 'bg-gradient-to-b from-[#FFD600] via-[#FF6D00] to-[#FF1744]'
              }`}
          >
            <Mic className="h-8 w-8 mb-1" />
            <span className="text-xl">
              {isRecording ? 'RECORDING...' : 'SPEAK'}
            </span>
          </button>
        </div>

        {/* Flex spacer */}
        <div className="flex-1" />

        {/* Chat Group - Messages and Input */}
        <div className="w-full h-[60%] bg-gray-50 rounded-t-3xl">
          {/* Messages */}
          <div 
            ref={chatContainerRef}
            className="h-[calc(100%-80px)] overflow-y-auto p-4"
          >
            <div className="mb-4">
              <div className="inline-block rounded-[20px] px-6 py-3 bg-[#43B7B1] text-white">
                hello,how can i help you?
              </div>
            </div>
            {messages.slice(1).map((message, index) => (
              <div
                key={index}
                className={`mb-4 ${message.isUser ? 'text-right' : 'text-left'}`}
              >
                <div 
                  className={`inline-block rounded-[20px] px-6 py-3 text-white
                    ${message.isUser ? 'bg-[#F47521]' : 'bg-[#43B7B1]'}`}
                >
                  {message.type === 'text' ? (
                    message.content
                  ) : (
                    <img 
                      src={message.content} 
                      alt="Shared" 
                      className="rounded-lg max-w-full h-auto"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend(inputMessage)}
                placeholder="do you want to type your message instead?"
                className="flex-1 bg-gray-100 border-none text-gray-900 placeholder:text-gray-500 rounded-lg"
              />
              <Button
                onClick={() => handleSend(inputMessage)}
                className="bg-[#F47521] hover:bg-[#E56410] text-white px-6 py-2 rounded-lg"
              >
                send
              </Button>
            </div>
          </div>
        </div>

        {/* Photo Options Modal */}
        <Dialog open={showPhotoOptions} onOpenChange={setShowPhotoOptions}>
          <DialogContent className="bg-white border-gray-200 rounded-3xl p-6 w-[90%] max-w-[400px]">
            <DialogTitle className="sr-only">Photo Options</DialogTitle>
            <div className="space-y-4">
              <Button
                onClick={() => {
                  // Implement camera open logic
                }}
                className="w-full h-14 bg-[#F47521] hover:bg-[#E56410] text-white text-lg font-medium rounded-2xl"
              >
                Open Camera
              </Button>
              <label className="block">
                <Button
                  className="w-full h-14 bg-[#F47521] hover:bg-[#E56410] text-white text-lg font-medium rounded-2xl"
                >
                  Upload Image
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onloadend = () => {
                        handlePhotoCapture(reader.result as string)
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                />
              </label>
              <Button
                onClick={() => setShowPhotoOptions(false)}
                className="w-full h-14 border-2 border-[#F47521] text-[#F47521] hover:bg-[#F47521] hover:text-white 
                         text-lg font-medium rounded-2xl transition-colors"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Error Display */}
        {recordingError && recordingError.length > 0 && (
          <div className="text-red-500 text-sm text-center mt-2">
            {recordingError}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

