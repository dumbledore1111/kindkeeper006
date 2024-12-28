export interface ApiResponse {
    success: boolean
    error?: string
  }
  
  export interface WhisperResponse extends ApiResponse {
    text: string
  }
  
  export interface ElevenLabsResponse extends ApiResponse {
    audioBuffer?: ArrayBuffer
  }
  
  export interface AssistantResponse extends ApiResponse {
    response: string
    needsMoreInfo?: boolean
    clarification?: {
      type: 'amount' | 'date' | 'name' | 'purpose'
      context: string
    }
    data?: any
  }
  
  // New Additions:
  export interface TransactionData {
    amount: number
    type: 'income' | 'expense'
    description: string
    category?: string
    payment_method?: string
  }
  
  export interface ReminderData {
    title: string
    amount?: number
    description?: string
    due_date: Date
    recurring: boolean
    frequency?: string
  }
  
  export interface ServiceProviderData {
    name?: string
    service_type: string
    attendance?: {
      date: Date
      present: boolean
      notes?: string
    }
  }