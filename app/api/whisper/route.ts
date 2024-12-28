import { NextResponse } from 'next/server'
import { openai } from '@/lib/openai'

export async function POST(req: Request) {
  console.log('Whisper API route started')
  
  try {
    const formData = await req.formData()
    const audioFile = formData.get('file') as Blob

    if (!audioFile) {
      console.log('No audio file provided')
      return NextResponse.json(
        { success: false, error: 'No audio file provided' },
        { status: 400 }
      )
    }

    console.log('Audio file received:', {
      size: audioFile.size,
      type: audioFile.type
    })

    // Convert to File object that OpenAI accepts
    const file = new File([audioFile], 'audio.webm', { 
      type: audioFile.type || 'audio/webm'
    })

    console.log('Calling Whisper API')
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'json'
    })

    console.log('Transcription received:', transcription)

    return NextResponse.json({ 
      success: true,
      text: transcription.text 
    })

  } catch (error: any) {
    console.error('Whisper API Error:', {
      message: error.message,
      status: error.status,
      response: error.response?.data
    })

    return NextResponse.json(
      { 
        success: false, 
        error: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Failed to transcribe audio'
      },
      { status: 500 }
    )
  }
} 