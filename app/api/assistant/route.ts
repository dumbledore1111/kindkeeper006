// File: app/api/assistant/route.ts

import { NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { processChatCompletion, processAssistantMessage } from '@/lib/openai'
import { 
  createTransaction, 
  createReminder, 
  createVoiceEntry, 
  recordAttendance 
} from '@/lib/database'
import { logger } from '@/lib/logger'
import { handleApiError } from '@/lib/error-handler'
import type { Transaction, CategoryType } from '@/types/database'

export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  
  try {
    const { message, userId, language = 'en' } = await req.json()

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 })
    }

    // Process with OpenAI
    const result = await processChatCompletion(message)

    // Handle voice entry first
    if (result.voice_entry) {
      await createVoiceEntry(userId, {
        transcript: result.voice_entry.transcript,
        amount: result.voice_entry.amount,
        category: result.voice_entry.category,
        description: result.voice_entry.description,
        is_reminder: result.voice_entry.is_reminder,
        due_date: result.voice_entry.due_date
      })
    }

    // If we need more information
    if (result.needs_clarification) {
      return NextResponse.json({
        success: true,
        response: result.needs_clarification.context,
        needsMoreInfo: true,
        clarification: result.needs_clarification
      })
    }

    // Handle transaction if present
    if (result.transaction) {
      const transactionData = {
        amount: result.transaction.amount,
        type: result.transaction.type,
        description: result.transaction.description
      }

      const transaction = await createTransaction(userId, transactionData)

      // If service provider present, handle attendance
      if (result.service_provider?.attendance && result.service_provider.name) {
        await recordAttendance(userId, {
          provider_id: userId,
          date: result.service_provider.attendance.work_date,
          present: result.service_provider.attendance.present,
          quantity: result.service_provider.attendance.quantity,
          notes: result.service_provider.attendance.notes
        })
      }

      return NextResponse.json({
        success: true,
        response: `Got it! ${result.transaction.type === 'expense' ? 'Paid' : 'Received'} ₹${result.transaction.amount}`,
        data: transaction
      })
    }

    // Handle reminder if present
    if (result.reminder) {
      const reminderData = {
        title: result.reminder.title,
        description: result.reminder.description,
        amount: result.reminder.amount,
        due_date: result.reminder.due_date,
        recurring: result.reminder.recurring,
        frequency: result.reminder.frequency
      }

      const reminder = await createReminder(userId, reminderData)
      return NextResponse.json({
        success: true,
        response: `I'll remind you ${result.reminder.recurring ? 'every' : 'on'} ${new Date(result.reminder.due_date).toLocaleDateString('en-IN')}`,
        reminder: reminder
      })
    }

    // If nothing else matched, maintain conversation
    const assistantResponse = await processAssistantMessage(userId, message)
    return NextResponse.json({
      success: true,
      response: assistantResponse
    })

  } catch (error) {
    logger.error('API Error', error)
    return handleApiError(error)
  }
}

export async function PATCH(req: Request) {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    const { reminderId, userId, action = 'complete' } = await req.json()

    if (action === 'complete') {
      const { data: reminder } = await supabase
        .from('reminders')
        .select('*')
        .eq('id', reminderId)
        .single()

      if (!reminder) {
        return NextResponse.json({
          success: false,
          error: 'Reminder not found'
        }, { status: 404 })
      }

      // Create transaction from reminder if needed
      if (reminder.amount) {
        await createTransaction(userId, {
          amount: reminder.amount,
          type: 'expense',
          description: reminder.title
        })
      }

      // Update reminder status
      await supabase
        .from('reminders')
        .update({ 
          status: 'COMPLETED',
          completed_at: new Date()
        })
        .eq('id', reminderId)

      return NextResponse.json({
        success: true,
        message: reminder.amount ? 
          "Payment recorded and reminder completed" : 
          "Reminder marked as complete"
      })
    }

    return NextResponse.json({
      success: false,
      response: "Invalid action"
    })

  } catch (error) {
    logger.error('Reminder update error:', error)
    return handleApiError(error)
  }
}
