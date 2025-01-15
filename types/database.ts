// File: types/database.ts

export type TransactionType = 'income' | 'expense'

export type CategoryType = 
  | 'groceries'
  | 'home_utilities'
  | 'miscellaneous'
  | 'bills'
  | 'online_shopping'
  | 'vehicle'
  | 'medical'
  | 'logbook'

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
  primary_event_id: string;
  primary_event_type: string;
  related_event_id: string;
  related_event_type: string;
  relationship_type: string;
  context?: any;
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
}