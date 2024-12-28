import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

// Create a single supabase client for interacting with your database
const supabase = createClientComponentClient()

export { supabase }

export async function signUp(email: string, password: string, name: string) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    })

    if (error) {
      return {
        user: null,
        error: error.message
      }
    }

    // Create profile entry
    if (data.user) {
      await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          full_name: name,
          email: email
        })
    }

    return {
      user: data.user,
      error: null
    }
  } catch (err) {
    console.error('SignUp error:', err)
    return {
      user: null,
      error: err instanceof Error ? err.message : 'Failed to sign up'
    }
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  console.log('Supabase signIn response:', { data, error })

  if (error) throw error

  // Make sure we're returning the session data
  return {
    data: {
      user: data.user,
      session: data.session
    },
    error: null
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Test function to verify Supabase connection
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.auth.getSession()
    console.log('Supabase Connection Test:', {
      connected: !!supabase,
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      session: data?.session,
      error: error?.message
    })
    return !error
  } catch (err) {
    console.error('Supabase Connection Error:', err)
    return false
  }
} 