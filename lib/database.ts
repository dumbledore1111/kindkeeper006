// File: my-app/lib/db.ts

import { supabase } from './supabase'
import { logger } from './logger'
import type { 
  Transaction, 
  ServiceProvider, 
  CategoryType,
  TransactionType,
  ContextLog, 
  AttendanceLog,
  MonthlySummary,
  EventRelationship,
  TransactionData,
  VoiceEntryData,
  UserContext 
} from '@/types/database'
import { queryCache } from './queryCache'

export async function createTransaction(
  data: TransactionData,
  context: UserContext
): Promise<void> {
  try {
    // Start transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: context.userId,
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
      await handleServiceProvider(context.userId, transaction.id, data.service_provider)
    }

    // Update monthly summary
    await updateMonthlySummaryBackground(context.userId)

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

export async function createVoiceEntry(
  data: VoiceEntryData,
  context: UserContext
): Promise<void> {
  try {
    const { data: entry, error } = await supabase
      .from('voice_entries')
      .insert({
        user_id: context.userId,
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

// Internal background update
async function updateMonthlySummaryBackground(userId: string) {
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

export async function createContextLog(userId: string, data: {
  context_type: string;
  context_data: any;
  related_transactions?: string[];
  valid_until?: Date;
}): Promise<ContextLog> {
  const { data: log, error } = await supabase
    .from('context_logs')
    .insert({
      user_id: userId,
      context_type: data.context_type,
      context_data: data.context_data,
      valid_from: new Date(),
      valid_until: data.valid_until
    })
    .select()
    .single();

  if (error) throw error;
  return log;
}

export async function updateAttendanceLog(
  userId: string,
  providerId: string,
  data: {
    date: Date;
    present: boolean;
    notes?: string;
    linked_transaction_id?: string;
  }
): Promise<AttendanceLog> {
  const { data: log, error } = await supabase
    .from('attendance_logs')
    .upsert({
      user_id: userId,
      provider_id: providerId,
      date: data.date,
      present: data.present,
      notes: data.notes,
      linked_transaction_id: data.linked_transaction_id
    })
    .select()
    .single();

  if (error) throw error;
  return log;
}

export async function updateMonthlySummary(
  userId: string, 
  month: Date = new Date() // Default to current month if not provided
): Promise<MonthlySummary | null> {
  // First get all transactions for the month
  const startDate = new Date(month.getFullYear(), month.getMonth(), 1);
  const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0);

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (!transactions) return null;

  // Calculate summaries with proper type safety
  const summary = transactions.reduce((acc, t) => ({
    income: acc.income + (t.type === 'income' ? t.amount : 0),
    expenses: acc.expenses + (t.type === 'expense' ? t.amount : 0),
    categories: {
      ...acc.categories,
      [t.category || 'uncategorized']: (acc.categories[t.category || 'uncategorized'] || 0) + t.amount
    }
  }), {
    income: 0,
    expenses: 0,
    categories: {} as Record<string, number>
  });

  // Update or create monthly summary
  const { data: monthlySummary, error } = await supabase
    .from('monthly_summaries')
    .upsert({
      user_id: userId,
      month: startDate,
      total_income: summary.income,
      total_expenses: summary.expenses,
      savings: summary.income - summary.expenses,
      category_breakdown: summary.categories,
      updated_at: new Date()
    })
    .select()
    .single();

  if (error) throw error;
  return monthlySummary;
}

export async function createTransactionRelationship(
  userId: string,
  data: {
    primary_transaction_id: string;
    related_transaction_id: string;
    relationship_type: string;
    metadata?: any;
  }
): Promise<EventRelationship> {
  const { data: relationship, error } = await supabase
    .from('event_relationships')
    .insert({
      user_id: userId,
      primary_event_id: data.primary_transaction_id,
      related_event_id: data.related_transaction_id,
      relationship_type: data.relationship_type,
      metadata: data.metadata
    })
    .select()
    .single();

  if (error) throw error;
  return relationship;
}

export async function getRelatedTransactions(
  userId: string,
  transactionId: string,
  options: {
    limit?: number;
    offset?: number;
    relationship_types?: string[];
  } = {}
) {
  const limit = options.limit || 10;
  const offset = options.offset || 0;
  
  let query = supabase
    .from('event_relationships')
    .select(`
      *,
      primary_transaction:primary_event_id(id, amount, type, description),
      related_transaction:related_event_id(id, amount, type, description)
    `)
    .eq('user_id', userId)
    .or(`primary_event_id.eq.${transactionId},related_event_id.eq.${transactionId}`)
    .range(offset, offset + limit - 1);

  if (options.relationship_types?.length) {
    query = query.in('relationship_type', options.relationship_types);
  }

  // Apply pagination
  if (options.limit) {
    query = query.range(
      options.offset || 0,
      (options.offset || 0) + options.limit - 1
    );
  }

  const { data, error } = await query;

  if (error) throw error;
  return data;
}

export async function getServiceProviderHistory(
  userId: string, 
  providerId: string,
  timeRange: { start: Date; end: Date }
) {
  const cacheKey = `provider_history_${providerId}_${timeRange.start}_${timeRange.end}`;
  const cachedResult = await queryCache.get(cacheKey);
  
  if (cachedResult) return cachedResult;

  const { data } = await supabase
    .from('attendance_logs')
    .select(`
      *,
      transactions:linked_transaction_id(*)
    `)
    .eq('user_id', userId)
    .eq('provider_id', providerId)
    .gte('date', timeRange.start.toISOString())
    .lte('date', timeRange.end.toISOString())
    .order('date', { ascending: false });

  await queryCache.set(cacheKey, data, 60 * 5); // Cache for 5 minutes
  return data;
}

export async function getCategoryAnalytics(
  userId: string,
  category: string,
  timeRange: { start: Date; end: Date }
) {
  const cacheKey = `category_analytics_${category}_${timeRange.start}_${timeRange.end}`;
  const cachedResult = await queryCache.get(cacheKey);

  if (cachedResult) return cachedResult;

  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .eq('category', category)
    .gte('created_at', timeRange.start.toISOString())
    .lte('created_at', timeRange.end.toISOString());

  const analytics = {
    total: transactions?.reduce((sum, t) => sum + t.amount, 0) || 0,
    count: transactions?.length || 0,
    average: transactions?.reduce((sum, t) => sum + t.amount, 0) / (transactions?.length || 1),
    max: Math.max(...(transactions?.map(t => t.amount) || [0])),
    min: Math.min(...(transactions?.map(t => t.amount) || [0]))
  };

  await queryCache.set(cacheKey, analytics, 60 * 15); // Cache for 15 minutes
  return analytics;
}

export async function getRecurringTransactions(userId: string) {
  const cacheKey = `recurring_transactions_${userId}`;
  const cachedResult = await queryCache.get(cacheKey);

  if (cachedResult) return cachedResult;

  const { data } = await supabase.rpc('get_recurring_transactions', {
    p_user_id: userId,
    p_min_occurrences: 2,
    p_max_gap_days: 35  // Monthly transactions
  });

  await queryCache.set(cacheKey, data, 60 * 60); // Cache for 1 hour
  return data;
}