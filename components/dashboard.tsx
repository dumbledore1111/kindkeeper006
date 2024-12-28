'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ThemeButton } from './ui/theme-button'
import { ThemeCard } from './ui/theme-card'
import { AccountPanel } from './account-panel'
import { BookPanel } from './book-panel'
import { ChatPanel } from './chat-panel'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/contexts/SettingsContext'

export type AppSettings = {
  textSize: 'small' | 'medium' | 'large'
  volume: number
  currency: string
  language: string
  voiceType: string
  theme: 'light' | 'dark'
}

export default function Dashboard() {
  const router = useRouter()
  const [showAccount, setShowAccount] = useState(false)
  const [showBook, setShowBook] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const { settings } = useSettings()

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: settings, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (settings) {
          setAppSettings(settings)
        }
      } catch (error) {
        console.error('Error:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [router])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center 
      transition-colors duration-300
      dark:bg-dark-background bg-light-background 
      dark:text-dark-text text-light-text">
      <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
        <ThemeButton
          onClick={() => setShowAccount(true)}
          className="order-1 md:order-none w-32 h-32 rounded-full 
            bg-gradient-to-b from-[#00E676] via-[#76FF03] to-[#FFEB3B] 
            animate-theme-glow"
        >
          ACCOUNT
        </ThemeButton>

        <ThemeButton
          onClick={() => setShowChat(true)}
          className="order-2 md:order-none w-40 h-40 rounded-full 
            bg-gradient-to-b from-[#FFD600] via-[#FF6D00] to-[#FF1744] 
            animate-theme-glow"
        >
          HELLO
        </ThemeButton>

        <ThemeButton
          onClick={() => setShowBook(true)}
          className="order-3 md:order-none w-32 h-32 rounded-full 
            bg-gradient-to-b from-[#00E5FF] via-[#00B8D4] to-[#FF9800] 
            animate-theme-glow"
        >
          BOOK
        </ThemeButton>
      </div>

      {showAccount && (
        <ThemeCard animate className="fixed inset-0 m-4 md:m-8">
          <AccountPanel 
            open={showAccount} 
            onClose={() => setShowAccount(false)}
            onSignOut={handleSignOut}
          />
        </ThemeCard>
      )}

      {showBook && (
        <ThemeCard animate className="fixed inset-0 m-4 md:m-8">
          <BookPanel
            open={showBook}
            onClose={() => setShowBook(false)}
          />
        </ThemeCard>
      )}

      {showChat && (
        <ThemeCard animate className="fixed inset-0 m-4 md:m-8">
          <ChatPanel
            open={showChat}
            onClose={() => setShowChat(false)}
          />
        </ThemeCard>
      )}
    </div>
  )
}

