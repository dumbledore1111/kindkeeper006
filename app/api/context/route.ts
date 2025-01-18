// File: app/api/category/route.ts

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ContextEngine } from '@/lib/context-engine'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    // Check auth
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // Get request data
    const { userId, message, context } = await request.json()

    // Verify user
    if (userId !== session.user.id) {
      return NextResponse.json({
        success: false,
        error: 'User ID mismatch'
      }, { status: 403 })
    }

    // Process with context engine
    const contextEngine = new ContextEngine(userId)
    const result = await contextEngine.processInput(message, context)

    return NextResponse.json({
      success: true,
      response: result.response,
      context: result.context,
      needsMoreInfo: result.needsMoreInfo,
      intent: result.intent,
      dbOperations: result.dbOperations
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      return new NextResponse(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401 }
      )
    }

    // Your existing context logic here
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API error:', error)
    return new NextResponse(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    )
  }
}