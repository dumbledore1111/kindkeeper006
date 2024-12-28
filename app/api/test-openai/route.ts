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
  } catch (error: any) {
    console.error('OpenAI Test Error:', {
      message: error.message,
      response: error.response?.data
    })
    
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
} 