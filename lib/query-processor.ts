import { supabase } from '@/lib/supabase'
import type { Transaction, CategoryType } from '@/types/database'
import { processChatCompletion, processAssistantMessage } from '@/lib/openai'

interface QueryResult {
  data: any[]
  summary: {
    total?: number
    count?: number
    timeFrame: string
    category?: CategoryType
  }
  type: 'spending' | 'listing' | 'summary'
}

const systemPrompt = `You are a financial assistant for senior citizens in India.
Extract transaction details from their natural speech.

Examples:
Input: "gave the maid two thousand yesterday"
Output: {
  "transaction": {
    "amount": 2000,
    "type": "expense",
    "description": "maid payment",
    "service_provider": {
      "type": "maid",
      "frequency": "monthly"
    }
  }
}

Input: "got my pension today fifteen thousand rupees"
Output: {
  "transaction": {
    "amount": 15000,
    "type": "income",
    "description": "pension payment",
    "category": "INCOME"
  }
}
`

export async function handleComplexQuery(query: string, userId: string) {
  // Simple queries use Chat Completion
  if (isSimpleQuery(query)) {
    return processChatCompletion(query)
  }
  
  // Complex analysis uses Assistant
  return processAssistantMessage(userId, query)
}

function isSimpleQuery(query: string): boolean {
  const simplePatterns = [
    'how much',
    'show me',
    'list',
    'total'
  ]
  return simplePatterns.some(pattern => 
    query.toLowerCase().includes(pattern)
  )
}

async function handleSpendingQuery(query: string, userId: string): Promise<QueryResult> {
  const timeFrame = extractTimeFrame(query)
  const category = extractCategory(query)
  const { startDate, endDate } = getDateRange(timeFrame)

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      amount,
      transaction_categories!inner(category)
    `)
    .eq('user_id', userId)
    .eq('transaction_categories.category', category)
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (error) throw error

  const total = data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0

  return {
    data,
    summary: {
      total,
      timeFrame: timeFrame,
      category
    },
    type: 'spending'
  }
}

async function handleListingQuery(query: string, userId: string): Promise<QueryResult> {
  const timeFrame = extractTimeFrame(query)
  const { startDate, endDate } = getDateRange(timeFrame)

  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      transaction_categories(category)
    `)
    .eq('user_id', userId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) throw error

  return {
    data,
    summary: {
      count: data.length,
      timeFrame
    },
    type: 'listing'
  }
}

async function handleSummaryQuery(query: string, userId: string): Promise<QueryResult> {
  const timeFrame = extractTimeFrame(query)
  const { startDate, endDate } = getDateRange(timeFrame)

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate)
    .lte('created_at', endDate)

  if (error) throw error

  const total = data.reduce((sum, t) => sum + t.amount, 0)

  return {
    data,
    summary: {
      total,
      count: data.length,
      timeFrame
    },
    type: 'summary'
  }
}

function extractTimeFrame(query: string): string {
  const timeFrames = {
    'this month': /this month/i,
    'last month': /last month/i,
    'this year': /this year/i,
    'last year': /last year/i,
    'today': /today/i,
    'yesterday': /yesterday/i,
    'this week': /this week/i,
    'last week': /last week/i
  }

  for (const [frame, regex] of Object.entries(timeFrames)) {
    if (regex.test(query)) return frame
  }
  
  return 'this month' // default
}

function extractCategory(query: string): CategoryType {
  const categoryMap: Record<string, CategoryType> = {
    'grocery': 'GROCERIES',
    'groceries': 'GROCERIES',
    'bill': 'BILLS',
    'bills': 'BILLS',
    'medical': 'MEDICAL',
    'medicine': 'MEDICAL',
    'vehicle': 'VEHICLE',
    'car': 'VEHICLE',
    'shopping': 'ONLINE_SHOPPING',
    'utilities': 'HOME_UTILITIES'
  }

  for (const [keyword, category] of Object.entries(categoryMap)) {
    if (query.includes(keyword)) return category
  }

  return 'MISCELLANEOUS'
}

function getDateRange(timeFrame: string): { startDate: Date; endDate: Date } {
  const now = new Date()
  const startDate = new Date()
  const endDate = new Date()

  switch (timeFrame) {
    case 'this month':
      startDate.setDate(1)
      endDate.setMonth(now.getMonth() + 1, 0)
      break
    case 'last month':
      startDate.setMonth(now.getMonth() - 1, 1)
      endDate.setDate(0)
      break
    // Add other cases as needed
  }

  return { startDate, endDate }
} 