import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { Database } from '@/types/database'

// Voice configuration constants
const VOICE_CONFIG = {
  INDIAN_VOICE_ID: '21m00Tcm4TlvDq8ikWAM',
  DEFAULT_STABILITY: 0.7,
  DEFAULT_SIMILARITY: 0.7,
  RATE_LIMIT: 10
} as const

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  speaking_rate: number;
}

interface RequestBody {
  text: string;
  responseType?: 'simple' | 'complex' | 'query' | 'error';
}

export async function POST(req: Request) {
  try {
    // Check auth
    const supabase = createRouteHandlerClient<Database>({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // Verify ElevenLabs API key
    if (!process.env.ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key not configured')
    }

    const { text, responseType = 'simple' } = await req.json() as RequestBody

    // Voice settings based on response type
    const voiceSettings = getVoiceSettings(responseType)

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_CONFIG.INDIAN_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: prepareText(text),
          model_id: 'eleven_multilingual_v2',
          voice_settings: voiceSettings
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error('ElevenLabs API error:', { status: response.status, error: errorData })
      throw new Error(`ElevenLabs API error: ${response.status}`)
    }

    const audioBuffer = await response.arrayBuffer()
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache'
      },
    })

  } catch (error) {
    logger.error('Text-to-speech error:', error)
    return handleApiError(error)
  }
}

function getVoiceSettings(responseType: RequestBody['responseType']): VoiceSettings {
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

function prepareText(text: string): string {
  return `<speak>${addPronunciationGuides(text)}</speak>`
}

function addPronunciationGuides(text: string): string {
  return text
    .replace(/₹/g, '<say-as interpret-as="currency">rupees</say-as>')
    .replace(/(\d+),(\d+)/g, '<say-as interpret-as="number">$1$2</say-as>')
    .replace(/(\d+)\/(\d+)\/(\d+)/g, '<say-as interpret-as="date">$1/$2/$3</say-as>')
} 