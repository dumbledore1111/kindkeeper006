import type { Transaction, CategoryType } from '@/types/database'
import { ProcessorManager } from './processors/processor-manager'
import { ContextEngine } from './context-engine'
import { determineIntent } from './intent-analyzer'
import { AIResponse } from '@/types/responses'

interface ServiceProviderDetails {
  name?: string
  service_type: string
  payment_frequency?: 'daily' | 'monthly'
  rate?: number
}

interface ProcessedInput {
  userResponse: string
  dbOperations: DbOperation[]
  needsMoreInfo?: {
    type: 'amount' | 'provider_name' | 'date' | 'frequency' | 'payment_method'
    context: string
  }
}

interface DbOperation {
  table: 'transactions' | 'transaction_categories' | 'attendance_logs' | 'reminders' | 'monthly_summaries'
  operation: 'insert' | 'update' | 'delete'
  data: Record<string, any>
}

const EXPENSE_KEYWORDS = [
  'paid', 'spent', 'bought', 'purchased', 'gave', 'payment',
  'gpay to', 'bill for', 'have to give', 'amount', 
  'price was', 'charged', 'billed'
]

const INCOME_KEYWORDS = [
  'received', 'got', 'credited', 'deposited', 'earned',
  'pension', 'rent', 'dividend', 'interest', 'family sent'
]

const PAYMENT_METHODS = {
  UPI: ['gpay', 'phonepe', 'paytm', 'upi'],
  CASH: ['cash', 'paid by cash', 'in cash'],
  CARD: ['card', 'credit card', 'debit card'],
  BANK_TRANSFER: ['bank', 'neft', 'rtgs', 'imps', 'transferred'],
  CHEQUE: ['cheque', 'check']
}

const CATEGORY_RULES = {
  GROCERIES: [
    'food', 'drink', 'grocery', 'vegetables', 'fruits', 'milk',
    'meat', 'spices', 'pet food', 'supplements', 'rice', 'dal'
  ],
  HOME_UTILITIES: [
    'broom', 'mop', 'detergent', 'electronics', 'clothes',
    'furniture', 'appliances', 'repair', 'plumber', 'electrician'
  ],
  BILLS: [
    'electricity', 'water bill', 'gas', 'property tax',
    'maintenance', 'phone bill', 'mobile bill', 'internet'
  ],
  ONLINE_SHOPPING: [
    'amazon', 'flipkart', 'meesho', 'online order', 'delivered'
  ],
  VEHICLE: [
    'petrol', 'diesel', 'car wash', 'service', 'repair',
    'vehicle', 'car', 'bike', 'puncture', 'tyre'
  ],
  MEDICAL: [
    'doctor', 'hospital', 'pharmacy', 'medicine', 'physiotherapy',
    'massage', 'spa', 'scan', 'xray', 'lab test', 'clinic'
  ]
}

const SERVICE_PROVIDER_RULES = {
  maid: {
    keywords: ['maid', 'house help', 'cleaning lady', 'house maid'],
    payment_frequency: 'monthly' as const
  },
  driver: {
    keywords: ['driver', 'chauffeur'],
    payment_frequency: 'monthly' as const
  },
  milkman: {
    keywords: ['milkman', 'milk delivery'],
    payment_frequency: 'monthly' as const,
    needs_quantity: true
  },
  watchman: {
    keywords: ['watchman', 'security', 'guard'],
    payment_frequency: 'monthly' as const
  },
  gardener: {
    keywords: ['gardener', 'mali', 'garden'],
    payment_frequency: 'monthly' as const
  },
  physiotherapist: {
    keywords: ['physiotherapist', 'physio'],
    payment_frequency: 'daily' as const
  },
  nurse: {
    keywords: ['nurse', 'caregiver', 'care taker'],
    payment_frequency: 'daily' as const
  }
}

function detectTransactionType(input: string): 'income' | 'expense' | undefined {
  if (EXPENSE_KEYWORDS.some(keyword => input.includes(keyword))) {
    return 'expense'
  }
  if (INCOME_KEYWORDS.some(keyword => input.includes(keyword))) {
    return 'income'
  }
  return undefined
}

function detectCategories(input: string): CategoryType[] {
  const categories = new Set<CategoryType>()
  
  for (const [category, keywords] of Object.entries(CATEGORY_RULES)) {
    if (keywords.some(keyword => input.includes(keyword))) {
      categories.add(category as CategoryType)
    }
  }

  // Add LOGBOOK category for service provider transactions
  if (detectServiceProvider(input)) {
    categories.add('logbook')
  }

  return categories.size > 0 ? Array.from(categories) : ['miscellaneous']
}

function detectPaymentMethod(input: string): string | undefined {
  for (const [method, keywords] of Object.entries(PAYMENT_METHODS)) {
    if (keywords.some(keyword => input.includes(keyword))) {
      return method
    }
  }
  return 'CASH' // Default to cash if not specified
}

function detectServiceProvider(input: string): ServiceProviderDetails | undefined {
  for (const [type, rules] of Object.entries(SERVICE_PROVIDER_RULES)) {
    if (rules.keywords.some(keyword => input.includes(keyword))) {
      // Try to extract name that comes after the keyword
      const matchedKeyword = rules.keywords.find(k => input.includes(k))
      const nameMatch = matchedKeyword && 
        input.match(new RegExp(`${matchedKeyword}\\s+([\\w\\s]+)(?:\\s|$)`, 'i'))
      
      return {
        service_type: type,
        name: nameMatch ? nameMatch[1].trim() : undefined,
        payment_frequency: rules.payment_frequency
      }
    }
  }
  return undefined
}

function detectReminder(input: string): boolean {
  const reminderKeywords = ['remind', 'reminder', 'remember', 'don\'t forget', 'notify']
  return reminderKeywords.some(keyword => input.includes(keyword))
}

function extractAmount(input: string): number | null {
  // Match amounts with or without currency symbols and commas
  const amountMatch = input.match(/(?:rs\.?|₹)?\s*(\d+(?:,\d+)*(?:\.\d{2})?)\s*(?:rupees|rs\.?|₹)?/i)
  if (amountMatch) {
    const amount = amountMatch[1]
    return parseFloat(amount.replace(/,/g, ''))
  }
  return null
}

function extractDate(input: string): Date | undefined {
  // Add sophisticated date extraction logic here
  // For now, returning current date
  return new Date()
}

export async function processUserInput(input: string, userId: string) {
  const processorManager = new ProcessorManager(userId)
  const contextEngine = new ContextEngine(userId)
  
  // Get context
  const context = await contextEngine.getCurrentContext()
  
  // Process with existing logic first
  const processed = processInputInternal(input)
  
  // Then route through processor manager if needed
  const intent = determineIntent(input, context)
  const processorResult = await processorManager.route(intent, {
    input,
    context,
    processed
  })
  
  return processorResult
}

function processInputInternal(input: string): ProcessedInput {
  const lowerInput = input.toLowerCase()
  const amount = extractAmount(input)
  const type = detectTransactionType(lowerInput)
  const categories = detectCategories(lowerInput)
  const paymentMethod = detectPaymentMethod(lowerInput)
  const serviceProvider = detectServiceProvider(lowerInput)
  const isReminder = detectReminder(lowerInput)
  const date = extractDate(input)

  // Handle missing amount
  if (!amount && !isReminder) {
    return {
      userResponse: "Could you please specify the amount?",
      dbOperations: [],
      needsMoreInfo: {
        type: 'amount',
        context: 'Please specify the amount'
      }
    }
  }

  // Handle service provider with missing name
  if (serviceProvider && !serviceProvider.name) {
    return {
      userResponse: `Could you please specify the ${serviceProvider.service_type}'s name?`,
      dbOperations: [],
      needsMoreInfo: {
        type: 'provider_name',
        context: `Need ${serviceProvider.service_type}'s name`
      }
    }
  }

  // Handle missing payment method for transactions
  if (amount && !paymentMethod) {
    return {
      userResponse: "How did you pay for this?",
      dbOperations: [],
      needsMoreInfo: {
        type: 'payment_method',
        context: 'Please specify how you paid (cash, card, UPI, etc.)'
      }
    }
  }

  const dbOperations: DbOperation[] = []

  // Handle service provider attendance
  if (serviceProvider && serviceProvider.name) {
    dbOperations.push({
      table: 'attendance_logs',
      operation: 'insert',
      data: {
        provider_id: `<${serviceProvider.name}_id>`, // This would be resolved by the API
        date: date,
        present: !input.includes('absent') && !input.includes('leave'),
        notes: input
      }
    })
  }

  // Handle transaction if amount exists
  if (amount) {
    dbOperations.push({
      table: 'transactions',
      operation: 'insert',
      data: {
        amount,
        type: type || 'expense',
        description: input,
        payment_method: paymentMethod,
        source_destination: serviceProvider?.name,
        is_recurring: isReminder,
        created_at: date
      }
    })

    // Add categories
    categories.forEach(category => {
      dbOperations.push({
        table: 'transaction_categories',
        operation: 'insert',
        data: { category }
      })
    })
  }

  // Handle reminder
  if (isReminder) {
    dbOperations.push({
      table: 'reminders',
      operation: 'insert',
      data: {
        title: serviceProvider ? `Pay ${serviceProvider.service_type}` : input,
        amount,
        description: input,
        due_date: date,
        recurring: input.includes('monthly') || input.includes('every'),
        status: 'PENDING'
      }
    })
  }

  // Format user response
  const userResponse = formatUserResponse(amount, type, categories, serviceProvider, isReminder)

  return {
    userResponse,
    dbOperations
  }
}

function formatUserResponse(
  amount: number | null,
  type: 'income' | 'expense' | undefined,
  categories: CategoryType[],
  serviceProvider?: ServiceProviderDetails,
  isReminder?: boolean
): string {
  const parts: string[] = []

  if (amount) {
    parts.push(`Recorded ${type || 'expense'} of ₹${amount.toLocaleString('en-IN')}`)
    if (categories.length > 0) {
      parts.push(`in ${categories.join(', ')}`)
    }
  }

  if (serviceProvider) {
    parts.push(`for ${serviceProvider.service_type}${serviceProvider.name ? ` ${serviceProvider.name}` : ''}`)
  }

  if (isReminder) {
    parts.push('and set a reminder')
  }

  parts.push('Anything else?')

  return parts.join(' ')
}

export const processAIMessage = async (userId: string, input: string): Promise<string | AIResponse> => {
  try {
    const contextEngine = new ContextEngine(userId);
    
    // Process input directly since processInput handles intent detection internally
    const result = await contextEngine.processInput(input);

    // Return either string response or AIResponse
    if (typeof result.response === 'string') {
      return result.response;
    }

    return {
      intent: result.intent as 'transaction' | 'attendance' | 'reminder' | 'query' | 'general',
      confidence: 0.8,
      suggestedResponse: result.response,
      needsMoreInfo: result.needsMoreInfo ? {
        field: result.needsMoreInfo.type as 'amount' | 'date' | 'provider_name' | 'frequency' | 'description',
        context: result.needsMoreInfo.context
      } : undefined
    };

  } catch (error) {
    console.error('Error processing AI message:', error);
    return 'I apologize, but I encountered an error processing your request.';
  }
}; 