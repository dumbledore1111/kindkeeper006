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
}

export type PatternType = 'TRANSACTION' | 'REMINDER' | 'QUERY' | 'COMPLEX'