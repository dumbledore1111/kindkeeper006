// File: my-app/lib/db.ts

import { supabase } from './supabase'
import { logger } from './logger'
import type { 
  Transaction, 
  ServiceProvider, 
  CategoryType,
  TransactionType 
} from '@/types/database'

export async function createTransaction(userId: string, data: {
  amount: number
  type: TransactionType
  description: string
  category?: CategoryType
  payment_method?: string
  source_destination?: string
  is_recurring?: boolean
  service_provider?: ServiceProvider
}) {
  try {
    // Start transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: data.amount,
        type: data.type,
        description: data.description,
        payment_method: data.payment_method,
        source_destination: data.source_destination,
        is_recurring: data.is_recurring || false,
        created_at: new Date()
      })
      .select()
      .single()

    if (transactionError) throw transactionError

    // Add categories
    if (data.category) {
      const { error: categoryError } = await supabase
        .from('transaction_categories')
        .insert({
          transaction_id: transaction.id,
          category: data.category
        })

      if (categoryError) throw categoryError
    }

    // Update or create service provider
    if (data.service_provider) {
      await handleServiceProvider(userId, transaction.id, data.service_provider)
    }

    // Update monthly summary
    await updateMonthlySummary(userId)

    return transaction
  } catch (error) {
    logger.error('Transaction creation error:', error)
    throw error
  }
}

export async function createReminder(userId: string, data: {
  title: string
  description?: string
  amount?: number
  due_date: Date
  category?: CategoryType
  recurring?: boolean
  frequency?: string
}) {
  try {
    const { data: reminder, error } = await supabase
      .from('reminders')
      .insert({
        user_id: userId,
        title: data.title,
        description: data.description,
        amount: data.amount,
        due_date: data.due_date,
        category: data.category,
        recurring: data.recurring || false,
        frequency: data.frequency,
        status: 'PENDING',
        created_at: new Date()
      })
      .select()
      .single()

    if (error) throw error

    // Schedule notification
    await createNotification({
      user_id: userId,
      reminder_id: reminder.id,
      title: reminder.title,
      scheduled_for: reminder.due_date
    })

    return reminder
  } catch (error) {
    logger.error('Reminder creation error:', error)
    throw error
  }
}

export async function recordAttendance(userId: string, data: {
  provider_id: string
  date: Date
  present: boolean
  quantity?: number
  notes?: string
}) {
  try {
    const { data: log, error } = await supabase
      .from('attendance_logs')
      .insert({
        user_id: userId,
        provider_id: data.provider_id,
        work_date: data.date,
        present: data.present,
        quantity: data.quantity,
        notes: data.notes,
        created_at: new Date()
      })
      .select()
      .single()

    if (error) throw error
    return log
  } catch (error) {
    logger.error('Attendance log error:', error)
    throw error
  }
}

export async function createVoiceEntry(userId: string, data: {
  transcript: string
  amount?: number
  category?: CategoryType
  description?: string
  is_reminder?: boolean
  due_date?: Date
}) {
  try {
    const { data: entry, error } = await supabase
      .from('voice_entries')
      .insert({
        user_id: userId,
        transcript: data.transcript,
        amount: data.amount,
        category: data.category,
        description: data.description,
        is_reminder: data.is_reminder || false,
        due_date: data.due_date,
        date: new Date(),
        created_at: new Date()
      })
      .select()
      .single()

    if (error) throw error
    return entry
  } catch (error) {
    logger.error('Voice entry error:', error)
    throw error
  }
}

// Helper functions
async function handleServiceProvider(
  userId: string, 
  transactionId: string, 
  provider: ServiceProvider
) {
  try {
    // Check if provider exists
    const { data: existingProvider } = await supabase
      .from('service_providers')
      .select('id')
      .eq('user_id', userId)
      .eq('name', provider.name)
      .single()

    if (existingProvider) {
      // Update existing provider
      await supabase
        .from('service_providers')
        .update({
          service_type: provider.service_type,
          rate_per_unit: provider.rate_per_unit,
          updated_at: new Date()
        })
        .eq('id', existingProvider.id)

      return existingProvider.id
    } else {
      // Create new provider
      const { data: newProvider, error } = await supabase
        .from('service_providers')
        .insert({
          user_id: userId,
          name: provider.name,
          service_type: provider.service_type,
          rate_per_unit: provider.rate_per_unit,
          created_at: new Date()
        })
        .select()
        .single()

      if (error) throw error
      return newProvider.id
    }
  } catch (error) {
    logger.error('Service provider error:', error)
    throw error
  }
}

async function updateMonthlySummary(userId: string) {
  try {
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    // Get month's transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', firstOfMonth.toISOString())
      .lte('created_at', lastOfMonth.toISOString())

    if (!transactions?.length) return

    // Calculate totals
    const totals = transactions.reduce(
      (acc, t) => {
        if (t.type === 'income') {
          acc.income += t.amount
        } else {
          acc.expenses += t.amount
        }
        return acc
      },
      { income: 0, expenses: 0 }
    )

    // Update or create monthly summary
    const { error } = await supabase
      .from('monthly_summaries')
      .upsert({
        user_id: userId,
        month: firstOfMonth,
        total_income: totals.income,
        total_expenses: totals.expenses,
        savings: totals.income - totals.expenses,
        updated_at: now
      })

    if (error) throw error
  } catch (error) {
    logger.error('Monthly summary error:', error)
    // Don't throw - this is a background operation
  }
}

async function createNotification(data: {
  user_id: string
  reminder_id: string
  title: string
  scheduled_for: Date
}) {
  try {
    await supabase
      .from('notifications')
      .insert({
        user_id: data.user_id,
        reminder_id: data.reminder_id,
        title: data.title,
        scheduled_for: data.scheduled_for,
        status: 'PENDING',
        type: 'REMINDER',
        created_at: new Date()
      })
  } catch (error) {
    logger.error('Notification error:', error)
    // Don't throw - notifications are non-critical
  }
}