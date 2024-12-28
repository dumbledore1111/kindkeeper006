import { useState, useEffect, useCallback } from 'react'

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices()
        setVoices(availableVoices)
      }

      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
    }
  }, [])

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      setError('Speech synthesis not supported')
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const englishVoice = voices.find(voice => voice.lang.startsWith('en-'))
    if (englishVoice) utterance.voice = englishVoice

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => {
      setError('Speech synthesis failed')
      setSpeaking(false)
    }

    window.speechSynthesis.speak(utterance)
  }, [voices])

  return { speak, speaking, error }
} 