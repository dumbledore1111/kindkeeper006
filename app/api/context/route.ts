// File: app/api/category/route.ts--- this is for category creation

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { CategoryManager } from '@/lib/category-manager'
import { supabase } from '@/lib/supabase'

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
  try {
    const { searchParams } = new URL(req.url)
    const text = searchParams.get('text')
    const userId = searchParams.get('userId')

    if (!text || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters'
      }, { status: 400 })
    }

    const categoryManager = new CategoryManager()
    
    // Get existing categories for this user
    const { data: existingCategories } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('user_id', userId);

      if (!existingCategories) {
        return NextResponse.json({
          success: true,
          data: [] // Return empty suggestions if no existing categories
        });
      }

    const suggestions = await categoryManager.suggestCategorization(text, existingCategories)

    return NextResponse.json({
      success: true,
      data: suggestions
    })

  } catch (error) {
    console.error('Category suggestion error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get category suggestions'
    }, { status: 500 })
  }
}