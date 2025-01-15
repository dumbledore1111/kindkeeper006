// File: lib/context-engine.ts

import { supabase } from './supabase';
import { openai } from './openai';
import { logger } from './logger';
import type { 
  ContextLog, 
  EventRelationship, 
  TransactionType,
  CategoryType,
  Context,
  Intent,
  IntentType
} from '@/types/database';

interface FormattedResponse {
  text: string;
  data?: any;
  suggestions?: string[];
  followUp?: string;
}

interface ValidationResult {
  needsMoreInfo: boolean;
  missingInfo: string[];
}

interface ProcessingResult {
  intent: Intent;
  context: Context;
  needsMoreInfo: boolean;
  suggestedResponse?: string;
}

interface EventPattern {
  type: 'transaction' | 'reminder' | 'category';
  pattern_data: any;
  confidence: number;
}

interface PatternDetectionResult {
  type: 'service_provider' | 'transaction' | 'multi_category';
  confidence: number;
  patterns: {
    frequency?: string;
    amounts?: number[];
    dates?: Date[];
    categories?: string[];
    relationships?: string[];
  }
}

interface ConversationState {
  currentTurn: number;
  previousIntent?: Intent;
  confirmedDetails: Map<string, any>;
  pendingQuestions: string[];
  context: Context;
}

interface RelationshipMap {
  primary: string;
  related: string[];
  type: 'payment' | 'attendance' | 'category' | 'time';
  strength: number;
}

export class ContextEngine {
  constructor(private userId: string) {}

  async processInput(input: string): Promise<ProcessingResult> {
    try {
      // 1. Detect Intent
      const intent = await this.detectIntent(input);

      // 2. Process with context
      const result = await this.processWithContext(intent, input);

      // 3. Store context if confident
      if (intent.confidence > 0.7) {
        await this.storeContext(result.context);
      }

      return result;

    } catch (error) {
      logger.error('Context processing error:', error);
      throw error;
    }
  }

  private async detectIntent(input: string): Promise<Intent> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Analyze the user input and detect the primary intent.
            Consider:
            - Transaction recording
            - Information queries
            - Reminder setting
            - Category management
            - Attendance tracking
            Return confidence level and any related contexts.`
          },
          { role: "user", content: input }
        ],
        response_format: { type: "json_object" }
      });

      // Handle potential null content
      if (!completion.choices[0].message?.content) {
        return {
          type: 'unknown',
          confidence: 0,
          relatedEvents: []
        };
      }

      const result = JSON.parse(completion.choices[0].message.content);
      
      return {
        type: this.validateIntentType(result.intentType),
        confidence: result.confidence || 0,
        category: result.category,
        action: result.action,
        relatedEvents: result.relatedEvents || []
      };
    } catch (error) {
      logger.error('Intent detection error:', error);
      return {
        type: 'unknown',
        confidence: 0,
        relatedEvents: []
      };
    }
  }

  private validateIntentType(type: string): IntentType {
    const validTypes: IntentType[] = [
      'transaction', 
      'query', 
      'reminder', 
      'category_creation', 
      'attendance'
    ];
    return validTypes.includes(type as IntentType) ? type as IntentType : 'unknown';
  }

  private async gatherContext(intent: Intent, input: string): Promise<Context> {
    try {
      // Get recent events
      const { data: recentEvents } = await supabase
        .from('transactions')
        .select(`
          *,
          context_logs (*)
        `)
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get related contexts
      const { data: relatedContexts } = await supabase
        .from('context_logs')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(3);

      // Get user preferences
      const { data: preferences } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      return {
        userId: this.userId,
        currentIntent: intent,
        recentEvents: recentEvents || [],
        relatedContexts: relatedContexts || [],
        userPreferences: preferences || {},
        timeContext: this.extractTimeContext(input),
        relatedEvents: intent.relatedEvents
      };
    } catch (error) {
      logger.error('Context gathering error:', error);
      throw error;
    }
  }

  private validateContext(context: Context): ValidationResult {
    const missingInfo: string[] = [];

    switch (context.currentIntent.type) {
      case 'transaction':
        if (!context.currentIntent.category) missingInfo.push('category');
        if (!context.timeContext?.referenceDate) missingInfo.push('date');
        break;
      case 'reminder':
        if (!context.timeContext?.referenceDate) missingInfo.push('due_date');
        break;
      case 'attendance':
        if (!context.timeContext?.referenceDate) missingInfo.push('work_date');
        break;
    }

    return {
      needsMoreInfo: missingInfo.length > 0,
      missingInfo
    };
  }

  private async storeContext(context: Context): Promise<void> {
    try {
      // Store the main context
      const { data: contextLog, error: contextError } = await supabase
        .from('context_logs')
        .insert({
          user_id: context.userId,
          context_type: context.currentIntent.type,
          context_data: {
            intent: context.currentIntent,
            related_events: context.recentEvents.map(e => e.id),
            time_context: context.timeContext,
            user_preferences: context.userPreferences
          },
          valid_from: new Date()
        })
        .select()
        .single();

      if (contextError) throw contextError;

      // Store any patterns detected
      if (context.currentIntent.type === 'transaction') {
        const pattern = await this.detectTransactionPattern(context);
        if (pattern) {
          await this.storePattern(pattern);
        }
      }

      // Update related events
      if (context.relatedEvents.length > 0) {
        await this.updateRelatedEvents(contextLog.id, context.relatedEvents);
      }

    } catch (error) {
      logger.error('Context storage error:', error);
      throw error;
    }
  }

  private async detectTransactionPattern(context: Context): Promise<EventPattern | null> {
    // Get recent transactions of same type
    const { data: similarTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', context.userId)
      .eq('category', context.currentIntent.category)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!similarTransactions?.length) return null;

    // Check for patterns
    const amounts = similarTransactions.map(t => t.amount);
    const dates = similarTransactions.map(t => new Date(t.created_at));
    
    // Calculate confidence based on consistency
    const amountVariance = Math.variance(amounts);
    const dateGaps = dates.slice(1).map((date, i) => 
      date.getTime() - dates[i].getTime()
    );
    const timeVariance = Math.variance(dateGaps);

    return {
      type: 'transaction',
      pattern_data: {
        category: context.currentIntent.category,
        average_amount: Math.mean(amounts),
        amount_variance: amountVariance,
        time_gaps: dateGaps,
        time_variance: timeVariance
      },
      confidence: calculateConfidence(amountVariance, timeVariance)
    };
  }

  private async updateRelatedEvents(contextId: string, eventIds: string[]) {
    await supabase
      .from('event_relationships')
      .insert(
        eventIds.map(eventId => ({
          primary_event_id: contextId,
          primary_event_type: 'context',
          related_event_id: eventId,
          related_event_type: 'transaction',
          relationship_type: 'context_reference',
          created_at: new Date()
        }))
      );
  }

  private async createRelationships(context: Context): Promise<void> {
    try {
      if (!context.currentIntent.relatedEvents?.length) return;

      const relationships = context.relatedEvents.map(relatedEvent => ({
        primary_event_id: context.currentIntent.relatedEvents[0],
        primary_event_type: context.currentIntent.type,
        related_event_id: relatedEvent,
        related_event_type: 'transaction',
        relationship_type: 'related',
        context: context.timeContext
      }));

      if (relationships.length > 0) {
        await supabase
          .from('event_relationships')
          .insert(relationships);
      }
    } catch (error) {
      logger.error('Relationship creation error:', error);
      throw error;
    }
  }

  private extractTimeContext(input: string): { 
    referenceDate: Date; 
    period?: string;
  } {
    const today = new Date();
    
    if (input.includes('today')) return { referenceDate: today };
    if (input.includes('yesterday')) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { referenceDate: yesterday };
    }
    if (input.includes('tomorrow')) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { referenceDate: tomorrow };
    }

    return { referenceDate: today };
  }

  private generateClarifyingQuestion(missingInfo: string[]): string {
    const questionMap: Record<string, string> = {
      category: "What category should this be filed under?",
      date: "When did this happen?",
      due_date: "When should I remind you?",
      work_date: "Which date are you referring to?",
      amount: "What was the amount?"
    };

    return questionMap[missingInfo[0]] || "Could you provide more details?";
  }

  async getContextForQuery(queryType: string): Promise<ContextLog | null> {
    try {
      const { data } = await supabase
        .from('context_logs')
        .select('*')
        .eq('user_id', this.userId)
        .eq('context_type', queryType)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return data;
    } catch (error) {
      logger.error('Query context error:', error);
      return null;
    }
  }

  private async storePattern(pattern: EventPattern) {
    await supabase.from('learning_patterns').insert({
      user_id: this.userId,
      pattern_type: pattern.type,
      pattern_data: pattern,
      confidence: pattern.confidence
    })
  }

  private async generateResponse(
    intent: Intent,
    context: Context,
    dbResults: any
  ): Promise<FormattedResponse> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a friendly financial assistant for senior citizens.
              Context:
              - User Intent: ${intent.type}
              - Recent Events: ${JSON.stringify(context.recentEvents)}
              - Patterns: ${JSON.stringify(dbResults.patterns)}
              - Time Context: ${JSON.stringify(context.timeContext)}
              
              Respond in a clear, concise way.
              Reference historical data when relevant.
              Be specific about dates and amounts.`
          },
          {
            role: "user",
            content: JSON.stringify({
              intent,
              context,
              dbResults
            })
          }
        ],
        response_format: { type: "json_object" }
      });

      if (!completion.choices[0].message?.content) {
        return {
          text: "I'm sorry, I couldn't process that. Could you please try again?"
        };
      }

      const result = JSON.parse(completion.choices[0].message.content);
      return {
        text: result.response,
        data: result.data,
        suggestions: result.suggestions,
        followUp: result.followUp
      };
    } catch (error) {
      logger.error('Response generation error:', error);
      return {
        text: "I'm having trouble generating a response. Please try again."
      };
    }
  }

  private async getRelevantData(intent: Intent, context: Context) {
    // Get transactions, patterns, etc. based on intent
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: patterns } = await supabase
      .from('learning_patterns')
      .select('*')
      .eq('user_id', this.userId)
      .limit(5);

    return {
      transactions,
      patterns,
      relationships: context.relatedEvents
    };
  }

  private async processWithContext(
    intent: Intent, 
    input: string
  ): Promise<ProcessingResult> {
    // Get relevant historical context
    const historicalContext = await this.getHistoricalContext(intent);
    
    // Process based on intent type
    switch (intent.type) {
      case 'query':
        return this.processQuery(input, historicalContext);
      case 'transaction':
        return this.processTransaction(input, historicalContext);
      case 'reminder':
        return this.processReminder(input, historicalContext);
      default:
        return this.processGeneral(input, historicalContext);
    }
  }

  private async getHistoricalContext(intent: Intent) {
    // Get relevant context logs
    const { data: contextLogs } = await supabase
      .from('context_logs')
      .select(`
        *,
        event_relationships (
          related_event_id,
          related_event_type
        )
      `)
      .eq('user_id', this.userId)
      .eq('context_type', intent.type)
      .order('created_at', { ascending: false })
      .limit(3);

    // Get referenced events
    const eventIds = contextLogs
      ?.flatMap(log => log.event_relationships)
      ?.map(rel => rel.related_event_id) || [];

    if (eventIds.length === 0) return null;

    const { data: events } = await supabase
      .from('transactions')
      .select('*')
      .in('id', eventIds);

    return {
      logs: contextLogs,
      events: events
    };
  }

  private async processQuery(
    input: string, 
    historicalContext: any
  ): Promise<ProcessingResult> {
    // Process query with historical context
    const response = await this.generateResponse(input, historicalContext);
    
    return {
      intent: this.currentIntent,
      context: this.context,
      needsMoreInfo: false,
      suggestedResponse: response
    };
  }

  private async detectServiceProviderPatterns(
    serviceProvider: string,
    timeRange: { start: Date; end: Date }
  ): Promise<PatternDetectionResult> {
    // Get attendance and payment records
    const { data: attendanceData } = await supabase
      .from('attendance_logs')
      .select(`
        date,
        present,
        notes,
        transactions (
          amount,
          date,
          category
        )
      `)
      .eq('service_type', serviceProvider)
      .gte('date', timeRange.start.toISOString())
      .lte('date', timeRange.end.toISOString());

    // Analyze patterns
    const workDays = this.analyzeWorkDays(attendanceData);
    const paymentPattern = this.analyzePayments(attendanceData);

    return {
      type: 'service_provider',
      confidence: this.calculatePatternConfidence(workDays, paymentPattern),
      patterns: {
        frequency: workDays.mostCommon,
        amounts: paymentPattern.amounts,
        dates: paymentPattern.dates,
        relationships: paymentPattern.relatedTransactions
      }
    };
  }

  private analyzeWorkDays(attendanceData: any[]): {
    mostCommon: string;
    regularity: number;
  } {
    // Group by day of week
    const dayCount = attendanceData.reduce((acc, record) => {
      const day = new Date(record.date).getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    // Find most common days
    const mostCommonDay = Object.entries(dayCount)
      .sort(([,a], [,b]) => b - a)[0][0];

    // Calculate regularity
    const totalDays = attendanceData.length;
    const regularity = dayCount[mostCommonDay] / totalDays;

    return {
      mostCommon: this.getDayName(parseInt(mostCommonDay)),
      regularity
    };
  }

  private analyzePayments(attendanceData: any[]): {
    amounts: number[];
    dates: Date[];
    relatedTransactions: string[];
  } {
    const payments = attendanceData
      .filter(record => record.transactions)
      .map(record => ({
        amount: record.transactions.amount,
        date: new Date(record.transactions.date),
        id: record.transactions.id
      }));

    return {
      amounts: payments.map(p => p.amount),
      dates: payments.map(p => p.date),
      relatedTransactions: payments.map(p => p.id)
    };
  }

  private async handleMultiTurnConversation(
    input: string,
    currentState: ConversationState
  ): Promise<ProcessingResult> {
    try {
      // Update turn count
      currentState.currentTurn += 1;

      // Check if this is a follow-up to a previous question
      if (currentState.pendingQuestions.length > 0) {
        const lastQuestion = currentState.pendingQuestions[0];
        const answer = await this.processAnswer(input, lastQuestion, currentState);
        
        if (answer.isValid) {
          currentState.confirmedDetails.set(answer.field, answer.value);
          currentState.pendingQuestions.shift();
        } else {
          // Re-ask the question with more context
          return {
            needsMoreInfo: true,
            context: currentState.context,
            suggestedResponse: this.reformulateQuestion(lastQuestion, currentState)
          };
        }
      }

      // Process new input with accumulated context
      const intent = await this.detectIntent(input);
      const combinedContext = this.mergePreviousContext(currentState.context, intent);
      
      // Check if we have all required information
      const { missingFields, questions } = this.validateRequiredFields(
        intent, 
        currentState.confirmedDetails
      );

      if (missingFields.length > 0) {
        currentState.pendingQuestions.push(...questions);
        return {
          needsMoreInfo: true,
          context: combinedContext,
          suggestedResponse: questions[0]
        };
      }

      // Process complete information
      return await this.processCompleteIntent(intent, combinedContext);

    } catch (error) {
      logger.error('Multi-turn conversation error:', error);
      throw error;
    }
  }

  private async processAnswer(
    input: string, 
    question: string, 
    state: ConversationState
  ): Promise<{ isValid: boolean; field?: string; value?: any }> {
    // Process based on question type
    if (question.includes('amount')) {
      const amount = this.extractAmount(input);
      return {
        isValid: !!amount,
        field: 'amount',
        value: amount
      };
    }
    
    if (question.includes('date')) {
      const date = this.extractDate(input);
      return {
        isValid: !!date,
        field: 'date',
        value: date
      };
    }

    // Add more answer type processing as needed
    return { isValid: false };
  }

  private async handleRelationships(
    currentItem: any,
    itemType: string
  ): Promise<RelationshipMap[]> {
    const relationships: RelationshipMap[] = [];

    // Time-based relationships
    const timeRelated = await this.findTimeBasedRelationships(currentItem);
    if (timeRelated.length > 0) {
      relationships.push({
        primary: currentItem.id,
        related: timeRelated,
        type: 'time',
        strength: 0.7
      });
    }

    // Category relationships
    if (itemType === 'transaction') {
      const categoryRelated = await this.findCategoryRelationships(currentItem);
      if (categoryRelated.length > 0) {
        relationships.push({
          primary: currentItem.id,
          related: categoryRelated,
          type: 'category',
          strength: 0.8
        });
      }
    }

    // Payment-Attendance relationships for service providers
    if (itemType === 'service_provider') {
      const attendancePayments = await this.linkAttendancePayments(currentItem);
      if (attendancePayments.length > 0) {
        relationships.push({
          primary: currentItem.id,
          related: attendancePayments,
          type: 'payment',
          strength: 0.9
        });
      }
    }

    return relationships;
  }

  private async findTimeBasedRelationships(item: any): Promise<string[]> {
    const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
    const itemDate = new Date(item.created_at).getTime();

    const { data } = await supabase
      .from('transactions')
      .select('id, created_at')
      .neq('id', item.id)
      .gte('created_at', new Date(itemDate - timeWindow).toISOString())
      .lte('created_at', new Date(itemDate + timeWindow).toISOString());

    return data?.map(d => d.id) || [];
  }

  private async findCategoryRelationships(transaction: any): Promise<string[]> {
    const { data } = await supabase
      .from('transactions')
      .select('id')
      .eq('category', transaction.category)
      .neq('id', transaction.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return data?.map(d => d.id) || [];
  }

  private async linkAttendancePayments(
    serviceProvider: any
  ): Promise<string[]> {
    // Get attendance records
    const { data: attendance } = await supabase
      .from('attendance_logs')
      .select('date')
      .eq('provider_id', serviceProvider.id)
      .eq('present', true)
      .order('date', { ascending: false });

    if (!attendance?.length) return [];

    // Find related payments
    const lastAttendance = new Date(attendance[0].date);
    const { data: payments } = await supabase
      .from('transactions')
      .select('id')
      .eq('service_provider_id', serviceProvider.id)
      .gte('created_at', lastAttendance.toISOString())
      .limit(1);

    return payments?.map(p => p.id) || [];
  }
}