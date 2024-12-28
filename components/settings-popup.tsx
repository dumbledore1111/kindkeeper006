'use client'

import { useState, useEffect } from 'react'
import { PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useSettings } from '@/contexts/SettingsContext'

interface SettingsPopupProps {
  onSettingsChange: (settings: AppSettings) => void;
  initialSettings: AppSettings;
}

export interface AppSettings {
  textSize: 'small' | 'medium' | 'large';
  volume: number;
  currency: string;
  language: string;
  voiceType: string;
  theme: 'dark' | 'light';
}

export function SettingsPopup({ onSettingsChange, initialSettings }: SettingsPopupProps) {
  const { settings, updateSettings } = useSettings()
  const [localSettings, setLocalSettings] = useState<AppSettings>(initialSettings)

  const handleThemeChange = async (theme: 'light' | 'dark') => {
    // Update local state
    setLocalSettings(prev => ({ ...prev, theme }))
    
    // Update global settings
    await updateSettings({ theme })
    
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

  return (
    <PopoverContent className="w-[400px] transition-colors duration-300 dark:bg-dark-background bg-light-background">
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-medium dark:text-white text-gray-700">
              Currency
            </label>
            <Select
              value={localSettings.currency}
              onValueChange={(value) => handleSettingChange('currency', value)}
            >
              <SelectTrigger className={`w-full h-10 ${localSettings.theme === 'dark' ? 'bg-[#2a3447] text-white' : 'bg-gray-100 text-black'} border-none`}>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent className={localSettings.theme === 'dark' ? 'bg-[#2a3447] border-none' : 'bg-white border-gray-200'}>
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
            <label className="text-sm font-medium dark:text-white text-gray-700">
              Language
            </label>
            <Select
              value={localSettings.language}
              onValueChange={(value) => handleSettingChange('language', value)}
            >
              <SelectTrigger className={`w-full h-10 ${localSettings.theme === 'dark' ? 'bg-[#2a3447] text-white' : 'bg-gray-100 text-black'} border-none`}>
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent className={localSettings.theme === 'dark' ? 'bg-[#2a3447] border-none' : 'bg-white border-gray-200'}>
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
            <label className="text-sm font-medium dark:text-white text-gray-700">
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
                      ? 'bg-orange-500 text-white' 
                      : localSettings.theme
                        ? 'bg-[#2a3447] text-gray-200 hover:bg-[#3a4457]'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  `}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium dark:text-white text-gray-700">
              Voice Type
            </label>
            <Select
              value={localSettings.voiceType}
              onValueChange={(value) => handleSettingChange('voiceType', value)}
            >
              <SelectTrigger className={`w-full h-10 ${localSettings.theme === 'dark' ? 'bg-[#2a3447] text-white' : 'bg-gray-100 text-black'} border-none`}>
                <SelectValue placeholder="Select voice type" />
              </SelectTrigger>
              <SelectContent className={localSettings.theme === 'dark' ? 'bg-[#2a3447] border-none' : 'bg-white border-gray-200'}>
                <SelectGroup>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium dark:text-white text-gray-700">
              Volume
            </label>
            <div className="px-1">
              <Slider
                min={0}
                max={100}
                step={1}
                value={[localSettings.volume]}
                onValueChange={([value]) => handleSettingChange('volume', value)}
                className="[&_[role=slider]]:bg-orange-500 [&_[role=slider]]:border-none"
              />
              <div className={`text-center text-sm ${localSettings.theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                {localSettings.volume}%
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium dark:text-white text-gray-700">
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
                      ? 'bg-orange-500 text-white' 
                      : 'dark:bg-[#2a3447] dark:text-gray-200 dark:hover:bg-[#3a4457] bg-gray-100 text-gray-700 hover:bg-gray-200'}
                  `}
                >
                  {theme}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button 
          onClick={() => onSettingsChange(localSettings)}
          className="w-full h-10 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-md"
        >
          Save Settings
        </Button>
      </div>
    </PopoverContent>
  )
}

