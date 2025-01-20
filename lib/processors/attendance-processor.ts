import type { 
  ProcessingResult, 
  Context,
  DatabaseOperation,
  AttendanceResponse
} from '@/types/responses';
import type { ServiceProviderType, PaymentMethod } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { IntentDetector } from '../intent-detector';

export interface WageInfo {
  amount: number;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  schedule?: {
    visits_per_week?: number;
    hours_per_visit?: number;
  };
}

// Cache for storing incomplete attendance records
const attendanceCache = new Map<string, Partial<AttendanceResponse>>();

export class AttendanceProcessor {
  private intentDetector: IntentDetector;

  constructor(private userId: string) {
    this.intentDetector = new IntentDetector(userId);
  }

  async process(
    input: string | AttendanceResponse,
    context?: Context
  ): Promise<ProcessingResult> {
    try {
      // Handle pre-processed AttendanceResponse
      if (typeof input === 'object' && input.name) {
        const currentAttendance: Partial<AttendanceResponse> = {
          provider_type: input.provider_type,
          name: input.name,
          status: input.status,
          date: input.date
        };
        
        // Store in cache
        attendanceCache.set(this.userId, currentAttendance);
        
        // If payment info exists, treat it as wage info
        if (input.payment) {
          const wageInfo: WageInfo = {
            amount: input.payment.amount,
            frequency: 'monthly', // Default to monthly for now
            schedule: {}
          };
          currentAttendance.wage_info = wageInfo;
          
          // Create database operations
          const dbOperations: DatabaseOperation[] = [
            {
              table: 'attendance_logs',
              operation: 'insert',
              data: {
                user_id: this.userId,
                provider_type: currentAttendance.provider_type,
                name: currentAttendance.name,
                status: currentAttendance.status,
                date: currentAttendance.date
              }
            },
            {
              table: 'service_provider_wages',
              operation: 'insert',
              data: {
                user_id: this.userId,
                provider_type: currentAttendance.provider_type,
                name: currentAttendance.name,
                wage_amount: wageInfo.amount,
                wage_frequency: wageInfo.frequency,
                updated_at: new Date().toISOString()
              }
            }
          ];

          // Clear cache
          attendanceCache.delete(this.userId);

          return {
            success: true,
            response: `Got it! ${currentAttendance.name} is ${currentAttendance.status} today. Their wage is ₹${wageInfo.amount} per month.`,
            context: {
              userId: this.userId,
              currentIntent: {
                type: 'attendance',
                confidence: 0.8,
                relatedEvents: []
              },
              lastIntent: 'attendance',
              history: context?.history || [],
              recentEvents: [],
              relatedContexts: [],
              relatedEvents: [],
              timeContext: {
                referenceDate: new Date()
              },
              currentAttendance: undefined
            },
            intent: 'attendance',
            dbOperations
          };
        }
      }

      // Handle string input
      const inputStr = typeof input === 'string' ? input : '';
      
      // Get cached attendance info
      let currentAttendance = attendanceCache.get(this.userId) || {};
      
      // If this is a new attendance record
      if (!currentAttendance.name && !currentAttendance.wage_info) {
        // Try to extract provider type and status from input
        const isPresent = !inputStr.toLowerCase().includes('not') && !inputStr.toLowerCase().includes('absent');
        currentAttendance = {
          provider_type: 'maid',
          status: isPresent ? 'present' : 'absent',
          date: new Date().toISOString()
        };
        attendanceCache.set(this.userId, currentAttendance);
      }

      // Step 1: Check for name
      if (!currentAttendance.name) {
        // If input looks like a name (single word, no numbers)
        if (/^[a-zA-Z]+$/.test(inputStr.trim())) {
          currentAttendance.name = inputStr.trim();
          attendanceCache.set(this.userId, currentAttendance);
          
          return {
            success: false,
            response: `How much do we pay ${currentAttendance.name}?`,
            context: {
              userId: this.userId,
              currentIntent: {
                type: 'attendance',
                confidence: 0.8,
                relatedEvents: []
              },
              lastIntent: 'attendance',
              history: context?.history || [],
              recentEvents: [],
              relatedContexts: [],
              relatedEvents: [],
              timeContext: {
                referenceDate: new Date()
              },
              currentAttendance
            },
            needsMoreInfo: {
              type: 'wage_info',
              context: 'Need wage and schedule information'
            },
            intent: 'attendance'
          };
        } else {
          return {
            success: false,
            response: `Could you specify the ${currentAttendance.provider_type}'s name?`,
            context: {
              userId: this.userId,
              currentIntent: {
                type: 'attendance',
                confidence: 0.8,
                relatedEvents: []
              },
              lastIntent: 'attendance',
              history: context?.history || [],
              recentEvents: [],
              relatedContexts: [],
              relatedEvents: [],
              timeContext: {
                referenceDate: new Date()
              },
              currentAttendance
            },
            needsMoreInfo: {
              type: 'provider_name',
              context: 'Name is required for attendance tracking'
            },
            intent: 'attendance'
          };
        }
      }

      // Step 2: Check for wage info
      if (!currentAttendance.wage_info) {
        const wageInfo = this.intentDetector.parseWageInfo(inputStr);
        if (wageInfo) {
          currentAttendance.wage_info = wageInfo;
          attendanceCache.set(this.userId, currentAttendance);
          
          // We have all information, proceed to save
          const dbOperations: DatabaseOperation[] = [
            {
              table: 'attendance_logs',
              operation: 'insert',
              data: {
                user_id: this.userId,
                provider_type: currentAttendance.provider_type,
                name: currentAttendance.name,
                status: currentAttendance.status,
                date: currentAttendance.date
              }
            },
            {
              table: 'service_provider_wages',
              operation: 'insert',
              data: {
                user_id: this.userId,
                provider_type: currentAttendance.provider_type,
                name: currentAttendance.name,
                wage_amount: wageInfo.amount,
                wage_frequency: wageInfo.frequency,
                visits_per_week: wageInfo.schedule?.visits_per_week,
                hours_per_visit: wageInfo.schedule?.hours_per_visit,
                updated_at: new Date().toISOString()
              }
            }
          ];

          // Clear the cache after successful processing
          attendanceCache.delete(this.userId);

          const frequencyText = {
            hourly: 'per hour',
            daily: 'per day',
            weekly: 'per week',
            monthly: 'per month'
          };

          const scheduleText = wageInfo.schedule?.visits_per_week 
            ? ` (${wageInfo.schedule.visits_per_week} times a week${
                wageInfo.schedule.hours_per_visit 
                  ? `, ${wageInfo.schedule.hours_per_visit} hours per visit`
                  : ''
              })`
            : '';

          return {
            success: true,
            response: `Got it! ${currentAttendance.name} is ${currentAttendance.status} today. Wage set to ₹${wageInfo.amount} ${frequencyText[wageInfo.frequency]}${scheduleText}.`,
            context: {
              userId: this.userId,
              currentIntent: {
                type: 'attendance',
                confidence: 0.8,
                relatedEvents: []
              },
              lastIntent: 'attendance',
              history: context?.history || [],
              recentEvents: [],
              relatedContexts: [],
              relatedEvents: [],
              timeContext: {
                referenceDate: new Date()
              },
              currentAttendance: undefined
            },
            intent: 'attendance',
            dbOperations
          };
        } else {
          return {
            success: false,
            response: `How much do we pay ${currentAttendance.name} and how often (daily/weekly/monthly)?`,
            context: {
              userId: this.userId,
              currentIntent: {
                type: 'attendance',
                confidence: 0.8,
                relatedEvents: []
              },
              lastIntent: 'attendance',
              history: context?.history || [],
              recentEvents: [],
              relatedContexts: [],
              relatedEvents: [],
              timeContext: {
                referenceDate: new Date()
              },
              currentAttendance
            },
            needsMoreInfo: {
              type: 'wage_info',
              context: 'Need wage and schedule information'
            },
            intent: 'attendance'
          };
        }
      }

      // This should rarely be reached, as we handle all cases above
      console.log('Unexpected state in attendance processor:', {
        currentAttendance,
        input: inputStr
      });

      return {
        success: false,
        response: 'Could you provide more details about the attendance?',
        context: {
          userId: this.userId,
          currentIntent: {
            type: 'attendance',
            confidence: 0.8,
            relatedEvents: []
          },
          lastIntent: 'attendance',
          history: context?.history || [],
          recentEvents: [],
          relatedContexts: [],
          relatedEvents: [],
          timeContext: {
            referenceDate: new Date()
          },
          currentAttendance
        },
        needsMoreInfo: {
          type: 'unknown',
          context: 'Missing required information'
        },
        intent: 'attendance'
      };

    } catch (error) {
      console.error('Attendance processing error:', error);
      throw error;
    }
  }
} 