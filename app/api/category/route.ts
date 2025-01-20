// File: app/api/category/route.ts--- this is for category creation

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { CategoryManager } from '@/lib/category-manager'
import { supabase } from '@/lib/supabase'
import { Database } from '@/types/database'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    const { userId, input } = await req.json()

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 })
    }

    const categoryManager = new CategoryManager()
    const result = await categoryManager.createDynamicCategory(userId, input)

    if (!result) {
      return NextResponse.json({
        success: false,
        message: 'Could not identify category creation intent'
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Created new category "${result.name}"`,
      data: result
    })

  } catch (error) {
    console.error('Category creation error:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to create category',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// For getting category suggestions
export async function GET(req: Request) {
  const supabase = createRouteHandlerClient<Database>({ cookies })

  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 })
    }

    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Category fetch error:', error)
      throw error
    }

    return NextResponse.json({ 
      success: true, 
      categories 
    })

  } catch (error) {
    return handleApiError(error)
  }
}