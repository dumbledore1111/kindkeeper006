import { useAuth as useSupabaseAuth } from '@/contexts/auth-context'

export function useAuth() {
  return useSupabaseAuth()
} 