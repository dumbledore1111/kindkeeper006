import { NextResponse } from 'next/server'
import { logger } from './logger'

// Senior-friendly error messages
const friendlyMessages = {
  RATE_LIMIT: "Please wait a moment before trying again.",
  DB_ERROR: "I couldn't save that right now. Could you try again?",
  VOICE_ERROR: "I had trouble hearing that. Could you speak again?",
  DEFAULT: "Something went wrong. Let's try that again."
}

export function handleApiError(error: unknown) {
  // Log the technical error for developers
  logger.error('Error occurred:', error)

  // Rate limit exceeded
  if (error instanceof Error && error.message.includes('Rate limit')) {
    return NextResponse.json({
      success: false,
      response: friendlyMessages.RATE_LIMIT,
      shouldSpeak: true
    }, { status: 429 })
  }

  // Database error
  if (error instanceof Error && error.message.includes('Database')) {
    return NextResponse.json({
      success: false,
      response: friendlyMessages.DB_ERROR,
      shouldSpeak: true
    }, { status: 500 })
  }

  // Voice recognition error
  if (error instanceof Error && error.message.includes('voice')) {
    return NextResponse.json({
      success: false,
      response: friendlyMessages.VOICE_ERROR,
      shouldSpeak: true
    }, { status: 400 })
  }

  // Default error
  return NextResponse.json({
    success: false,
    response: friendlyMessages.DEFAULT,
    shouldSpeak: true
  }, { status: 500 })
} 