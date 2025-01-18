export interface ResponseAnalysis {
  type: 'simple' | 'complex' | 'query' | 'error';
  emotion: 'neutral' | 'concerned' | 'friendly';
  shouldCache: boolean;
}

const PATTERNS = {
  FINANCIAL: /₹|rupees?|paid|received|amount|balance/i,
  REMINDER: /remind|remember|don't forget|upcoming|schedule/i,
  ERROR: /sorry|error|couldn't|failed|try again/i,
  QUESTION: /\?|could you|would you|can you|should I/i,
  CONFIRMATION: /got it|understood|I'll|I will|sure/i,
  GRATITUDE: /thank|thanks|great|excellent/i
};

export function analyzeResponse(text: string): ResponseAnalysis {
  // Determine response type
  const type = determineResponseType(text);
  
  // Determine emotional tone
  const emotion = determineEmotion(text);
  
  // Determine if response should be cached
  const shouldCache = shouldCacheResponse(text, type);
  
  return { type, emotion, shouldCache };
}

function determineResponseType(text: string): 'simple' | 'complex' | 'query' | 'error' {
  if (PATTERNS.ERROR.test(text)) return 'error';
  if (PATTERNS.QUESTION.test(text)) return 'query';
  if (
    PATTERNS.FINANCIAL.test(text) || 
    PATTERNS.REMINDER.test(text) || 
    text.length > 100 ||
    text.split(' ').length > 20
  ) return 'complex';
  return 'simple';
}

function determineEmotion(text: string): 'neutral' | 'concerned' | 'friendly' {
  if (PATTERNS.ERROR.test(text)) return 'concerned';
  if (PATTERNS.GRATITUDE.test(text) || PATTERNS.CONFIRMATION.test(text)) return 'friendly';
  return 'neutral';
}

function shouldCacheResponse(text: string, type: string): boolean {
  return (
    type === 'complex' ||
    PATTERNS.FINANCIAL.test(text) ||
    PATTERNS.REMINDER.test(text)
  );
} 