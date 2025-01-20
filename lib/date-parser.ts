import { addDays, addMonths, addWeeks, startOfDay, endOfDay, parse, isValid, format } from 'date-fns';

// Handler that takes a date and optional match array and returns a date
type DateHandler = (now: Date, match?: RegExpMatchArray | null) => Date;

// Array of tuples containing regex pattern and its handler
const RELATIVE_DATES: Array<[RegExp, DateHandler]> = [
  [/\b(today|now|tonight)\b/i, (now: Date) => startOfDay(now)],
  [/\btomorrow\b/i, (now: Date) => startOfDay(addDays(now, 1))],
  [/\byesterday\b/i, (now: Date) => startOfDay(addDays(now, -1))],
  [/\bnext week\b/i, (now: Date) => startOfDay(addWeeks(now, 1))],
  [/\bnext month\b/i, (now: Date) => startOfDay(addMonths(now, 1))],
  [/\bin (\d+) days?\b/i, (now: Date, match) => startOfDay(addDays(now, match?.[1] ? parseInt(match[1]) : 1))],
  [/\bin (\d+) weeks?\b/i, (now: Date, match) => startOfDay(addWeeks(now, match?.[1] ? parseInt(match[1]) : 1))],
  [/\bin (\d+) months?\b/i, (now: Date, match) => startOfDay(addMonths(now, match?.[1] ? parseInt(match[1]) : 1))]
];

const MONTHS = {
  english: [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ],
  short: [
    'jan', 'feb', 'mar', 'apr', 'may', 'jun',
    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'
  ]
} as const;

const DATE_FORMATS = [
  'dd/MM/yyyy',
  'dd-MM-yyyy',
  'yyyy-MM-dd',
  'd MMM yyyy',
  'd MMMM yyyy',
  'MMMM d, yyyy'
];

export class DateParser {
  static parseDate(text: string): Date {
    const now = new Date();
    const lowerText = text.toLowerCase();

    // Try relative dates first
    for (const [pattern, handler] of RELATIVE_DATES) {
      const match = lowerText.match(pattern);
      if (match) {
        return handler(now, match);
      }
    }

    // Try natural language date expressions
    const dayMatch = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z]+)(?:\s+(\d{4}))?\b/);
    if (dayMatch) {
      const [, day, month, year] = dayMatch;
      const monthIndex = this.findMonthIndex(month.toLowerCase());
      
      if (monthIndex !== -1) {
        const date = new Date(
          year ? parseInt(year) : now.getFullYear(),
          monthIndex,
          parseInt(day)
        );
        
        // If date is in past and no year was specified, assume next occurrence
        if (!year && date < now) {
          date.setFullYear(date.getFullYear() + 1);
        }
        
        return startOfDay(date);
      }
    }

    // Default to tomorrow for reminders if no date specified
    return startOfDay(addDays(now, 1));
  }

  private static findMonthIndex(monthStr: string): number {
    // Try full month names
    let index = MONTHS.english.findIndex(m => monthStr.startsWith(m));
    if (index !== -1) return index;

    // Try abbreviated month names
    index = MONTHS.short.findIndex(m => monthStr.startsWith(m));
    return index;
  }

  static formatDate(date: Date): string {
    return format(date, 'd MMMM yyyy');
  }

  static getDateRange(date: Date, range: 'day' | 'week' | 'month'): { start: Date; end: Date } {
    const start = startOfDay(date);
    let end: Date;

    switch (range) {
      case 'day':
        end = endOfDay(date);
        break;
      case 'week':
        start.setDate(date.getDate() - date.getDay()); // Start from Sunday
        end = endOfDay(addDays(start, 6));
        break;
      case 'month':
        start.setDate(1); // Start of month
        end = endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0)); // End of month
        break;
    }

    return { start, end };
  }
}

// For backward compatibility
export function parseDateFromText(text: string): Date {
  return DateParser.parseDate(text);
}

// Helper function to check if date is within range
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
  return date >= start && date <= end;
}

// Helper function to format date in Indian format
export function formatIndianDate(date: Date): string {
  return DateParser.formatDate(date);
} 