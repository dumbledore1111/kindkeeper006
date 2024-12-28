import { openai } from '@/lib/openai'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as Blob

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      )
    }

    // Convert to WAV format
    const audioBuffer = await audioFile.arrayBuffer()
    const wavFile = new File([audioBuffer], 'audio.wav', { 
      type: 'audio/wav'
    })

    const transcription = await openai.audio.transcriptions.create({
      file: wavFile,
      model: 'whisper-1',
      language: 'en'
    })

    return NextResponse.json({ 
      success: true,
      text: transcription.text 
    })

  } catch (error: any) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message 
      },
      { status: 500 }
    )
  }
} 