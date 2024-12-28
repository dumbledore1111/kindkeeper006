// File: lib/date-parser.ts

const DATE_PATTERNS = {
  today: ['today', 'now', 'this evening', 'tonight', 'this morning'],
  yesterday: ['yesterday', 'last night', 'previous day'],
  tomorrow: ['tomorrow', 'next day'],
  nextWeek: ['next week', 'coming week'],
  nextMonth: ['next month', 'coming month'],
  thisMonth: ['this month', 'current month'],
  lastMonth: ['last month', 'previous month']
}

const MONTH_NAMES = {
  english: [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ],
  hindi: [
    'जनवरी', 'फरवरी', 'मार्च', 'अप्रैल', 'मई', 'जून',
    'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'
  ],
  shortForms: [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ]
}

export function parseDateFromText(text: string | null): Date {
  if (!text) return new Date()

  const lowerText = text.toLowerCase()

  // Check relative dates
  for (const [type, patterns] of Object.entries(DATE_PATTERNS)) {
    if (patterns.some(p => lowerText.includes(p))) {
      const date = new Date()
      
      switch(type) {
        case 'yesterday':
          date.setDate(date.getDate() - 1)
          break
        case 'tomorrow':
          date.setDate(date.getDate() + 1)
          break
        case 'nextWeek':
          date.setDate(date.getDate() + 7)
          break
        case 'nextMonth':
          date.setMonth(date.getMonth() + 1)
          break
        case 'lastMonth':
          date.setMonth(date.getMonth() - 1)
          break
      }
      
      return date
    }
  }

  // Try to match specific date formats (e.g., "5th January", "5 Jan")
  const datePattern = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-zA-Z]+)/i
  const match = lowerText.match(datePattern)

  if (match) {
    const day = parseInt(match[1])
    const monthStr = match[2].toLowerCase()
    let month = -1

    // Check English month names and short forms
    month = MONTH_NAMES.english.findIndex(m => monthStr.startsWith(m))
    if (month === -1) {
      month = MONTH_NAMES.shortForms.findIndex(m => monthStr.startsWith(m))
    }

    if (month !== -1) {
      const date = new Date()
      date.setDate(day)
      date.setMonth(month)
      
      // If the date is in the past, assume next occurrence
      if (date < new Date()) {
        date.setFullYear(date.getFullYear() + 1)
      }
      
      return date
    }
  }

  // Default to current date if no pattern matches
  return new Date()
}

// Helper function to check if date is within range
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end
}

// Helper function to format date in Indian format
export function formatIndianDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}