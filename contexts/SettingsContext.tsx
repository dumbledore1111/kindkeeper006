'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { AppSettings } from '@/types/settings'
import { supabase } from '@/lib/supabase'

interface SettingsContextType {
  settings: AppSettings | null
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>
  isLoading: boolean
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  updateSettings: async () => {},
  isLoading: true
})

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    // Apply saved theme on mount
    if (settings?.theme) {
      document.documentElement.classList.toggle('dark', settings.theme === 'dark')
    }
  }, [settings?.theme])

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        const formattedSettings: AppSettings = {
          textSize: data.text_size,
          volume: data.volume,
          currency: {
            code: data.currency_code,
            symbol: data.currency_symbol,
            rate: data.currency_rate
          },
          language: {
            code: data.language_code,
            name: data.language_name,
            direction: data.language_direction as 'ltr' | 'rtl'
          },
          voiceType: data.voice_type,
          theme: data.theme
        }
        setSettings(formattedSettings)
        applySettings(formattedSettings)
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const applySettings = (settings: AppSettings) => {
    // Apply theme
    document.documentElement.classList.toggle('dark', settings.theme === 'dark')
    
    // Apply text size
    document.documentElement.style.setProperty('--text-base-size', 
      settings.textSize === 'small' ? '14px' : 
      settings.textSize === 'large' ? '18px' : '16px'
    )

    // Apply language direction
    document.documentElement.dir = settings.language.direction
  }

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const updatedSettings = { 
        ...settings, 
        ...newSettings,
        textSize: newSettings.textSize || settings?.textSize || 'medium',
        volume: newSettings.volume || settings?.volume || 50,
        voiceType: newSettings.voiceType || settings?.voiceType || 'default',
        theme: newSettings.theme || settings?.theme || 'dark',
        currency: newSettings.currency || settings?.currency || {
          code: 'USD',
          symbol: '$',
          rate: 1
        },
        language: newSettings.language || settings?.language || {
          code: 'en',
          name: 'English',
          direction: 'ltr'
        }
      } as AppSettings
      
      // Format settings for database
      const dbSettings = {
        text_size: updatedSettings.textSize,
        volume: updatedSettings.volume,
        currency_code: updatedSettings.currency.code,
        currency_symbol: updatedSettings.currency.symbol,
        currency_rate: updatedSettings.currency.rate,
        language_code: updatedSettings.language.code,
        language_name: updatedSettings.language.name,
        language_direction: updatedSettings.language.direction,
        voice_type: updatedSettings.voiceType,
        theme: updatedSettings.theme
      }

      const { error } = await supabase
        .from('user_settings')
        .update(dbSettings)
        .eq('user_id', user.id)

      if (!error) {
        setSettings(updatedSettings)
        applySettings(updatedSettings)
      }
    } catch (error) {
      console.error('Error updating settings:', error)
    }
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  )
}

// Custom hook to use settings
export const useSettings = () => {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}