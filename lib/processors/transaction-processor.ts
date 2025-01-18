import type { 
  TransactionResponse, 
  ProcessingResult, 
  Context,
  DatabaseOperation 
} from '@/types/responses';
import { supabase } from '@/lib/supabase';

export class TransactionProcessor {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async processTransaction(aiResponse: TransactionResponse, context?: Context): Promise<ProcessingResult> {
    try {
      const dbOperations: DatabaseOperation[] = [];
      
      // Validate transaction data
      if (!aiResponse.amount) {
        return {
          success: false,
          response: "Could you please specify the amount?",
          context: {
            userId: this.userId,
            currentIntent: {
              type: 'transaction',
              confidence: 0.8,
              relatedEvents: []
            },
            lastIntent: 'transaction',
            history: context?.history || [],
            currentTransaction: aiResponse,
            recentEvents: [],
            relatedContexts: [],
            relatedEvents: [],
            timeContext: {
              referenceDate: new Date()
            }
          },
          needsMoreInfo: {
            type: 'amount',
            context: 'Amount is required for the transaction'
          },
          intent: 'transaction'
        };
      }

      // Handle service provider if present
      if (aiResponse.service_provider) {
        dbOperations.push({
          table: 'service_providers',
          operation: 'insert',
          data: {
            user_id: this.userId,
            ...aiResponse.service_provider
          }
        });
      }

      // Create transaction operation
      dbOperations.push({
        table: 'transactions',
        operation: 'insert',
        data: {
          user_id: this.userId,
          amount: aiResponse.amount,
          type: aiResponse.type,
          description: aiResponse.description,
          payment_method: aiResponse.payment_method,
          date: aiResponse.date || new Date().toISOString(),
          category: aiResponse.category
        }
      });

      // Execute database operations
      await this.executeOperations(dbOperations);

      return {
        success: true,
        response: `${aiResponse.type === 'expense' ? 'Paid' : 'Received'} ₹${aiResponse.amount} for ${aiResponse.description}`,
        context: {
          userId: this.userId,
          currentIntent: {
            type: 'transaction',
            confidence: 0.8,
            relatedEvents: []
          },
          lastIntent: 'transaction',
          history: context?.history || [],
          currentTransaction: aiResponse,
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
        // Add other cases as needed
      }
    }
  }
} 