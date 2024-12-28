import type { Transaction, Reminder, QueryResult } from '@/types/database'

export function generateDetailedResponse(data: {
  transaction?: Partial<Transaction>
  reminder?: Reminder
  query?: QueryResult
  summary?: any
  suggestAction?: 'confirm_payment' | undefined
}): string {
  if (data.query) {
    return generateQueryResponse(data.query)
  }
  if (data.transaction) {
    return generateTransactionResponse(data.transaction)
  }
  if (data.reminder) {
    return generateReminderResponse(data.reminder)
  }
  return generateSummaryResponse(data.summary)
}

function generateQueryResponse(query: QueryResult): string {
  const formatAmount = (amount: number) => 
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount)

  switch (query.type) {
    case 'spending':
      return `You spent ${formatAmount(query.summary.total || 0)} on ${
        query.summary.category?.toLowerCase() || 'items'
      } ${query.summary.timeFrame}.`
    
    case 'listing':
      return `Here are your transactions for ${query.summary.timeFrame}:\n${
        query.data.map(t => 
          `- ${formatAmount(t.amount)} for ${t.description}`
        ).join('\n')
      }`
    
    default:
      return 'I found some transactions matching your query.'
  }
}

function generateTransactionResponse(transaction: Partial<Transaction>): string {
  const amount = `₹${transaction.amount}`
  
  if (transaction.type === 'expense') {
    return `Paid: ${amount} for ${transaction.description}`
  }
  
  return `Got: ${amount} from ${transaction.description}`
}

function generateReminderResponse(reminder: Partial<Reminder>): string {
  const date = new Date(reminder.due_date!).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric'
  })
  
  return `Reminder: ${reminder.amount ? `₹${reminder.amount}` : ''} ${reminder.title} on ${date}`
}

function generateSummaryResponse(summary: any): string {
  // Implement based on your summary structure
  return 'Here\'s your summary...'
} 