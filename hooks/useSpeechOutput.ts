import { useState, useCallback } from 'react'
import { useSpeechSynthesis } from './useSpeechSynthesis'

interface SpeechOptions {
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

      try {
        console.log('Attempting ElevenLabs TTS...');
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text,
            responseType: options.responseType || 'simple',
            emotion: options.emotion || 'neutral'
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error('ElevenLabs API error:', errorData);
          throw new Error(errorData.error || 'ElevenLabs request failed');
        }

        console.log('ElevenLabs response received, creating audio...');
        const audioBuffer = await response.arrayBuffer();
        const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
        const audio = new Audio(URL.createObjectURL(audioBlob));

        audio.onended = () => {
          console.log('ElevenLabs audio finished playing');
          setIsSpeaking(false);
        };
        
        audio.onerror = (e) => {
          console.error('ElevenLabs audio playback error:', e);
          speakBrowser(text);
        };

        console.log('Playing ElevenLabs audio...');
        await audio.play();
        return;
      } catch (err) {
        console.error('ElevenLabs error:', err);
        // Fall back to browser TTS
        speakBrowser(text);
      }
    } catch (err) {
      console.error('Speech output error:', err);
      setError(err instanceof Error ? err.message : 'Failed to speak');
      speakBrowser(text);
    } finally {
      setIsSpeaking(false);
    }
  }, [speakBrowser]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
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