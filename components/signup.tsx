'use client'

import { useState } from 'react'
import { AuthButton } from "@/components/ui/auth-button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { signUp } from '@/lib/supabase'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { user, error } = await signUp(email, password, name)
      
      if (error) {
        setError(error)
        return
      }

      if (user) {
        router.push('/dashboard')
      } else {
        setError('Failed to create account')
      }
    } catch (err) {
      setError('Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex items-center justify-center">
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat scale-110"
        style={{
          backgroundImage: 'url("/images/background.jpg")',
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
              Create your account
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
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 rounded-full border-0 
                  bg-white/40 
                  text-white text-xl px-6
                  placeholder:text-white/70
                  shadow-[0_2px_10px_rgba(0,0,0,0.2)]
                  focus:shadow-[0_5px_20px_rgba(255,255,255,0.1)]
                  transition-all duration-300"
              />
            </div>

            <div className="relative group transition-all duration-300">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 rounded-full border-0 
                  bg-white/40 
                  text-white text-xl px-6
                  placeholder:text-white/70
                  shadow-[0_2px_10px_rgba(0,0,0,0.2)]
                  focus:shadow-[0_5px_20px_rgba(255,255,255,0.1)]
                  transition-all duration-300"
              />
            </div>

            <div className="relative group transition-all duration-300">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Choose password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 rounded-full border-0 
                  bg-white/40
                  text-white text-xl px-6 pr-12
                  placeholder:text-white/70
                  shadow-[0_2px_10px_rgba(0,0,0,0.2)]
                  focus:shadow-[0_5px_20px_rgba(255,255,255,0.1)]
                  transition-all duration-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 
                  hover:text-white transition-all duration-300"
              >
                {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
              </button>
            </div>

            <AuthButton 
              type="submit"
              disabled={loading}
              variant="signup"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Sign up'}
            </AuthButton>
          </form>

          <div className="space-y-3 text-center">
            <p className="text-base text-white/80">Already have an account?</p>
            <Link href="/login" className="block w-2/3 mx-auto">
              <AuthButton variant="login">
                Log in
              </AuthButton>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

