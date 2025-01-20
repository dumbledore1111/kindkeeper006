import { openai } from '@/lib/openai'
import { NextResponse } from 'next/server'

interface OpenAIError extends Error {
  response?: {
    data?: unknown;
    status?: number;
    statusText?: string;
  };
}

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
    const err = error as OpenAIError;
    console.error('OpenAI Test Error:', {
      message: err.message,
      response: err.response?.data
    })
    
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    )
  }
} 