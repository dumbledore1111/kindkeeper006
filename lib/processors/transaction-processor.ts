import type { 
  TransactionResponse, 
  ProcessingResult, 
  Context,
  DatabaseOperation 
} from '@/types/responses';
import { supabase } from '@/lib/supabase';
import { IntentDetector } from '@/lib/intent-detector';

export class TransactionProcessor {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async processTransaction(aiResponse: TransactionResponse, context?: Context): Promise<ProcessingResult> {
    try {
      // Validate essential transaction data - only amount and description
      if (!aiResponse.amount || !aiResponse.description) {
        return {
          success: false,
          response: !aiResponse.amount ? "Could you please specify the amount?" : "Could you describe the transaction?",
          context: {
            userId: this.userId,
            currentIntent: {
              type: 'transaction',
              confidence: 0.8,
              relatedEvents: []
            },
            history: context?.history || [],
            currentTransaction: aiResponse,
            recentEvents: [],
            relatedContexts: [],
            relatedEvents: [],
            timeContext: {
              referenceDate: new Date()
            }
          },
          intent: 'transaction'
        };
      }

      // Create transaction operation
      const dbOperations: DatabaseOperation[] = [{
        table: 'transactions',
        operation: 'insert',
        data: {
          user_id: this.userId,
          amount: aiResponse.amount,
          type: aiResponse.type || 'expense',
          description: aiResponse.description,
          category: aiResponse.category || 'miscellaneous',
          created_at: aiResponse.date || new Date().toISOString(),
          payment_method: aiResponse.payment_method || 'CASH' // Default to CASH if not specified
        }
      }];

      // Execute database operations
      await this.executeOperations(dbOperations);

      // Format the response
      const date = new Date(aiResponse.date || new Date()).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      // Clear any cached transaction state
      const intentDetector = new IntentDetector(this.userId);
      intentDetector.clearTransaction(this.userId);

      // Return success response with cleared context
      return {
        success: true,
        response: `Got it! ${aiResponse.type === 'income' ? 'Received' : 'Paid'} ₹${aiResponse.amount} for ${aiResponse.description} on ${date}.`,
        context: {
          userId: this.userId,
          currentIntent: {
            type: 'unknown',
            confidence: 0,
            relatedEvents: []
          },
          history: context?.history || [],
          currentTransaction: undefined,
          recentEvents: [],
          relatedContexts: [],
          relatedEvents: [],
          timeContext: {
            referenceDate: new Date()
          }
        },
        intent: 'transaction',
        dbOperations
      };

    } catch (error) {
      console.error('Transaction processing error:', error);
      throw error;
    }
  }

  private async executeOperations(operations: DatabaseOperation[]) {
    for (const op of operations) {
      switch (op.operation) {
        case 'insert':
          await supabase.from(op.table).insert(op.data);
          break;
        case 'update':
          await supabase.from(op.table)
            .update(op.data)
            .eq('user_id', this.userId);
          break;
      }
    }
  }
} 