import { NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { handleApiError } from '@/lib/error-handler'
import type { VerboseTranscription, EnhancedTranscriptionSegment } from '@/types/openai'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { logger } from '@/lib/logger'

// Keep the response type for better type safety
interface WhisperResponse {
  text: string;
  language?: string;
  confidence?: number;
  segments?: EnhancedTranscriptionSegment[];
}

interface WhisperError {
  type: 'auth' | 'input' | 'processing' | 'network';
  message: string;
  shouldRetry: boolean;
  details?: unknown;
}

const AUDIO_CONFIG = {
  MAX_SIZE_MB: 25,
  MIN_CONFIDENCE: 0.6,
  OPTIMAL_TEMPERATURE: 0.3,
  SUPPORTED_FORMATS: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav'] as const
} as const;

export async function POST(req: Request) {
  logger.auth('Whisper API route started')
  
  try {
    // Check auth from header first
    const authHeader = req.headers.get('authorization')
    logger.auth('Auth header exists: ' + !!authHeader)
    
    if (!authHeader?.startsWith('Bearer ')) {
      logger.error('Missing or invalid auth header format')
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated',
        shouldRetry: false,
        type: 'auth',
        message: 'Missing or invalid authentication token'
      } as WhisperError, { status: 401 })
    }

    // Extract token and clean it
    const token = authHeader.split(' ')[1].trim()
    
    if (!token) {
      logger.error('Empty token provided');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        shouldRetry: false,
        type: 'auth',
        message: 'Empty authentication token'
      } as WhisperError, { status: 401 })
    }

    // Create Supabase client and verify token
    const supabase = createRouteHandlerClient({ cookies })
    
    try {
      // Verify the token by getting the user
      const { data: { user }, error: verifyError } = await supabase.auth.getUser(token)
      
      logger.auth('Token verification: ' + JSON.stringify({ 
        userExists: !!user,
        hasError: !!verifyError 
      }));
      
      if (verifyError || !user) {
        throw verifyError || new Error('User not found');
      }
    } catch (authError) {
      logger.error('Token verification failed:', authError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        shouldRetry: false,
        type: 'auth',
        message: 'Token verification failed'
      } as WhisperError, { status: 401 })
    }

    const formData = await req.formData()
    const audioFile = formData.get('file') as Blob

    if (!audioFile) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Please speak again, I couldn\'t hear that properly.',
          shouldRetry: true,
          type: 'input',
          message: 'No audio file provided'
        } as WhisperError,
        { status: 400 }
      )
    }

    // Validate audio file
    if (audioFile.size > AUDIO_CONFIG.MAX_SIZE_MB * 1024 * 1024) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'The recording is too long. Please try a shorter message.',
          shouldRetry: true,
          type: 'input',
          message: 'Audio file too large'
        } as WhisperError,
        { status: 400 }
      )
    }

    // Validate audio format
    if (!AUDIO_CONFIG.SUPPORTED_FORMATS.includes(audioFile.type as typeof AUDIO_CONFIG.SUPPORTED_FORMATS[number])) {
      logger.error('Unsupported audio format: ' + audioFile.type)
    }

    // Convert to File object with optimal format for Indian English
    const file = new File([audioFile], 'audio.webm', { 
      type: audioFile.type || 'audio/webm'
    })

    // Enhanced Whisper configuration for Indian English
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json',
      temperature: AUDIO_CONFIG.OPTIMAL_TEMPERATURE,
      prompt: `This is Indian English speech about financial transactions, expenses, and daily activities. Common words: rupees, maid, pension, bill, payment.`
    }) as unknown as VerboseTranscription;

    // Process transcription with enhanced cleaning
    const result: WhisperResponse = {
      text: transcription.text,
      language: transcription.language,
      confidence: transcription.segments?.[0]?.confidence,
      segments: transcription.segments
    }

    // Enhanced cleaning for Indian English
    const cleanedText = cleanIndianEnglishText(result.text)

    // Only return if confidence is good enough
    if (result.confidence && result.confidence < AUDIO_CONFIG.MIN_CONFIDENCE) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'I didn\'t catch that clearly. Could you please speak a bit more slowly?',
          shouldRetry: true,
          type: 'processing',
          message: 'Low confidence in transcription'
        } as WhisperError,
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true,
      text: cleanedText,
      original: result.text,
      confidence: result.confidence,
      segments: result.segments?.map(s => ({
        text: s.text,
        confidence: s.confidence
      }))
    })

  } catch (error: unknown) {
    logger.error('Whisper API error:', error)
    
    const err = error as Error
    
    if (err.message?.includes('audiodecode')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'I had trouble understanding that. Could you speak a bit more clearly?',
          shouldRetry: true,
          type: 'processing',
          message: 'Audio decode error'
        } as WhisperError,
        { status: 400 }
      )
    }

    if (err.message?.includes('network') || ('code' in err && err.code === 'UND_ERR_CONNECT_TIMEOUT')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'There seems to be a connection issue. Please try again.',
          shouldRetry: true,
          type: 'network',
          message: 'Network error'
        } as WhisperError,
        { status: 503 }
      )
    }

    return handleApiError(error)
  }
}

// Enhanced cleaning function with better pattern matching
function cleanIndianEnglishText(text: string): string {
  return text
    .trim()
    // Common Indian English patterns
    .replace(/rupees?/gi, '₹')
    .replace(/rs\.?/gi, '₹')
    .replace(/(-|\/|\.)\s*rupees?/gi, '₹')
    // Fix common transcription errors
    .replace(/to\s+the\s+made/gi, 'to the maid')
    .replace(/making\s+payment/gi, 'maid payment')
    .replace(/pins?ion/gi, 'pension')
    .replace(/bill\s+pay(?:ment)?/gi, 'bill payment')
    // Remove unnecessary filler words
    .replace(/\b(actually|basically|only|kindly|please|tell me|you see)\b/gi, '')
    // Fix number formats
    .replace(/(\d+)\s+thousand/gi, '$1000')
    .replace(/(\d+)\s+hundred/gi, '$100')
    .replace(/(\d+)\s+rupees?/gi, '₹$1')
    // Clean up multiple spaces and trim
    .replace(/\s+/g, ' ')
    .trim()
} 