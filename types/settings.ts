export type AppSettings = {
  textSize: 'small' | 'medium' | 'large'
  volume: number
  currency: {
    code: string
    symbol: string
    rate: number
  }
  language: {
    code: string
    name: string
    direction: 'ltr' | 'rtl'
  }
  voiceType: string
  theme: 'light' | 'dark'
} 

export interface VoiceSettings {
  preferredVoice: 'elevenlabs' | 'browser';
  speakingRate: number;
  volume: number;
  useIndianEnglish: boolean;
} 