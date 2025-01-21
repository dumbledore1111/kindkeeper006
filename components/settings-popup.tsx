'use client'

import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

export interface AppSettings {
  textSize: 'small' | 'medium' | 'large';
  volume: number;
  currency: string;
  language: string;
  voiceType: string;
  theme: 'dark' | 'light';
}

interface SettingsPopupProps {
  onSettingsChange: (settings: AppSettings) => void;
  initialSettings: AppSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsPopup({ onSettingsChange, initialSettings, open, onOpenChange }: SettingsPopupProps) {
  const [localSettings, setLocalSettings] = useState<AppSettings>(initialSettings)

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    // Update local state
    setLocalSettings(prev => ({ ...prev, theme }))
    
    // Apply theme class to html element
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const handleSettingChange = (key: keyof AppSettings, value: any) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        const { error } = await supabase
          .from('user_settings')
          .upsert({
            user_id: session.user.id,
            ...localSettings,
            updated_at: new Date().toISOString()
          })

        if (error) {
          throw error
        }

        onSettingsChange(localSettings)
        onOpenChange(false)
      }
    } catch (error) {
      logger.error('Failed to save settings:', error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-none bg-transparent">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[400px] h-[700px] rounded-3xl bg-[#FFFBEB] shadow-xl relative animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center p-6">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => onOpenChange(false)}
                className="rounded-full hover:bg-[#FFEDD5]"
              >
                <ArrowLeft className="h-6 w-6 text-[#EA580C]" />
              </Button>
              <h2 className="text-2xl font-bold text-[#EA580C]">Settings</h2>
              <div className="w-10" /> {/* Spacer for alignment */}
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[#9A3412]">
                    Currency
                  </label>
                  <Select
                    value={localSettings.currency}
                    onValueChange={(value) => handleSettingChange('currency', value)}
                  >
                    <SelectTrigger className="w-full h-10 bg-white border-2 border-[#F97316] text-[#9A3412]">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#F97316]">
                      <SelectGroup>
                        <SelectItem value="INR">Indian Rupee (₹)</SelectItem>
                        <SelectItem value="USD">US Dollar ($)</SelectItem>
                        <SelectItem value="EUR">Euro (€)</SelectItem>
                        <SelectItem value="GBP">British Pound (£)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-[#9A3412]">
                    Language
                  </label>
                  <Select
                    value={localSettings.language}
                    onValueChange={(value) => handleSettingChange('language', value)}
                  >
                    <SelectTrigger className="w-full h-10 bg-white border-2 border-[#F97316] text-[#9A3412]">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#F97316]">
                      <SelectGroup>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
                        <SelectItem value="ta">தமிழ் (Tamil)</SelectItem>
                        <SelectItem value="ml">മലയാളം (Malayalam)</SelectItem>
                        <SelectItem value="ar">العربية (Arabic)</SelectItem>
                        <SelectItem value="fr">Français (French)</SelectItem>
                        <SelectItem value="es">Español (Spanish)</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-[#9A3412]">
                    Text Size
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['small', 'medium', 'large'] as const).map((size) => (
                      <button
                        key={size}
                        onClick={() => handleSettingChange('textSize', size)}
                        className={`
                          h-10 rounded-md capitalize
                          ${localSettings.textSize === size 
                            ? 'bg-[#EA580C] text-white' 
                            : 'bg-white border-2 border-[#F97316] text-[#9A3412] hover:bg-[#FFEDD5]'}
                        `}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-[#9A3412]">
                    Voice Type
                  </label>
                  <Select
                    value={localSettings.voiceType}
                    onValueChange={(value) => handleSettingChange('voiceType', value)}
                  >
                    <SelectTrigger className="w-full h-10 bg-white border-2 border-[#F97316] text-[#9A3412]">
                      <SelectValue placeholder="Select voice type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#F97316]">
                      <SelectGroup>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-[#9A3412]">
                    Volume
                  </label>
                  <div className="px-1">
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[localSettings.volume]}
                      onValueChange={([value]) => handleSettingChange('volume', value)}
                      className="[&_[role=slider]]:bg-[#EA580C] [&_[role=slider]]:border-none"
                    />
                    <div className="text-center text-sm text-[#9A3412] mt-1">
                      {localSettings.volume}%
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-[#9A3412]">
                    Color Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['dark', 'light'] as const).map((theme) => (
                      <button
                        key={theme}
                        onClick={() => handleThemeChange(theme)}
                        className={`
                          h-10 rounded-md capitalize transition-colors
                          ${localSettings.theme === theme 
                            ? 'bg-[#EA580C] text-white' 
                            : 'bg-white border-2 border-[#F97316] text-[#9A3412] hover:bg-[#FFEDD5]'}
                        `}
                      >
                        {theme}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSave}
                className="w-full h-14 bg-[#EA580C] hover:bg-[#C2410C] text-white text-lg font-semibold rounded-xl"
              >
                Save Settings
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

