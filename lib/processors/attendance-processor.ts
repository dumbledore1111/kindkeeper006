import type { 
  AttendanceResponse, 
  ProcessingResult, 
  Context,
  DatabaseOperation
} from '@/types/responses';

export class AttendanceProcessor {
  constructor(private userId: string) {}

  async process(
    aiResponse: AttendanceResponse, 
    context?: Context
  ): Promise<ProcessingResult> {
    try {
      if (!aiResponse.name) {
        return {
          success: false,
          response: `Could you specify the ${aiResponse.provider_type}'s name?`,
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
            }
          },
          needsMoreInfo: {
            type: 'provider_name',
            context: 'Name is required for attendance tracking'
          },
          intent: 'attendance'
        };
      }

      const dbOperations: DatabaseOperation[] = [{
        table: 'attendance_logs',
        operation: 'insert',
        data: {
          user_id: this.userId,
          provider_type: aiResponse.provider_type,
          name: aiResponse.name,
          status: aiResponse.status,
          date: aiResponse.date,
          extra_info: aiResponse.extra_info,
          payment_status: aiResponse.payment?.paid || false
        }
      }];

      // If payment included, add transaction
      if (aiResponse.payment?.amount) {
        dbOperations.push({
          table: 'transactions',
          operation: 'insert',
          data: {
            user_id: this.userId,
            amount: aiResponse.payment.amount,
            type: 'expense',
            description: `Payment to ${aiResponse.provider_type} ${aiResponse.name}`,
            created_at: aiResponse.date
          }
        });
      }

      return {
        success: true,
        response: `Recorded ${aiResponse.status} for ${aiResponse.provider_type} ${aiResponse.name}`,
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
          }
        },
        intent: 'attendance',
        dbOperations
      };

    } catch (error) {
      console.error('Attendance processing error:', error);
      throw error;
    }
  }
} 