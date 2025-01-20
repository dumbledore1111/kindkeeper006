import { useState, useCallback, useRef } from 'react'
import type { WhisperResult, WhisperError } from '@/types/api'

interface UseWhisperProps {
  onTranscript?: (text: string) => void;
  authToken?: string;
  onError?: (error: WhisperError) => void;
}

export function useWhisper({ onTranscript, authToken, onError }: UseWhisperProps = {}) {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<WhisperError | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const startRecording = useCallback(async () => {
    try {
      // Clear previous error
      setError(null)

      if (!navigator.mediaDevices || !window.MediaRecorder) {
        const err = {
          type: 'microphone',
          message: 'Recording is not supported in this browser',
          shouldRetry: false
        } as WhisperError;
        setError(err);
        onError?.(err);
        throw err;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
          sampleRate: 16000
        }
      })

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 16000
      })
      mediaRecorderRef.current = mediaRecorder

      const audioChunks: Blob[] = []

      mediaRecorder.addEventListener('dataavailable', event => {
        if (event.data.size > 0) {
          audioChunks.push(event.data)
        }
      })

      mediaRecorder.addEventListener('stop', async () => {
        try {
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' })
          const formData = new FormData()
          formData.append('file', audioBlob, 'audio.webm')

          // Add proper headers including Content-Type for FormData
          const headers: Record<string, string> = {}
          if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`
          }

          const response = await fetch('/api/whisper', {
            method: 'POST',
            headers,
            body: formData
          })

          if (!response.ok) {
            const err = {
              type: 'network',
              message: `Server error: ${response.status}`,
              shouldRetry: true
            } as WhisperError;
            setError(err);
            onError?.(err);
            throw err;
          }

          const data: { success: boolean; text: string; confidence?: number } = await response.json()
          
          if (data.success && data.text) {
            const cleanedText = data.text
              .trim()
              .replace(/(\r\n|\n|\r)/gm, " ")
              .replace(/\s+/g, " ")
              .replace(/^\s+|\s+$/g, "")

            setTranscript(cleanedText)
            if (onTranscript) {
              onTranscript(cleanedText)
            }
            setError(null)
          } else {
            const err = {
              type: 'transcription',
              message: data.text || 'Failed to transcribe',
              shouldRetry: true
            } as WhisperError;
            setError(err);
            onError?.(err);
            throw err;
          }
        } catch (err) {
          console.error('Transcription error:', err)
          const whisperError = err as WhisperError;
          setError(whisperError)
          onError?.(whisperError);
        } finally {
          stream.getTracks().forEach(track => track.stop())
          setIsRecording(false)
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
        }
      })

      // Start recording with 250ms timeslice for better quality
      mediaRecorder.start(250)
      setIsRecording(true)

      // Stop after 10 seconds
      timeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording()
        }
      }, 10000)

    } catch (err) {
      console.error('Recording error:', err)
      const whisperError = {
        type: 'microphone',
        message: err instanceof Error ? err.message : 'Failed to start recording',
        shouldRetry: false
      } as WhisperError;
      setError(whisperError)
      onError?.(whisperError);
      setIsRecording(false)
    }
  }, [onTranscript, authToken, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return {
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording
  }
} 