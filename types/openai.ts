// Base transcription segment type
export interface BaseTranscriptionSegment {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
}

// Enhanced segment with confidence
export interface EnhancedTranscriptionSegment extends BaseTranscriptionSegment {
  confidence?: number;
}

// Full transcription response
export interface VerboseTranscription {
  text: string;
  language: string;
  segments: EnhancedTranscriptionSegment[];
  task?: string;
  duration?: number;
  language_probability?: number;
}

// Response format options
export type TranscriptionResponseFormat = 
  | 'json'
  | 'text'
  | 'srt'
  | 'verbose_json'
  | 'vtt'; 