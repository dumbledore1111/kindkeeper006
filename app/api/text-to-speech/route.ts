import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'
import type { ElevenLabsResponse } from '@/types/api'

// Voice configuration constants
const VOICE_CONFIG = {
  INDIAN_VOICE_ID: '21m00Tcm4TlvDq8ikWAM', // Replace with your chosen Indian English voice ID
  DEFAULT_STABILITY: 0.7,  // Increased for clearer speech
  DEFAULT_SIMILARITY: 0.7,  // Balanced for natural sound
  RATE_LIMIT: 10 // Requests per minute
}

export async function POST(req: Request) {
  try {
    const { 
      text, 
      responseType = 'simple',  // 'simple' | 'complex' | 'query' | 'error'
      emotion = 'neutral'       // 'neutral' | 'concerned' | 'friendly'
    } = await req.json()

    // Voice settings based on response type
    const voiceSettings = getVoiceSettings(responseType, emotion)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_CONFIG.INDIAN_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: prepareText(text, responseType),
          model_id: 'eleven_multilingual_v2', // Using multilingual model for better Indian English
          voice_settings: voiceSettings
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
      },
    })

  } catch (error) {
    logger.error('Text-to-speech error:', error)
    return handleApiError(error)
  }
}

function getVoiceSettings(responseType: string, emotion: string) {
  switch(responseType) {
    case 'complex':
      return {
        stability: 0.8,        // More stable for complex responses
        similarity_boost: 0.7,
        style: 0.7,           // More expressive
        speaking_rate: 0.9    // Slightly slower for clarity
      }
    case 'query':
      return {
        stability: 0.7,
        similarity_boost: 0.8,
        style: 0.6,
        speaking_rate: 1.0    // Normal speed for questions
      }
    case 'error':
      return {
        stability: 0.9,       // Very stable for clear error messages
        similarity_boost: 0.7,
        style: 0.5,          // Less expressive for errors
        speaking_rate: 0.8    // Slower for clarity
      }
    default:
      return {
        stability: VOICE_CONFIG.DEFAULT_STABILITY,
        similarity_boost: VOICE_CONFIG.DEFAULT_SIMILARITY,
        speaking_rate: 1.0
      }
  }
}

function prepareText(text: string, responseType: string): string {
  // Add SSML tags for better pronunciation
  const ssml = `<speak>
    ${addPronunciationGuides(text)}
  </speak>`

  return ssml
}

function addPronunciationGuides(text: string): string {
  // Add pronunciation guides for Indian English
  return text
    .replace(/₹/g, '<say-as interpret-as="currency">rupees</say-as>')
    .replace(/(\d+),(\d+)/g, '<say-as interpret-as="number">$1$2</say-as>')
    // Add more Indian English pronunciation patterns
    .replace(/(\d+)\/(\d+)\/(\d+)/g, '<say-as interpret-as="date">$1/$2/$3</say-as>')
} 