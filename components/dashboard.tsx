'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { AccountPanel } from "@/components/account-panel"
import { BookPanel } from "@/components/book-panel"
import { ChatPanel } from "@/components/chat-panel"
import { useRouter } from 'next/navigation'
import { useSettings } from '@/contexts/SettingsContext'
import { BookOpen, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export default function Dashboard() {
  const [showAccount, setShowAccount] = useState(false)
  const [showBook, setShowBook] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const router = useRouter()
  const { settings } = useSettings()
  const { session } = useAuth()

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black">
      {/* Mobile container */}
      <div className="w-[400px] h-[700px] rounded-3xl border border-gray-200 bg-[#FFFBEB] shadow-xl p-6 relative">
        {/* Top bar */}
        <div className="flex justify-between items-center">
          <span className="text-orange-500 text-xl font-medium">kindkeeper</span>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowBook(true)}
              className="h-12 w-12 rounded-full bg-cyan-400 hover:bg-cyan-500 text-white 
                flex items-center justify-center transition-all duration-300"
            >
              <BookOpen className="w-6 h-6" />
            </Button>
            <Button
              onClick={() => setShowAccount(true)}
              className="h-12 w-12 rounded-full bg-orange-400 hover:bg-orange-500 text-white
                flex items-center justify-center transition-all duration-300"
            >
              <User className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Center Hello Button - Adjusted positioning */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <Button
            onClick={() => setShowChat(true)}
            className="w-32 h-32 rounded-full 
              bg-gradient-to-b from-orange-400 to-orange-600
              text-white font-bold text-xl 
              shadow-lg shadow-orange-500/50 
              hover:shadow-orange-500/70 hover:scale-105 
              transition-all duration-300"
          >
            HELLO
          </Button>
        </div>

        {/* Panels */}
        {showAccount && (
          <AccountPanel 
            open={showAccount} 
            onClose={() => setShowAccount(false)}
            onSignOut={async () => {
              await supabase.auth.signOut()
              await router.push('/login')
            }}
          />
        )}

        {showBook && (
          <BookPanel 
            open={showBook} 
            onClose={() => setShowBook(false)}
          />
        )}

        {showChat && (
          <ChatPanel 
            open={showChat} 
            onClose={() => setShowChat(false)}
          />
        )}
      </div>
    </div>
  )
}

