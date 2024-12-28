// File: lib/transaction-processor.ts

import type { 
  Transaction,
  CategoryType, 
  ServiceProviderType,
  TransactionType,
  PatternType,
  UnitType
} from '@/types/database'
import { parseDateFromText } from './date-parser'
import { WhisperResponse } from '@/types/api'

interface ProcessedInput {
  transaction?: {
    amount: number
    type: TransactionType
    description: string
    payment_method?: string
    source_destination?: string
    is_recurring: boolean
    category?: CategoryType
  }
  service_provider?: {
    name?: string
    service_type: ServiceProviderType
    unit_type?: UnitType
    rate_per_unit?: number
    attendance?: {
      work_date: Date
      present: boolean
      quantity?: number
      notes?: string
    }
  }
  reminder?: {
    title: string
    amount?: number
    description?: string
    due_date: Date
    recurring: boolean
    frequency?: string
  }
  voice_entry?: {
    transcript: string
    amount?: number
    category?: CategoryType
    description?: string
    is_reminder: boolean
    due_date?: Date
  }
  needs_clarification?: {
    type: 'amount' | 'date' | 'name' | 'purpose'
    context: string
  }
}

// Add ServiceProvider interface to match detection function
interface ServiceProvider {
  name?: string
  service_type: ServiceProviderType
  unit_type: UnitType
  needs_attendance?: boolean
  attendance?: {
    work_date: Date
    present: boolean
    quantity?: number
    notes?: string
  }
}

const EXPENSE_KEYWORDS = [
  'paid', 'spent', 'bought', 'purchased', 'gave', 'payment',
  'gpay', 'bill', 'have to give', 'amount', 'price',
  'charged', 'billed', 'cost', 'fees', 'rent'
]

const INCOME_KEYWORDS = [
  'received', 'got', 'credited', 'deposited', 'earned',
  'pension', 'rent', 'dividend', 'interest', 'salary',
  'family sent', 'transferred'
]

const PAYMENT_METHODS = {
  UPI: ['gpay', 'phonepe', 'paytm', 'upi'],
  CASH: ['cash', 'paid by cash', 'in cash', 'money'],
  CARD: ['card', 'credit card', 'debit card'],
  BANK: ['bank', 'neft', 'rtgs', 'imps', 'transfer'],
  CHEQUE: ['cheque', 'check']
}

const CATEGORY_PATTERNS = {
  groceries: [
    'food', 'grocery', 'vegetables', 'fruits', 'milk',
    'meat', 'spices', 'rice', 'dal', 'oil', 'bread',
    'eggs', 'juice', 'snacks', 'water'
  ],
  home_utilities: [
    'broom', 'mop', 'detergent', 'electronics', 'clothes',
    'repair', 'plumber', 'electrician', 'furniture',
    'maintenance', 'cleaning', 'soap', 'supplies'
  ],
  bills: [
    'electricity', 'water bill', 'gas', 'tax',
    'maintenance', 'phone bill', 'mobile', 'internet',
    'cable', 'dish', 'broadband', 'wifi'
  ],
  online_shopping: [
    'amazon', 'flipkart', 'meesho', 'online order',
    'delivered', 'shipping', 'courier', 'myntra'
  ],
  vehicle: [
    'petrol', 'diesel', 'car wash', 'service',
    'vehicle', 'car', 'bike', 'puncture', 'tyre',
    'parking', 'fuel', 'auto', 'taxi', 'uber', 'ola'
  ],
  medical: [
    'doctor', 'hospital', 'pharmacy', 'medicine',
    'physiotherapy', 'massage', 'spa', 'scan',
    'xray', 'lab test', 'clinic', 'health'
  ]
}

const SERVICE_PROVIDER_PATTERNS: Record<ServiceProviderType, {
  keywords: string[]
  unit_type: UnitType
  needs_attendance?: boolean
  needs_quantity?: boolean
}> = {
  maid: {
    keywords: ['maid', 'house help', 'cleaning lady', 'house maid', 'servant'],
    unit_type: 'per_month',
    needs_attendance: true
  },
  driver: {
    keywords: ['driver', 'chauffeur', 'car driver'],
    unit_type: 'per_month',
    needs_attendance: true
  },
  milkman: {
    keywords: ['milkman', 'milk delivery', 'milk man'],
    unit_type: 'per_litre',
    needs_quantity: true
  },
  watchman: {
    keywords: ['watchman', 'security', 'guard', 'security guard'],
    unit_type: 'per_month',
    needs_attendance: true
  },
  gardener: {
    keywords: ['gardener', 'mali', 'garden'],
    unit_type: 'per_month',
    needs_attendance: true
  },
  maintenance: {
    keywords: ['maintenance', 'repair', 'plumber', 'electrician'],
    unit_type: 'per_day',
    needs_attendance: false
  },
  physiotherapist: {
    keywords: ['physiotherapist', 'physio', 'therapy'],
    unit_type: 'per_day',
    needs_attendance: true
  },
  nurse: {
    keywords: ['nurse', 'nursing'],
    unit_type: 'per_day',
    needs_attendance: true
  },
  caregiver: {
    keywords: ['caregiver', 'care taker', 'attendant'],
    unit_type: 'per_day',
    needs_attendance: true
  }
}

const REMINDER_KEYWORDS = [
  'remind', 'reminder', 'remember', 'don\'t forget',
  'notify', 'alert', 'need to pay', 'have to pay',
  'must pay', 'due', 'deadline'
]

export async function processSpeechInput(audioInput: Blob): Promise<WhisperResponse> {
  const formData = new FormData()
  formData.append('file', audioInput)

  const response = await fetch('/api/whisper', {
    method: 'POST',
    body: formData
  })

  if (!response.ok) {
    throw new Error('Speech processing failed')
  }

  return response.json()
}

export function processInput(text: string): ProcessedInput {
  const lowerText = text.toLowerCase()
  
  const amount = extractAmount(lowerText)
  const date = parseDateFromText(lowerText)
  const type = detectTransactionType(lowerText)
  const categories = detectCategories(lowerText)
  const serviceProvider = detectServiceProvider(lowerText)
  const isReminder = detectReminder(lowerText)
  const paymentMethod = detectPaymentMethod(lowerText)

  if (type === 'expense' && !amount) {
    return {
      needs_clarification: {
        type: 'amount',
        context: 'Could you tell me the amount?'
      }
    }
  }

  if (serviceProvider && !serviceProvider.name) {
    return {
      needs_clarification: {
        type: 'name',
        context: `Could you tell me the ${serviceProvider.service_type}'s name?`
      }
    }
  }

  const voiceEntry = {
    transcript: text,
    amount,
    category: categories[0],
    description: text,
    is_reminder: isReminder,
    due_date: isReminder ? date : undefined
  }

  if (serviceProvider && serviceProvider.needs_attendance) {
    const attendance = {
      work_date: date || new Date(),
      present: !lowerText.includes('absent') && !lowerText.includes('leave'),
      quantity: extractQuantity(lowerText),
      notes: text
    }
    serviceProvider.attendance = attendance
  }

  if (isReminder) {
    if (!date) {
      return {
        needs_clarification: {
          type: 'date',
          context: 'When should I remind you?'
        }
      }
    }

    return {
      voice_entry: voiceEntry,
      reminder: {
        title: serviceProvider ? 
          `Pay ${serviceProvider.service_type}${serviceProvider.name ? ` ${serviceProvider.name}` : ''}` : 
          text,
        amount,
        description: text,
        due_date: date,
        recurring: detectRecurring(lowerText),
        frequency: detectFrequency(lowerText)
      },
      service_provider: serviceProvider
    }
  }

  if (amount) {
    return {
      voice_entry: voiceEntry,
      transaction: {
        amount,
        type: type || 'expense',
        description: text,
        payment_method: paymentMethod,
        source_destination: serviceProvider?.name,
        is_recurring: detectRecurring(lowerText),
        category: categories[0]
      },
      service_provider: serviceProvider
    }
  }

  return {
    needs_clarification: {
      type: 'purpose',
      context: 'Could you please repeat that?'
    }
  }
}

function extractAmount(text: string): number | undefined {
  const patterns = [
    /(?:₹|rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i,
    /(\d+(?:,\d+)*(?:\.\d{2})?)\s*(?:₹|rs\.?|rupees?)/i,
    /(\d+(?:,\d+)*(?:\.\d{2})?)/
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const amount = match[1].replace(/,/g, '')
      return parseFloat(amount)
    }
  }

  return undefined
}

function detectTransactionType(text: string): TransactionType | undefined {
  if (EXPENSE_KEYWORDS.some(keyword => text.includes(keyword))) {
    return 'expense'
  }
  if (INCOME_KEYWORDS.some(keyword => text.includes(keyword))) {
    return 'income'
  }
  return undefined
}

function detectCategories(text: string): CategoryType[] {
  const categories = new Set<CategoryType>()
  
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    if (patterns.some(pattern => text.includes(pattern))) {
      categories.add(category as CategoryType)
    }
  }

  if (detectServiceProvider(text)) {
    categories.add('logbook')
  }

  return categories.size > 0 ? Array.from(categories) : ['miscellaneous']
}

function detectServiceProvider(text: string): ServiceProvider | undefined {
  for (const [type, config] of Object.entries(SERVICE_PROVIDER_PATTERNS)) {
    const matchedKeyword = config.keywords.find(k => text.includes(k))
    if (matchedKeyword) {
      const namePattern = new RegExp(`${matchedKeyword}\\s+([\\w\\s]+)(?:\\s|$)`, 'i')
      const nameMatch = text.match(namePattern)
      
      return {
        service_type: type as ServiceProviderType,
        name: nameMatch ? nameMatch[1].trim() : undefined,
        unit_type: config.unit_type,
        needs_attendance: config.needs_attendance
      }
    }
  }
  return undefined
}

function detectPaymentMethod(text: string): string | undefined {
  for (const [method, patterns] of Object.entries(PAYMENT_METHODS)) {
    if (patterns.some(pattern => text.includes(pattern))) {
      return method
    }
  }
  return 'CASH'
}

function detectReminder(text: string): boolean {
  return REMINDER_KEYWORDS.some(keyword => text.includes(keyword))
}

function extractQuantity(text: string): number | undefined {
  const match = text.match(/(\d+)\s*(?:litre|liter|l)/i)
  return match ? parseInt(match[1]) : undefined
}

function detectRecurring(text: string): boolean {
  const recurringPatterns = [
    'monthly', 'every month', 'per month',
    'weekly', 'every week', 'per week',
    'daily', 'every day', 'per day'
  ]
  return recurringPatterns.some(pattern => text.includes(pattern))
}

function detectFrequency(text: string): string | undefined {
  if (text.includes('month')) return 'monthly'
  if (text.includes('week')) return 'weekly'
  if (text.includes('day')) return 'daily'
  return undefined
}

// Add extractDate function to match the export
function extractDate(text: string): Date {
  return parseDateFromText(text)
}

export function isSimpleTransaction(text: string): boolean {
  return [
    /paid.*(\d+)/i,
    /spent.*(\d+)/i,
    /got.*(\d+)/i,
    /received.*(\d+)/i,
    /bill.*(\d+)/i
  ].some(pattern => pattern.test(text))
}

function detectLanguage(text: string): string {
  const hindiRegex = /[\u0900-\u097F]/
  const marathiRegex = /[\u0900-\u097F].*\b(आणि|किंवा)\b/
  const gujaratiRegex = /[\u0A80-\u0AFF]/
  const englishRegex = /[a-zA-Z]/

  if (marathiRegex.test(text)) return 'mr'
  if (gujaratiRegex.test(text)) return 'gu'
  if (hindiRegex.test(text)) return 'hi'
  if (englishRegex.test(text)) return 'en'
  return 'unknown'
}

function calculateConfidence(matchedKeywords: number, totalKeywords: number): number {
  const baseConfidence = (matchedKeywords / totalKeywords) * 100
  return Math.min(Math.max(baseConfidence, 20), 100)
}

export {
  extractAmount,
  detectTransactionType,
  detectCategories,
  detectServiceProvider,
  detectPaymentMethod,
  detectReminder,
  extractDate,
  detectLanguage,
  calculateConfidence
};