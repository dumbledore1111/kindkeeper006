// File: lib/event-processor.ts

import { supabase } from './supabase';
import type { 
  Transaction,
  EventRelationship,
  ContextLog,
  CategoryType
} from '@/types/database';

interface EventPattern {
  type: 'recurring' | 'related' | 'sequential';
  confidence: number;
  transactions: string[];
  metadata: {
    frequency?: string;
    category?: CategoryType;
    relatedCategory?: CategoryType;
    timeGap?: number;
    amount?: number;
    amountVariation?: number;
  };
}

export class EventProcessor {
  constructor(private userId: string) {}

  async processNewTransaction(transaction: Transaction): Promise<void> {
    try {
      // 1. Find related transactions
      const relatedTransactions = await this.findRelatedTransactions(transaction);
      
      // 2. Detect patterns
      const patterns = await this.detectPatterns(transaction, relatedTransactions);
      
      // 3. Create relationships
      if (relatedTransactions.length > 0) {
        await this.createRelationships(transaction, relatedTransactions);
      }

      // 4. Update patterns in learning_patterns table
      if (patterns.length > 0) {
        await this.updatePatterns(patterns);
      }
    } catch (error) {
      console.error('Event processing error:', error);
      throw error;
    }
  }

  private async findRelatedTransactions(transaction: Transaction): Promise<Transaction[]> {
    const { data: transactions } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_categories (category)
      `)
      .eq('user_id', this.userId)
      .neq('id', transaction.id)
      .order('created_at', { ascending: false })
      .limit(50);

    return this.filterRelatedTransactions(transaction, transactions || []);
  }

  private filterRelatedTransactions(current: Transaction, all: Transaction[]): Transaction[] {
    const related: Transaction[] = [];
    
    for (const t of all) {
      // Same category
      if (current.category && t.category && t.category === current.category) {
        related.push(t);
        continue;
      }

      // Similar amount (within 10% variation)
      const amountDiff = Math.abs(t.amount - current.amount);
      const variation = amountDiff / current.amount;
      if (variation <= 0.1) {
        related.push(t);
        continue;
      }

      // Same description keywords
      const currentWords = current.description?.toLowerCase().split(' ') || [];
      const tWords = t.description?.toLowerCase().split(' ') || [];
      const commonWords = currentWords.filter(word => tWords.includes(word));
      if (commonWords.length > 2) {
        related.push(t);
      }
    }

    return related;
  }

  private async detectPatterns(
    current: Transaction, 
    related: Transaction[]
  ): Promise<EventPattern[]> {
    const patterns: EventPattern[] = [];

    // Detect recurring patterns
    const recurringPattern = this.detectRecurringPattern(current, related);
    if (recurringPattern) {
      patterns.push(recurringPattern);
    }

    // Detect related category patterns
    const categoryPattern = this.detectCategoryPattern(current, related);
    if (categoryPattern) {
      patterns.push(categoryPattern);
    }

    // Detect sequential patterns
    const sequentialPattern = this.detectSequentialPattern(current, related);
    if (sequentialPattern) {
      patterns.push(sequentialPattern);
    }

    return patterns;
  }

  private detectRecurringPattern(
    current: Transaction,
    related: Transaction[]
  ): EventPattern | null {
    const similarAmountTransactions = related.filter(t => {
      const amountDiff = Math.abs(t.amount - current.amount);
      return amountDiff / current.amount <= 0.1;
    });

    if (similarAmountTransactions.length < 2) return null;

    // Calculate average time gap
    const gaps = similarAmountTransactions.map(t => {
      const currentDate = new Date(current.created_at);
      const tDate = new Date(t.created_at);
      return Math.abs(currentDate.getTime() - tDate.getTime());
    });

    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const gapVariation = Math.max(...gaps) - Math.min(...gaps);

    // If gap variation is relatively consistent (within 20%)
    if (gapVariation / avgGap <= 0.2) {
      return {
        type: 'recurring',
        confidence: 0.8,
        transactions: [current.id, ...similarAmountTransactions.map(t => t.id)],
        metadata: {
          frequency: this.determineFrequency(avgGap),
          amount: current.amount,
          amountVariation: Math.max(...similarAmountTransactions.map(t => 
            Math.abs(t.amount - current.amount)
          )),
          category: current.category,
          timeGap: avgGap
        }
      };
    }

    return null;
  }

  private determineFrequency(timeGapMs: number): string {
    const days = timeGapMs / (1000 * 60 * 60 * 24);
    if (days >= 28 && days <= 31) return 'monthly';
    if (days >= 6 && days <= 8) return 'weekly';
    if (days >= 13 && days <= 15) return 'biweekly';
    return 'irregular';
  }

  private detectCategoryPattern(
    current: Transaction,
    related: Transaction[]
  ): EventPattern | null {
    if (!current.category) return null;
  
    const relatedCategoryTransactions = related.filter(t => 
      t.category && t.category === current.category
    );
  
    if (relatedCategoryTransactions.length < 2) return null;
  
    return {
      type: 'related',
      confidence: 0.7,
      transactions: [current.id, ...relatedCategoryTransactions.map(t => t.id)],
      metadata: {
        category: current.category,
        relatedCategory: current.category,
        amount: current.amount
      }
    };
  }

  private detectSequentialPattern(
    current: Transaction,
    related: Transaction[]
  ): EventPattern | null {
    // Sort transactions by date
    const sortedTransactions = [...related]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
    // Look for transactions that occur in a sequence
    const sequences = sortedTransactions.reduce((acc: Transaction[][], transaction) => {
      const lastSequence = acc[acc.length - 1] || [];
      const lastTransaction = lastSequence[lastSequence.length - 1];
  
      if (!lastTransaction) {
        return [[transaction]];
      }
  
      // Check if this transaction follows the previous one within a reasonable time frame (7 days)
      const timeDiff = new Date(transaction.created_at).getTime() - 
                       new Date(lastTransaction.created_at).getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
  
      if (daysDiff <= 7) {
        lastSequence.push(transaction);
        return acc;
      } else {
        return [...acc, [transaction]];
      }
    }, []);
  
    // Find the longest sequence
    const longestSequence = sequences.reduce((longest, current) => 
      current.length > longest.length ? current : longest, []);
  
    if (longestSequence.length >= 2) {
      return {
        type: 'sequential',
        confidence: 0.6,
        transactions: [current.id, ...longestSequence.map(t => t.id)],
        metadata: {
          timeGap: this.calculateAverageGap(longestSequence),
          category: current.category
        }
      };
    }
  
    return null;
  }
  
  private calculateAverageGap(transactions: Transaction[]): number {
    if (transactions.length < 2) return 0;
  
    const gaps = transactions.slice(1).map((transaction, index) => {
      const prevDate = new Date(transactions[index].created_at).getTime();
      const currDate = new Date(transaction.created_at).getTime();
      return currDate - prevDate;
    });
  
    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  }
  
  private async createRelationships(
    current: Transaction,
    related: Transaction[]
  ): Promise<void> {
    const relationships = related.map(t => ({
      primary_event_id: current.id,
      primary_event_type: 'transaction',
      related_event_id: t.id,
      related_event_type: 'transaction',
      relationship_type: this.determineRelationshipType(current, t),
      created_at: new Date()
    }));

    await supabase
      .from('event_relationships')
      .insert(relationships);
  }

  private determineRelationshipType(t1: Transaction, t2: Transaction): string {
    if (t1.category && t2.category && t1.category === t2.category) return 'same_category';
    if (Math.abs(t1.amount - t2.amount) / t1.amount <= 0.1) return 'similar_amount';
    return 'related';
  }

  private async updatePatterns(patterns: EventPattern[]): Promise<void> {
    for (const pattern of patterns) {
      await supabase
        .from('learning_patterns')
        .upsert({
          user_id: this.userId,
          pattern_type: pattern.type,
          transactions: pattern.transactions,
          metadata: pattern.metadata,
          confidence: pattern.confidence,
          updated_at: new Date()
        });
    }
  }

  // Helper method to get event context
  async getEventContext(eventId: string): Promise<ContextLog | null> {
    const { data } = await supabase
      .from('context_logs')
      .select('*')
      .eq('event_id', eventId)
      .single();

    return data;
  }
}