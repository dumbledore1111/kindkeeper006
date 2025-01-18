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
  
  export interface ElevenLabsVoiceSettings {
    stability: number;
    similarity_boost: number;
    style?: number;
    speaking_rate?: number;
  }
  
  export interface ElevenLabsRequest {
    text: string;
    responseType?: 'simple' | 'complex' | 'query' | 'error';
    emotion?: 'neutral' | 'concerned' | 'friendly';
  }
  
  export interface ElevenLabsError {
    type: 'api' | 'rate_limit' | 'network' | 'unknown';
    message: string;
    retryAfter?: number;
  }
  
  export interface AssistantResponse extends ApiResponse {
    response: string
    needsMoreInfo?: boolean
    clarification?: {
      type: 'amount' | 'date' | 'name' | 'purpose'
      context: string
    }
    data?: any
    dbOperations?: DatabaseOperationStatus[]
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
  
  export interface WhisperResult {
    text: string;
    language?: string;
    confidence?: number;
    original?: string;
  }
  
  export interface WhisperError {
    type: 'microphone' | 'network' | 'transcription' | 'unknown';
    message: string;
    shouldRetry: boolean;
  }
  
  export interface DatabaseOperationStatus {
    operation: string;
    timestamp: string;
    success: boolean;
    error?: string;
    data?: {
      categoryId?: string;
      suggestionCount?: number;
      messageLength?: number;
      [key: string]: any;  // For any other data we might want to track
    };
  }