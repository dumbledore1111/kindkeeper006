import { NextResponse } from 'next/server'
import { openai } from '@/lib/openai'
import { handleApiError } from '@/lib/error-handler'

// Add response type for better type safety
interface WhisperResponse {
  text: string;
  language?: string;
  confidence?: number;
}

export async function POST(req: Request) {
  console.log('Whisper API route started')
  
  try {
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
      language: 'en', // Keeping English but will handle Indian accent better
      response_format: 'verbose_json', // Get more details about transcription
      temperature: 0.2, // Lower temperature for more accurate transcription
      prompt: 'This is Indian English speech about financial transactions and daily expenses.' // Context hint
    })

    // Process transcription
    const result: WhisperResponse = {
      text: transcription.text,
      language: transcription.language,
      confidence: transcription.segments?.[0]?.confidence
    }

    // Clean up Indian English specific patterns
    const cleanedText = cleanIndianEnglishText(result.text)

    return NextResponse.json({ 
      success: true,
      text: cleanedText,
      original: result.text,
      confidence: result.confidence
    })

  } catch (error: any) {
    // Enhanced error handling
    if (error.message.includes('audiodecode')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'I had trouble understanding that. Could you speak a bit more clearly?',
          shouldRetry: true
        },
        { status: 400 }
      )
    }

    if (error.message.includes('network')) {
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

// Helper function to clean Indian English text
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
    // Remove unnecessary filler words
    .replace(/\b(actually|basically|only)\b/gi, '')
    .trim()
} 