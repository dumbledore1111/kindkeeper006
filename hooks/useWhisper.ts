import { useState, useCallback, useRef } from 'react'

export function useWhisper() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string>('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const startRecording = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        throw new Error('Recording is not supported in this browser')
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

          const response = await fetch('/api/whisper', {
            method: 'POST',
            body: formData
          })

          if (!response.ok) {
            throw new Error(`Server error: ${response.status}`)
          }

          const data = await response.json()
          if (data.success && data.text) {
            const cleanedText = data.text
              .trim()
              .replace(/(\r\n|\n|\r)/gm, " ")
              .replace(/\s+/g, " ")
              .replace(/^\s+|\s+$/g, "")
            
            setTranscript(cleanedText)
            setError('')
          } else {
            throw new Error(data.error || 'Failed to transcribe')
          }
        } catch (err) {
          console.error('Transcription error:', err)
          setError(err instanceof Error ? err.message : 'Failed to transcribe audio')
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
      setError(err instanceof Error ? err.message : 'Failed to start recording')
      setIsRecording(false)
    }
  }, [])

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