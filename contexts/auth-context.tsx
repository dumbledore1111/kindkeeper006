'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export const AuthContext = createContext<{
  session: any;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}>({
  session: null,
  loading: true,
  signOut: async () => {},
  refreshSession: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refreshSession = async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.getSession()
      if (error) throw error
      
      if (currentSession) {
        setSession(currentSession)
        localStorage.setItem('supabase.auth.token', currentSession.access_token)
      } else {
        setSession(null)
        localStorage.removeItem('supabase.auth.token')
        router.push('/login')
      }
    } catch (error) {
      console.error('Error refreshing session:', error)
      setSession(null)
      localStorage.removeItem('supabase.auth.token')
      router.push('/login')
    }
  }

  useEffect(() => {
    // Check active sessions and persist
    supabase.auth.getSession().then(async ({ data: { session: currentSession }, error }) => {
      console.log('Initial session check:', currentSession?.user?.id)
      
      if (error) {
        console.error('Session check error:', error)
        setLoading(false)
        return
      }

      if (currentSession) {
        setSession(currentSession)
        localStorage.setItem('supabase.auth.token', currentSession.access_token)

        try {
          // First try to get existing settings
          const { data: existingSettings, error: fetchError } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', currentSession.user.id)
            .single();

          if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching settings:', fetchError);
            throw fetchError;
          }

          if (!existingSettings) {
            // If no settings exist, create them
            const { error: insertError } = await supabase
              .from('user_settings')
              .insert({ 
                user_id: currentSession.user.id,
                text_size: 'medium',
                volume: 50,
                currency: 'INR',
                language: 'en',
                voice_type: 'female',
                theme: 'light',
                updated_at: new Date().toISOString()
              });

            if (insertError) throw insertError;
          }

          // Verify and create profiles if needed
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentSession.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
            throw profileError;
          }

          if (!profile) {
            const { error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: currentSession.user.id,
                full_name: currentSession.user.user_metadata?.full_name || '',
                updated_at: new Date().toISOString()
              });

            if (insertError) throw insertError;
          }

          // Navigate to dashboard on successful setup
          router.push('/dashboard');
        } catch (error) {
          console.error('Error in session initialization:', error);
          await refreshSession(); // Try to refresh session on error
        }
      }
      setLoading(false);
    });

    // Set up auth subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Auth state changed:', event, currentSession?.user?.id)
      
      if (currentSession) {
        setSession(currentSession)
        localStorage.setItem('supabase.auth.token', currentSession.access_token)
        
        if (event === 'SIGNED_IN') {
          setTimeout(() => {
            router.push('/dashboard');
          }, 100);
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('Token refreshed, updating session');
          setSession(currentSession);
        }
      } else {
        setSession(null)
        localStorage.removeItem('supabase.auth.token')
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setSession(null)
      localStorage.removeItem('supabase.auth.token')
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ session, loading, signOut, refreshSession }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext) 