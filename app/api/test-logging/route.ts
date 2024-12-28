import { NextResponse } from 'next/server'
import { testLogging } from '@/lib/test-logging'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'

export async function GET() {
  try {
    const success = await testLogging()
    return NextResponse.json({
      success,
      message: 'Check Supabase logs'
    })
  } catch (error) {
    logger.error('Test endpoint failed', { error })
    return handleApiError(error)
  }
} 