import type { Context } from '@/types/responses'

export function determineIntent(input: string, context?: Context): string {
  const lowerInput = input.toLowerCase()
  
  if (lowerInput.includes('remind') || lowerInput.includes('reminder')) {
    return 'reminder'
  }
  
  if (lowerInput.includes('attendance') || lowerInput.includes('present')) {
    return 'attendance'
  }
  
  if (lowerInput.includes('how much') || lowerInput.includes('spent on')) {
    return 'query'
  }
  
  return 'transaction'
} 