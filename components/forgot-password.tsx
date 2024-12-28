'use client'

import { useState } from 'react'
import { AuthButton } from "@/components/ui/auth-button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { Loader2, ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formErrors, setFormErrors] = useState<{ email?: string }>({})
  const router = useRouter()

  const validateForm = () => {
    const errors: { email?: string } = {}
    
    if (!email) {
      errors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = 'Please enter a valid email address'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
        return
      }

      setSuccess(true)
    } catch (err) {
      setError('Failed to send reset email')
    } finally {
      setLoading(false)
    }
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
              Reset Password
            </h1>
            <p className="text-xl text-white/90">
              Enter your email to reset
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-200 p-3 rounded-full text-center text-base backdrop-blur-sm">
              {error}
            </div>
          )}

          {success ? (
            <div className="space-y-4">
              <div className="bg-green-500/20 text-green-200 p-3 rounded-full text-center text-base backdrop-blur-sm">
                Check your email for reset instructions
              </div>
              <Link href="/login" className="block w-2/3 mx-auto">
                <AuthButton variant="login">
                  Return to Login
                </AuthButton>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group transition-all duration-300">
                <Input
                  type="email"
                  placeholder="Your email address"
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

              <div className="flex gap-2">
                <AuthButton 
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Send Reset Link'}
                </AuthButton>
              </div>
            </form>
          )}

          <div className="space-y-3 text-center">
            <Link 
              href="/login" 
              className="inline-flex items-center text-white/90 hover:text-white transition-colors gap-1"
            >
              <ArrowLeft size={16} />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
} 