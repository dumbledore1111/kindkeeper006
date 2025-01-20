import { useState, useCallback } from 'react'
import { useSpeechSynthesis } from './useSpeechSynthesis'

interface SpeechOptions {
  useElevenLabs?: boolean;
  responseType?: 'simple' | 'complex' | 'query' | 'error';
  emotion?: 'neutral' | 'concerned' | 'friendly';
}

export function useSpeechOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { speak: speakBrowser } = useSpeechSynthesis()

  const speak = useCallback(async (text: string, options: SpeechOptions = {}) => {
    try {
      setError(null)
      setIsSpeaking(true)

      // Determine if we should use ElevenLabs
      const shouldUseElevenLabs = options.useElevenLabs || 
        text.length > 100 ||                        // Long responses
        options.responseType === 'complex' ||       // Complex explanations
        options.responseType === 'error' ||         // Error messages
        /[₹\d,]+/.test(text) ||                    // Contains currency/numbers
        text.includes('reminder') ||                // Reminders
        text.includes('question');                  // Questions

      if (shouldUseElevenLabs) {
        try {
          const response = await fetch('/api/text-to-speech', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`
            },
            body: JSON.stringify({
              text,
              responseType: options.responseType || 'simple',
              emotion: options.emotion || 'neutral'
            })
          });

          if (!response.ok) {
            throw new Error('ElevenLabs request failed');
          }

          const audioBuffer = await response.arrayBuffer();
          const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
          const audio = new Audio(URL.createObjectURL(audioBlob));

          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => {
            // Fallback to browser TTS if ElevenLabs fails
            console.warn('ElevenLabs failed, falling back to browser TTS');
            speakBrowser(text);
          };

          await audio.play();
        } catch (err) {
          // Fallback to browser TTS
          console.warn('ElevenLabs error, falling back to browser TTS:', err);
          speakBrowser(text);
        }
      } else {
        // Use browser TTS for simple responses
        speakBrowser(text);
      }
    } catch (err) {
      console.error('Speech output error:', err);
      setError(err instanceof Error ? err.message : 'Failed to speak');
    } finally {
      setIsSpeaking(false);
    }
  }, [speakBrowser]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel(); // Stop browser TTS
    // Stop any playing ElevenLabs audio
    document.querySelectorAll('audio').forEach(audio => {
      audio.pause();
      audio.remove();
    });
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    error
  };
} 