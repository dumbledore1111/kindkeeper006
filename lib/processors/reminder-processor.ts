import type { 
  ReminderResponse, 
  ProcessingResult, 
  Context,
  DatabaseOperation 
} from '@/types/responses';
import { supabase } from '@/lib/supabase';
import { DateParser } from '../date-parser';

export class ReminderProcessor {
  constructor(private userId: string) {}

  async process(
    aiResponse: ReminderResponse, 
    context?: Context
  ): Promise<ProcessingResult> {
    try {
      // Validate reminder data
      if (!aiResponse.due_date) {
        return {
          success: false,
          response: "When would you like to be reminded?",
          context: {
            userId: this.userId,
            currentIntent: {
              type: 'reminder',
              confidence: 0.8,
              relatedEvents: []
            },
            lastIntent: 'reminder',
            history: context?.history || [],
            currentReminder: aiResponse,
            recentEvents: [],
            relatedContexts: [],
            relatedEvents: [],
            timeContext: {
              referenceDate: new Date()
            }
          },
          needsMoreInfo: {
            type: 'due_date',
            context: 'Need to know when to remind'
          },
          intent: 'reminder'
        };
      }

      const parsedDate = DateParser.parseDate(aiResponse.due_date);
      
      const dbOperations: DatabaseOperation[] = [{
        table: 'reminders',
        operation: 'insert',
        data: {
          user_id: this.userId,
          title: aiResponse.title,
          due_date: parsedDate.toISOString(),
          type: aiResponse.type || 'other',
          amount: aiResponse.amount,
          recurring: aiResponse.recurring || false,
          frequency: aiResponse.frequency,
          priority: aiResponse.priority || 'medium',
          status: 'PENDING',
          created_at: new Date().toISOString()
        }
      }];

      // Format response based on reminder type
      let response = `Sure, I'll remind you to ${aiResponse.title} on ${DateParser.formatDate(parsedDate)}`;
      if (aiResponse.recurring) {
        response += ` and every ${aiResponse.frequency || 'month'}`;
      }
      if (aiResponse.amount) {
        response += `. Amount: ₹${aiResponse.amount}`;
      }

      return {
        success: true,
        response,
        context: {
          userId: this.userId,
          currentIntent: {
            type: 'reminder',
            confidence: 0.8,
            relatedEvents: []
          },
          lastIntent: 'reminder',
          history: context?.history || [],
          currentReminder: aiResponse,
          recentEvents: [],
          relatedContexts: [],
          relatedEvents: [],
          timeContext: {
            referenceDate: new Date()
          }
        },
        intent: 'reminder',
        dbOperations
      };

    } catch (error) {
      console.error('Reminder processing error:', error);
      throw error;
    }
  }
} 