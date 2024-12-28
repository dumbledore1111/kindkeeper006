import { useState, useCallback, useRef } from 'react'

interface UseSpeechProps {
  onResult?: (text: string) => void
}

export function useSpeech({ onResult }: UseSpeechProps = {}) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startListening = useCallback(async () => {
    try {
      setError(null)
      audioChunksRef.current = []

      // Get microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/wav'
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: 'audio/wav'
        })
        
        // Create form data
        const formData = new FormData()
        formData.append('audio', audioBlob)

        try {
          // Send to our API route
          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
          })

          const data = await response.json()
          
          if (data.success && data.text) {
            console.log('Transcribed:', data.text)
            if (onResult) {
              onResult(data.text)
            }
          } else {
            throw new Error(data.error || 'Transcription failed')
          }
        } catch (err) {
          console.error('Transcription error:', err)
          setError('Failed to transcribe audio')
        }

        // Cleanup
        stream.getTracks().forEach(track => track.stop())
        setIsListening(false)
      }

      // Start recording
      mediaRecorder.start()
      setIsListening(true)

      // Stop after 10 seconds max
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopListening()
        }
      }, 10000)

    } catch (err) {
      console.error('Recording error:', err)
      setError('Please allow microphone access')
      setIsListening(false)
    }
  }, [onResult])

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setIsListening(false)
  }, [])

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) {
      setError('Speech synthesis not supported')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }, [])

  return {
    isListening,
    error,
    startListening,
    stopListening,
    speak
  }
} 