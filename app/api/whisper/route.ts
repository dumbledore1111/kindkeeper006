import { NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { handleApiError } from '@/lib/error-handler'
import type { VerboseTranscription, EnhancedTranscriptionSegment } from '@/types/openai'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Keep the response type for better type safety
interface WhisperResponse {
  text: string;
  language?: string;
  confidence?: number;
}

export async function POST(req: Request) {
  console.log('Whisper API route started')
  
  try {
    // Check auth from header first
    const authHeader = req.headers.get('authorization')
    console.log('Auth header exists:', !!authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid auth header format');
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated',
        shouldRetry: false,
        type: 'auth',
        message: 'Missing or invalid authentication token'
      }, { status: 401 })
    }

    // Extract token and clean it
    const token = authHeader.split(' ')[1].trim()
    console.log('Received token length:', token.length);
    
    if (!token) {
      console.error('Empty token provided');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        shouldRetry: false,
        type: 'auth',
        message: 'Empty authentication token'
      }, { status: 401 })
    }

    // Verify token with Supabase
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session }, error: authError } = await supabase.auth.getSession()
    
    console.log('Supabase session exists:', !!session);
    console.log('Auth error exists:', !!authError);
    
    if (authError) {
      console.error('Supabase auth error:', authError);
      return NextResponse.json({ 
        success: false, 
        error: 'Authentication error',
        shouldRetry: false,
        type: 'auth',
        message: authError.message
      }, { status: 401 })
    }
    
    if (!session?.access_token) {
      console.error('No active session found');
      return NextResponse.json({ 
        success: false, 
        error: 'No active session',
        shouldRetry: false,
        type: 'auth',
        message: 'Please log in again'
      }, { status: 401 })
    }

    // Compare tokens
    const tokensMatch = token === session.access_token;
    console.log('Tokens match:', tokensMatch);
    console.log('Token lengths - Received:', token.length, 'Session:', session.access_token.length);
    
    if (!tokensMatch) {
      console.error('Token mismatch');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid session',
        shouldRetry: false,
        type: 'auth',
        message: 'Session token mismatch'
      }, { status: 401 })
    }

    // Log successful authentication
    console.log('Authentication successful, proceeding with request');

    const formData = await req.formData()
    const audioFile = formData.get('file') as Blob

    if (!audioFile) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Please speak again, I couldn\'t hear that properly.',
          shouldRetry: true 
        },
        { status: 400 }
      )
    }

    // Validate audio file
    if (audioFile.size > 25 * 1024 * 1024) { // 25MB limit
      return NextResponse.json(
        { 
          success: false, 
          error: 'The recording is too long. Please try a shorter message.',
          shouldRetry: true 
        },
        { status: 400 }
      )
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
      temperature: 0.3, // Lower temperature for more accurate transcription
      prompt: `This is Indian English speech about financial transactions, expenses, and daily activities. Common words: rupees, maid, pension, bill, payment.`
    }) as unknown as VerboseTranscription;

    // Process transcription with enhanced cleaning
    const result: WhisperResponse = {
      text: transcription.text,
      language: transcription.language,
      confidence: transcription.segments?.[0]?.confidence
    }

    // Enhanced cleaning for Indian English
    const cleanedText = cleanIndianEnglishText(result.text)

    // Only return if confidence is good enough
    if (result.confidence && result.confidence < 0.6) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'I didn\'t catch that clearly. Could you please speak a bit more slowly?',
          shouldRetry: true
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ 
      success: true,
      text: cleanedText,
      original: result.text,
      confidence: result.confidence
    })

  } catch (error: any) {
    console.error('Whisper API error:', error)
    
    if (error.message?.includes('audiodecode')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'I had trouble understanding that. Could you speak a bit more clearly?',
          shouldRetry: true
        },
        { status: 400 }
      )
    }

    if (error.message?.includes('network') || error.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'There seems to be a connection issue. Please try again.',
          shouldRetry: true
        },
        { status: 503 }
      )
    }

    return handleApiError(error)
  }
}

// Enhanced cleaning function
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
    .trim()
} 