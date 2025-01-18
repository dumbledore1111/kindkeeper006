import type { 
  TransactionResponse, 
  ReminderResponse, 
  QueryResponse 
} from '@/types/responses';

interface QueryResult {
  type: 'spending' | 'listing' | 'summary';
  data: any[];
  summary: {
    total?: number;
    timeFrame: string;
    category?: string;
  };
}

export function generateDetailedResponse(data: {
  transaction?: Partial<TransactionResponse>
  reminder?: ReminderResponse
  query?: QueryResult
  summary?: any
  suggestAction?: 'confirm_payment' | undefined
}): string {
  if (data.query) {
    return generateQueryResponse({ 
      query: data.query as unknown as QueryResponse, 
      result: data.query.data 
    });
  }
  if (data.transaction) {
    return generateTransactionResponse(data.transaction);
  }
  if (data.reminder) {
    return generateReminderResponse(data.reminder);
  }
  return generateSummaryResponse(data.summary);
}

export function generateQueryResponse({ query, result }: {
  query: QueryResponse;
  result: any;
}): string {
  const formatAmount = (amount: number) => 
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);

  switch (query.type) {
    case 'expense_query':
      return `You spent ${formatAmount(result.total || 0)} on ${
        query.category?.toLowerCase() || 'items'
      } ${query.time_period || 'recently'}.`;
    
    case 'transaction_query':
      return `Here are your transactions${query.time_period ? ` for ${query.time_period}` : ''}:\n${
        result.map((t: TransactionResponse) => 
          `- ${formatAmount(t.amount)} for ${t.description}`
        ).join('\n')
      }`;
    
    default:
      return 'I found some transactions matching your query.';
  }
}

function generateTransactionResponse(transaction: Partial<TransactionResponse>): string {
  const amount = `₹${transaction.amount}`;
  
  if (transaction.type === 'expense') {
    return `Paid: ${amount} for ${transaction.description}`;
  }
  
  return `Got: ${amount} from ${transaction.description}`;
}

function generateReminderResponse(reminder: Partial<ReminderResponse>): string {
  const date = new Date(reminder.due_date!).toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric'
  });
  
  return `Reminder: ${reminder.amount ? `₹${reminder.amount}` : ''} ${reminder.title} on ${date}`;
}

function generateSummaryResponse(summary: any): string {
  // Implement based on your summary structure
  return 'Here\'s your summary...';
} 