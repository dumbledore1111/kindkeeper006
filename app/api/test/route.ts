import { openai } from '@/lib/openai'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 5
    })
    
    return NextResponse.json({ 
      success: true, 
      response: completion.choices[0].message.content 
    })
  } catch (error) {
    console.error('OpenAI Test Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'OpenAI test failed' },
      { status: 500 }
    )
  }
} 