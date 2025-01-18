// File: types/database.ts

export type TransactionType = 'expense' | 'income';

export type CategoryType = 
  | 'groceries'
  | 'bills'
  | 'medical'
  | 'vehicle'
  | 'online_shopping'
  | 'home_utilities'
  | 'logbook'
  | 'miscellaneous';

export type ServiceProviderType = 
  | 'maid'
  | 'driver'
  | 'milkman'
  | 'watchman'
  | 'gardener'
  | 'maintenance'
  | 'physiotherapist'
  | 'nurse'
  | 'caregiver'

export type UnitType = 
  | 'per_day'
  | 'per_month'
  | 'per_litre'

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          currency?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          description?: string
          type: TransactionType
          source_destination?: string
          created_at: string
          is_recurring: boolean
          payment_method?: string
          category?: CategoryType
        }
        Insert: {
          user_id: string
          amount: number
          description?: string
          type: TransactionType
          source_destination?: string
          created_at?: string
          is_recurring?: boolean
          payment_method?: string
          category?: CategoryType
        }
        Update: {
          amount?: number
          description?: string
          type?: TransactionType
          source_destination?: string
          is_recurring?: boolean
          payment_method?: string
        }
      }
      transaction_categories: {
        Row: {
          id: string
          transaction_id: string
          category: CategoryType
          created_at: string
        }
        Insert: {
          transaction_id: string
          category: CategoryType
          created_at?: string
        }
        Update: {
          category?: CategoryType
        }
      }
    }
  }
}

export type ServiceProvider = {
  id: string
  user_id: string
  name: string
  service_type: ServiceProviderType
  salary?: number
  payment_frequency?: string
  rate_per_unit?: number
  created_at: string
  updated_at: string
}

export type VoiceEntry = {
  id: string
  user_id: string
  transcript: string
  amount?: number
  category?: string
  description?: string
  is_reminder: boolean
  due_date?: Date
  date: Date
  created_at: string
  updated_at: string
}

export type Transaction = {
  id: string
  user_id: string
  amount: number
  description?: string
  type: TransactionType
  source_destination?: string
  created_at: string
  is_recurring: boolean
  payment_method?: string
  category?: CategoryType 
}

export type PatternType = 'TRANSACTION' | 'REMINDER' | 'QUERY' | 'COMPLEX'

export type IntentType = 
  | 'transaction' 
  | 'query' 
  | 'reminder' 
  | 'category_creation' 
  | 'attendance' 
  | 'unknown';

export interface Intent {
  type: IntentType;
  confidence: number;
  category?: CategoryType;
  action?: string;
  relatedEvents: string[];
  transactionData?: {
    amount: number;
    type: TransactionType;
    description: string;
    category?: CategoryType;
  };
}

export interface ContextLog {
  id: string;
  user_id: string;
  context_type: string;
  context_data: any;
  valid_from: Date;
  valid_until?: Date;
  created_at: Date;
}

export interface EventRelationship {
  id: string;
  user_id: string;
  primary_event_id: string;
  related_event_id: string;
  relationship_type: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface Context {
  userId: string;
  currentIntent: Intent;
  recentEvents: any[];
  relatedContexts: ContextLog[];
  userPreferences?: any;
  timeContext?: {
    referenceDate: Date;
    period?: string;
  };
  relatedEvents: string[];
  analytics?: {
    total: number;
    count: number;
    average: number;
    highest: number;
    lowest: number;
  };
  amount?: number;
}

export interface FormattedResponse {
  text: string;
  data?: any;
  suggestions?: string[];
  followUp?: string;
}

export interface ValidationResult {
  needsMoreInfo: boolean;
  missingInfo: string[];
}

export interface ProcessingResult {
  intent: Intent;
  context: Context;
  needsMoreInfo: boolean;
  suggestedResponse?: string;
}

export interface AttendanceLog {
  id: string;
  user_id: string;
  provider_id: string;
  date: Date;
  present: boolean;
  notes?: string;
  linked_transaction_id?: string;
  created_at: Date;
}

export interface StructuredContext {
  recentTransactions: Transaction[];
  patterns: {
    recurring: any[];
    related: any[];
    sequential: any[];
  };
  relationships: EventRelationship[];
  userPreferences: any;
  historicalQueries: {
    query: string;
    response: string;
    timestamp: Date;
  }[];
}

export interface DatabaseOperationStatus {
  success: boolean;
  operation: string;
  timestamp: string;
  error?: any;
  data?: any;
  userId?: string;
}

export interface MonthlySummary {
  id: string;
  user_id: string;
  month: Date;
  total_income: number;
  total_expenses: number;
  savings: number;
  category_breakdown: Record<string, number>;
  created_at: Date;
  updated_at: Date;
}

export interface TransactionData {
  amount: number;
  type: 'expense' | 'income';
  is_recurring: boolean;
  description: string;
  source_destination?: string;
  payment_method?: string;
  category?: CategoryType;
  service_provider?: ServiceProvider;
}

export interface VoiceEntryData {
  transcript: string;
  amount: number;
  category?: string;
  description: string;
  is_reminder: boolean;
  date: Date;
  due_date?: Date;
}

export interface UserContext {
  userId: string;
} 