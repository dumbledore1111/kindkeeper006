'use client'

import { useState, useEffect } from 'react'
import { AuthButton } from "@/components/ui/auth-button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Loader2, X } from 'lucide-react'
import { sharedStyles } from '@/lib/styles'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState(false)
  const [formErrors, setFormErrors] = useState<{
    email?: string;
    password?: string;
  }>({})
  const router = useRouter()

  // Load saved email if exists
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  const validateForm = () => {
    const errors: { email?: string; password?: string } = {}
    
    if (!email) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address'
    }

    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    setError(null)

    try {
      const { data: { session }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Auth error:', error)
        setError(error.message)
        return
      }

      if (session) {
        console.log('Session created:', session)

        // Store session in localStorage
        localStorage.setItem('supabase.auth.token', session.access_token)
        
        if (rememberMe) {
          localStorage.setItem('savedEmail', email)
        } else {
          localStorage.removeItem('savedEmail')
        }

        // Wait for session to be set
        await new Promise(resolve => setTimeout(resolve, 500))

        // Use window.location for a full page reload
        window.location.href = '/dashboard'
      } else {
        console.error('No session data returned')
        setError('Login successful but no session created')
      }
    } catch (err) {
      console.error('Login error:', err)
      setError('Failed to login')
    } finally {
      setLoading(false)
    }
  }

  const clearForm = () => {
    setEmail('')
    setPassword('')
    setFormErrors({})
    setError(null)
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center">
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat scale-110"
        style={{
          backgroundImage: 'url("https://media.giphy.com/media/Es8b5pCWjqaFy0vBdg/giphy.gif")',
          filter: 'brightness(0.9) contrast(1.1)',
        }}
      />

      <div className="w-[500px] h-[500px] relative z-10 aspect-square p-8 rounded-full 
        bg-black/25 text-white shadow-2xl 
        border border-white/10 backdrop-blur-sm flex items-center justify-center
        hover:shadow-[0_0_60px_rgba(0,0,0,0.3)] transition-all duration-500">
        <div className="w-[90%] space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">
              KindKeeper
            </h1>
            <p className="text-xl text-white/90">
              welcome back !
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-200 p-3 rounded-full text-center text-base backdrop-blur-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative group transition-all duration-300">
              <Input
                type="email"
                placeholder="Current User's email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (formErrors.email) {
                    setFormErrors(prev => ({ ...prev, email: undefined }))
                  }
                }}
                className={`w-full h-12 rounded-full border-0 
                  bg-white/40 
                  text-white text-xl px-6
                  placeholder:text-white/70
                  shadow-[0_2px_10px_rgba(0,0,0,0.2)]
                  focus:shadow-[0_5px_20px_rgba(255,255,255,0.1)]
                  transition-all duration-300
                  ${formErrors.email ? 'ring-2 ring-red-500' : ''}`}
              />
              {formErrors.email && (
                <p className="text-red-200 text-sm mt-1 ml-2">{formErrors.email}</p>
              )}
            </div>

            <div className="relative group transition-all duration-300">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (formErrors.password) {
                    setFormErrors(prev => ({ ...prev, password: undefined }))
                  }
                }}
                className={`w-full h-12 rounded-full border-0 
                  bg-white/40
                  text-white text-xl px-6 pr-12
                  placeholder:text-white/70
                  shadow-[0_2px_10px_rgba(0,0,0,0.2)]
                  focus:shadow-[0_5px_20px_rgba(255,255,255,0.1)]
                  transition-all duration-300
                  ${formErrors.password ? 'ring-2 ring-red-500' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 
                  hover:text-white transition-all duration-300"
              >
                {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
              </button>
              {formErrors.password && (
                <p className="text-red-200 text-sm mt-1 ml-2">{formErrors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  className="bg-white/20 border-white/40 data-[state=checked]:bg-white/60"
                />
                <label htmlFor="remember" className="text-white/90">
                  Remember me
                </label>
              </div>
              <Link 
                href="/forgot-password" 
                className="text-white/90 hover:text-white transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <div className="flex gap-2">
              <AuthButton 
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-white to-green-400 hover:to-green-500
                  shadow-[0_2px_10px_rgba(0,0,0,0.1)]
                  hover:shadow-[0_5px_20px_rgba(0,255,0,0.3)]"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'ON'}
              </AuthButton>
              
              <button
                type="button"
                onClick={clearForm}
                className="p-3 rounded-full bg-white/20 hover:bg-white/30 
                  transition-all duration-300"
                title="Clear form"
              >
                <X size={20} />
              </button>
            </div>
          </form>

          <div className="space-y-3 text-center">
            <p className="text-base text-white/80">Do not have an account! press sign up.</p>
            <Link href="/signup" className="block w-2/3 mx-auto">
              <AuthButton variant="signup">
                sign up
              </AuthButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

