// File: app/api/category/route.ts

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { ContextEngine } from '@/lib/context-engine'

export async function POST(request: Request) {
  console.log('Context API route started');
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    // Check auth from header first
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    console.log('Auth header details:', {
      exists: !!authHeader,
      headerKeys: Array.from(request.headers.keys()),
      value: authHeader ? `${authHeader.slice(0, 10)}...` : null
    });
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid auth header format');
      return NextResponse.json({ 
        success: false, 
        error: 'Not authenticated',
        message: 'Missing or invalid authentication token',
        debug: {
          headerExists: !!authHeader,
          headerFormat: authHeader ? authHeader.slice(0, 10) + '...' : null
        }
      }, { status: 401 })
    }

    // Extract token and clean it
    const token = authHeader.split(' ')[1].trim()
    console.log('Token details:', {
      length: token.length,
      prefix: token.slice(0, 10) + '...'
    });
    
    if (!token) {
      console.error('Empty token provided');
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        message: 'Empty authentication token'
      }, { status: 401 })
    }

    try {
      // Verify the token by getting the user
      const { data: { user }, error: verifyError } = await supabase.auth.getUser(token)
      
      console.log('Token verification:', { 
        userExists: !!user,
        hasError: !!verifyError,
        userId: user?.id
      });
      
      if (verifyError || !user) {
        console.error('Token verification failed:', verifyError);
        throw verifyError || new Error('User not found');
      }

      // Get request data
      const { userId, message, context } = await request.json()

      // Verify user ID matches
      if (userId !== user.id) {
        console.error('User ID mismatch:', { 
          requestUserId: userId, 
          tokenUserId: user.id 
        });
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

    } catch (authError) {
      console.error('Token verification failed:', authError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        message: 'Token verification failed'
      }, { status: 401 })
    }

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
    // Check auth from header first
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // Verify token
    const token = authHeader.split(' ')[1].trim()
    const { data: { user }, error: verifyError } = await supabase.auth.getUser(token)
    
    if (verifyError || !user) {
      return NextResponse.json({ 
        success: false,
        error: 'Invalid token'
      }, { status: 401 })
    }

    return NextResponse.json({ 
      success: true,
      userId: user.id
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error'
    }, { status: 500 })
  }
}