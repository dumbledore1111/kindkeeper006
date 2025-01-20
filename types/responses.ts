import type { TransactionType, CategoryType } from '@/types/database';
import type { PaymentMethod, ServiceProviderType } from './database'

export type { TransactionType, CategoryType };

export interface ServiceProvider {
  type: 'maid' | 'driver' | 'nurse' | 'gardener' | 'watchman' | 'milkman' | 'physiotherapist';
  name?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  rate?: number;
}

export interface TransactionResponse {
  type: 'expense' | 'income';
  amount: number;
  description: string;
  payment_method?: 'UPI' | 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';
  date?: string;
  service_provider?: ServiceProvider;
  frequency?: 'one_time' | 'daily' | 'weekly' | 'monthly';
  category?: string;
}

export interface AttendanceResponse {
  provider_type: ServiceProviderType;
  name: string;
  status: 'present' | 'absent';
  date: string;
  extra_info?: string;
  payment?: {
    amount: number;
    method?: PaymentMethod;
    paid: boolean;
  };
  wage_info?: {
    amount: number;
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
    schedule?: {
      visits_per_week?: number;
      hours_per_visit?: number;
    };
  };
}

export interface ReminderResponse {
  title: string;
  due_date: string;
  type?: 'bill_payment' | 'medicine' | 'appointment' | 'service_payment' | 'other';
  amount?: number;
  recurring?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
  priority?: 'low' | 'medium' | 'high';
}

export interface QueryResponse {
  type: 'expense_query' | 'income_query' | 'transaction_query' | 'balance_query' | 'complex';
  category?: string;
  time_period?: string;
  provider?: {
    type: ServiceProvider['type'];
    name?: string;
  };
  filter?: 'all' | 'paid' | 'unpaid';
  comparison?: boolean;
  query?: string;
  transaction?: {
    amount?: number;
    type?: 'income' | 'expense';
    description?: string;
  };
}

export interface AIResponse {
  intent: string;
  confidence: number;
  suggestedResponse: string;
  entities?: {
    category?: string;
    amount?: number;
    date?: string;
    type?: string;
  };
  transaction?: TransactionResponse;
  reminder?: ReminderResponse;
  attendance?: AttendanceResponse;
  query?: QueryResponse;
  needsMoreInfo?: {
    field: 'amount' | 'date' | 'provider_name' | 'frequency' | 'description';
    context: string;
  };
}

export interface ProcessingResult {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  type?: string;
  confidence?: number;
  relatedEvents?: any[];
  response?: string;
  intent?: string;
  dbOperations?: Array<{
    table: string;
    operation: string;
    data: Record<string, any>;
  }>;
  context?: Context;
  entities?: {
    category?: string;
    amount?: number;
    date?: string;
    type?: string;
    [key: string]: any;
  };
  needsMoreInfo?: {
    type: string;
    context: string;
  };
}

export type QueryType = 'expense_query' | 'income_query' | 'transaction_query' | 'balance_query' | 'complex';

export interface Context {
  userId: string;
  currentIntent: Intent;
  lastIntent?: string;
  lastQuery?: QueryResponse;
  history: Array<{
    isUser: boolean;
    content: string;
    timestamp: string;
  }>;
  currentTransaction?: Partial<TransactionResponse>;
  currentReminder?: Partial<ReminderResponse>;
  currentAttendance?: Partial<AttendanceResponse>;
  queryResult?: {
    presentDays?: number;
    absentDays?: number;
    amountDue?: number;
    timeRange?: {
      start: Date;
      end: Date;
      description: string;
    };
  };
  recentEvents: any[];
  relatedContexts: any[];
  relatedEvents: any[];
  timeContext: {
    referenceDate: Date;
  };
}

export interface DatabaseOperation {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, any>;
}

export interface RelationshipMap {
  primary: string;
  related: string[];
  type: string;
  strength: number;
}

export interface BatchOperation {
  operation: 'insert' | 'update' | 'delete';
  table: string;
  data?: any;
  conditions?: any;
}

export interface BatchOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}

export interface LinkedOperation {
  transaction: {
    amount: number;
    type: TransactionType;
    description: string;
    category: CategoryType;
  };
  attendance?: {
    provider_id: string;
    date: Date;
    present: boolean;
    notes?: string;
  };
  reminder?: {
    title: string;
    due_date: Date;
    amount?: number;
  };
}

export interface SpendingAnalysis {
  categories: Record<string, {
    total: number;
    count: number;
    average: number;
    highest: number;
    lowest: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  total_spending: number;
  total_income?: number;
  period: {
    start: Date;
    end: Date;
    target?: number;
  };
  target?: number;
  insights: string[];
}

export interface ServiceProviderAnalysis {
  attendanceRate: number;
  paymentPattern: {
    average: number;
    mostCommonDay: string;
    regularityScore: number;
    lastPayment: Date | null;
    amounts?: number[];
    dates?: Date[];
  };
  workPattern: {
    regularDays: string[];
    consistency: number;
    typicalDuration: string;
  };
  recommendations: string[];
}

export interface AnalyticsResult {
  spending?: SpendingAnalysis;
  serviceProvider?: ServiceProviderAnalysis;
  timestamp: Date;
}

export interface Intent {
  type: 'transaction' | 'query' | 'reminder' | 'attendance' | 'unknown';
  confidence: number;
  relatedEvents: string[];
  category?: string;
  timeContext?: {
    referenceDate?: Date;
    period?: string;
  };
}

export interface PatternDetectionResult {
  type: 'service_provider' | 'transaction' | 'attendance';
  confidence: number;
  patterns: {
    frequency?: string;
    amounts?: number[];
    dates?: Date[];
    relationships?: string[];
    regularDays?: string[];
    consistency?: number;
  };
}

export interface ConversationState {
  pendingQuestions: string[];
  confirmedDetails: Map<string, any>;
  previousIntent?: Intent;
  context: Context;
}

export interface EventPattern {
  type: 'transaction' | 'attendance' | 'reminder';
  pattern_data: {
    category?: string;
    average_amount?: number;
    amount_variance?: number;
    time_gaps?: number[];
    time_variance?: number;
  };
  confidence: number;
}

export interface PredictionResult {
  nextMonth: {
    predicted: number;
    confidence: number;
    factors: string[];
  };
  suggestions: string[];
} 