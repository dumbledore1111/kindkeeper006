import { openai } from './openai'
import { SYSTEM_PROMPTS } from './system-prompts'
import type { Context } from '@/types/responses'
import type { WageInfo } from './processors/attendance-processor'
import { PaymentMethod } from '../types/database'

export interface IntentDetectionResponse {
  intent: {
    primary: 'transaction' | 'query' | 'reminder' | 'attendance'
    secondary: string | null
    confidence: number
    requires_clarification: boolean
    missing_fields: string[] | null
  }
  context: {
    temporal: {
      reference_date: string | null
      is_recurring: boolean
      frequency: 'daily' | 'weekly' | 'monthly' | null
    }
    financial: {
      amount: number | null
      currency: 'INR'
      payment_method: string | null
      category: string | null
    }
    service_provider: {
      type: string | null
      name: string | null
      service_type: string | null
    }
  }
  processor: {
    name: 'transaction' | 'query' | 'reminder' | 'attendance'
    priority: number
  }
}

export interface IncompleteTransaction {
  amount?: number
  type?: 'expense' | 'income'
  description?: string
  category?: string
  payment_method?: string
  date?: string
  service_provider?: {
    type?: string
    name?: string
  }
}

export interface IncompleteAttendance {
  provider_type?: string;
  name?: string;
  status?: 'present' | 'absent';
  date?: string;
  wage_info?: {
    amount: number;
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    schedule?: {
      visits_per_week?: number;
      hours_per_visit?: number;
    };
  };
}

export interface TransactionInfo {
  amount?: number;
  description?: string;
  date?: string;
  category?: string;
  payment_method?: PaymentMethod;
}

// Cache for storing incomplete transactions
const transactionCache = new Map<string, IncompleteTransaction>()
const attendanceCache = new Map<string, IncompleteAttendance>()

export class IntentDetector {
  constructor(private userId: string) {}

  private cleanOpenAIResponse(content: string): string {
    // Remove markdown code block formatting if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    return jsonMatch ? jsonMatch[1].trim() : content.trim();
  }

  async detectIntent(input: string, context?: Context): Promise<IntentDetectionResponse> {
    try {
      const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: SYSTEM_PROMPTS.intent_detection },
      ];

      // Add context from previous interaction if available
      if (context?.history?.length) {
        messages.push({ 
          role: 'user', 
          content: `Previous context: ${JSON.stringify(context.history)}`
        });
      }

      // Add current transaction state if exists
      const currentTransaction = this.getIncompleteTransaction(this.userId);
      if (currentTransaction) {
        messages.push({ 
          role: 'user', 
          content: `Current incomplete transaction: ${JSON.stringify(currentTransaction)}`
        });
      }

      // Add current user input
      messages.push({ role: 'user', content: input });

      console.log('Sending to OpenAI with messages:', messages);

      const completion = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages,
        temperature: 0.1,
        max_tokens: 500
      })

      const content = completion.choices[0].message.content || '{}'
      const cleanedContent = this.cleanOpenAIResponse(content)
      console.log('OpenAI response:', cleanedContent);
      const response = JSON.parse(cleanedContent)
      return response as IntentDetectionResponse
    } catch (error) {
      console.error('Intent detection error:', error)
      throw error
    }
  }

  // Store incomplete transaction in cache
  storeIncompleteTransaction(userId: string, transaction: IncompleteTransaction) {
    console.log('Storing transaction in cache:', { userId, transaction });
    transactionCache.set(userId, transaction)
  }

  // Get incomplete transaction from cache
  getIncompleteTransaction(userId: string): IncompleteTransaction | undefined {
    const transaction = transactionCache.get(userId);
    console.log('Retrieved transaction from cache:', { userId, transaction });
    return transaction;
  }

  // Clear transaction from cache
  clearTransaction(userId: string) {
    transactionCache.delete(userId)
  }

  // Check if a transaction is complete
  isTransactionComplete(transaction: IncompleteTransaction): boolean {
    // For regular transactions, only check basic fields
    if (!transaction.service_provider) {
      const isComplete = !!(
        transaction.amount &&
        transaction.description
      );
      console.log('Transaction completion check:', { 
        hasAmount: !!transaction.amount,
        hasDescription: !!transaction.description,
        isComplete
      });
      return isComplete;
    }
    
    // For service provider transactions, require additional fields
    const isComplete = !!(
      transaction.amount &&
      transaction.service_provider.name &&
      transaction.service_provider.type
    );
    console.log('Service provider transaction completion check:', isComplete);
    return isComplete;
  }

  // Update incomplete transaction with new information
  updateTransaction(userId: string, updates: Partial<IncompleteTransaction>) {
    const current = transactionCache.get(userId) || {};
    console.log('Current transaction state:', current);
    console.log('Updating with:', updates);
    
    // Ensure we preserve category if it exists
    if (updates.category) {
      current.category = updates.category;
    }
    
    // For payment method updates, ensure we store it properly
    if (updates.payment_method) {
      current.payment_method = updates.payment_method;
    }
    
    const updated = { ...current, ...updates };
    transactionCache.set(userId, updated);
    console.log('Updated transaction cache:', updated);
    
    return this.isTransactionComplete(updated);
  }

  // Generate clarification question based on missing fields
  generateClarificationQuestion(missingFields: string[] | null): string {
    if (!missingFields || missingFields.length === 0) {
      return 'Could you provide more details?';
    }

    const fieldQuestions: Record<string, string> = {
      amount: 'Could you tell me the amount?',
      payment_method: 'How did you pay for this?',
      description: 'What was this payment for?',
      date: 'When did this transaction occur?',
      category: 'What category would you put this under?',
      'service_provider.name': 'Could you tell me the service provider\'s name?',
      'service_provider.type': 'What type of service provider is this?',
      'time_period': 'Which time period would you like to know about?',
      'wage_info': 'How much do we pay them and how often (daily/weekly/monthly)?',
      'wage_amount': 'How much is their wage?',
      'wage_frequency': 'How often do we pay them (daily/weekly/monthly)?',
      'schedule': 'How often do they come (e.g., once a week, daily)?',
      'hours': 'How many hours per visit?'
    };

    const field = missingFields[0];
    return fieldQuestions[field] || 'Could you provide more details?';
  }

  // Parse wage information from user input
  parseWageInfo(text: string): WageInfo | null {
    const amount = this.extractAmount(text);
    if (!amount) return null;

    let frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'monthly';
    
    // Detect frequency with more variations
    const lowercaseText = text.toLowerCase();
    if (lowercaseText.match(/per\s+day|daily|a\s+day|\/day|each\s+day/)) {
      frequency = 'daily';
    } else if (lowercaseText.match(/per\s+week|weekly|a\s+week|\/week|each\s+week/)) {
      frequency = 'weekly';
    } else if (lowercaseText.match(/per\s+hour|hourly|an?\s+hour|\/hour|each\s+hour/)) {
      frequency = 'hourly';
    }

    // Initialize schedule object
    const schedule: { visits_per_week?: number; hours_per_visit?: number } = {};
    
    // Try to extract schedule information
    const visitsMatch = text.match(/(\d+)\s*(?:time|visit|day)s?\s*(?:per|a|each)?\s*week/i);
    if (visitsMatch) {
      schedule.visits_per_week = parseInt(visitsMatch[1]);
    }
    
    const hoursMatch = text.match(/(\d+)\s*hours?\s*(?:per|a|each)?\s*(?:visit|day|time)/i);
    if (hoursMatch) {
      schedule.hours_per_visit = parseInt(hoursMatch[1]);
    }

    // Return wage info
    return {
      amount,
      frequency,
      schedule
    };
  }

  // Store incomplete attendance in cache
  storeIncompleteAttendance(userId: string, attendance: IncompleteAttendance) {
    attendanceCache.set(userId, attendance)
  }

  // Get incomplete attendance from cache
  getIncompleteAttendance(userId: string): IncompleteAttendance | undefined {
    return attendanceCache.get(userId)
  }

  // Clear attendance from cache
  clearAttendance(userId: string) {
    attendanceCache.delete(userId)
  }

  // Update incomplete attendance with new information
  updateAttendance(userId: string, updates: Partial<IncompleteAttendance>) {
    const current = attendanceCache.get(userId) || {};
    console.log('Current attendance state:', current);
    console.log('Updating with:', updates);
    
    // If we're getting wage info, parse and store it properly
    if (updates.wage_info) {
      if (!current.wage_info) {
        current.wage_info = updates.wage_info;
      } else {
        current.wage_info = {
          ...current.wage_info,
          ...updates.wage_info,
          schedule: {
            ...current.wage_info.schedule,
            ...updates.wage_info.schedule
          }
        };
      }
    }
    
    // If we're getting a name or provider type, update those
    if (updates.name) current.name = updates.name;
    if (updates.provider_type) current.provider_type = updates.provider_type;
    if (updates.status) current.status = updates.status;
    if (updates.date) current.date = updates.date;
    
    const updated = { ...current };
    attendanceCache.set(userId, updated);
    console.log('Updated attendance cache:', updated);
    
    return this.isAttendanceComplete(updated);
  }

  // Generate clarification question based on missing fields
  generateClarificationQuestionForAttendance(missingFields: string[] | null): string {
    if (!missingFields || missingFields.length === 0) {
      return 'What is the name of the maid?';  // Default to asking for name
    }

    const fieldQuestions: Record<string, string> = {
      'provider_name': 'What is their name?',
      'service_provider.type': 'What type of service provider is this (e.g. maid, driver)?',
      'wage_info': 'How much do we pay them and how often (daily/weekly/monthly)?',
      'wage_amount': 'How much is their wage?',
      'wage_frequency': 'How often do we pay them (daily/weekly/monthly)?',
      'schedule': 'How many times per week do they come, and how many hours per visit?',
      'hours': 'How many hours per visit?',
      'visits_per_week': 'How many times per week do they come?'
    };

    // Get the first missing field that has a question
    for (const field of missingFields) {
      const question = fieldQuestions[field];
      if (question) {
        return question;
      }
    }

    // If no matching question found, return a default
    return 'What is their name?';
  }

  // Check if attendance record is complete
  isAttendanceComplete(attendance: IncompleteAttendance): boolean {
    console.log('Checking attendance completion for:', attendance);
    
    // Check for basic required information
    const hasBasicInfo = !!(
      attendance.name &&
      attendance.provider_type &&
      attendance.wage_info?.amount &&
      attendance.wage_info?.frequency
    );

    // Check for schedule information
    const hasSchedule = !!(
      attendance.wage_info?.schedule &&
      typeof attendance.wage_info.schedule.visits_per_week === 'number' &&
      typeof attendance.wage_info.schedule.hours_per_visit === 'number'
    );

    // Check for status (present/absent)
    const hasStatus = !!attendance.status;

    const isComplete = hasBasicInfo && hasSchedule && hasStatus;
    console.log('Attendance completion check:', { 
      hasBasicInfo, 
      hasSchedule, 
      hasStatus, 
      isComplete,
      name: attendance.name,
      provider_type: attendance.provider_type,
      wage_info: attendance.wage_info,
      status: attendance.status
    });
    
    return isComplete;
  }

  private parseTransactionInfo(text: string): TransactionInfo {
    const amount = this.extractAmount(text);
    const description = this.extractDescription(text);
    const date = this.extractDate(text);
    const category = this.extractCategory(text);
    const payment_method = this.extractPaymentMethod(text);

    return {
      amount,
      description,
      date,
      category,
      payment_method
    };
  }

  private extractPaymentMethod(text: string): PaymentMethod | undefined {
    const lowercaseText = text.toLowerCase();
    if (lowercaseText.includes('cash') || lowercaseText.includes('paid in cash')) {
      return 'CASH';
    }
    if (lowercaseText.includes('upi') || lowercaseText.includes('gpay') || lowercaseText.includes('phonepe')) {
      return 'UPI';
    }
    if (lowercaseText.includes('card') || lowercaseText.includes('credit') || lowercaseText.includes('debit')) {
      return 'CARD';
    }
    if (lowercaseText.includes('bank') || lowercaseText.includes('transfer') || lowercaseText.includes('neft') || lowercaseText.includes('rtgs')) {
      return 'BANK_TRANSFER';
    }
    if (lowercaseText.includes('cheque') || lowercaseText.includes('check')) {
      return 'CHEQUE';
    }
    return undefined;
  }

  private extractAmount(text: string): number | undefined {
    const amountMatch = text.match(/(\d+)/);
    return amountMatch ? parseInt(amountMatch[1]) : undefined;
  }

  private extractDescription(text: string): string | undefined {
    // Remove amount and payment method references
    const cleanText = text.replace(/(\d+)/, '').replace(/(cash|upi|card|bank|transfer|cheque|check)/i, '').trim();
    return cleanText || undefined;
  }

  private extractDate(text: string): string | undefined {
    // For now, default to current date
    return new Date().toISOString();
  }

  private extractCategory(text: string): string | undefined {
    const lowercaseText = text.toLowerCase();
    
    // Common expense categories
    const categories: Record<string, string[]> = {
      'groceries': ['groceries', 'grocery', 'vegetables', 'fruits', 'food items'],
      'utilities': ['electricity', 'water', 'gas', 'utility', 'bill', 'phone bill', 'mobile', 'internet', 'wifi', 'broadband', 'cable', 'dish'],
      'transportation': ['auto', 'taxi', 'uber', 'ola', 'petrol', 'diesel', 'fuel'],
      'household': ['maid', 'cleaning', 'repair', 'maintenance'],
      'medical': ['medicine', 'doctor', 'hospital', 'medical'],
      'entertainment': ['movie', 'restaurant', 'dining', 'food'],
      'miscellaneous': ['miscellaneous', 'other', 'misc']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowercaseText.includes(keyword))) {
        return category;
      }
    }

    // Default to miscellaneous if no category matches
    return 'miscellaneous';
  }

  // Parse schedule information from user input
  parseScheduleInfo(input: string): { visits_per_week?: number; hours_per_visit?: number } | null {
    const numberWords: Record<string, number> = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
    };
    
    const scheduleMatch = input.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:times?|days?)\s*(?:a|per)\s*week/i);
    const hoursMatch = input.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*hours?/i);
    
    if (!scheduleMatch && !hoursMatch) return null;

    const schedule: { visits_per_week?: number; hours_per_visit?: number } = {};
    
    if (scheduleMatch) {
      const visits = scheduleMatch[1].toLowerCase();
      schedule.visits_per_week = numberWords[visits] || parseInt(visits);
    }

    if (hoursMatch) {
      const hours = hoursMatch[1].toLowerCase();
      schedule.hours_per_visit = numberWords[hours] || parseInt(hours);
    }

    return schedule;
  }
} 