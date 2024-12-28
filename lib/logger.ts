export const logger = {
  auth: (message: string, data?: any) => {
    console.log(`[Auth] ${message}`, data || '')
  },
  error: (message: string, error?: any) => {
    console.error(`[Error] ${message}`, error || '')
  }
} 