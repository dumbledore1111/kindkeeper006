// File: lib/context-engine.ts

import { 
  processUserInput,
  processAIMessage as processAssistantMessage 
} from './input-processor';
import { EventProcessor } from './event-processor';
import type { 
  AIResponse, 
  ProcessingResult,
  Context,
  DatabaseOperation,
  Intent,
  RelationshipMap,
  BatchOperation,
  BatchOperationResult,
  LinkedOperation,
  ProcessingResult as AIProcessingResult,
  SpendingAnalysis,
  ServiceProviderAnalysis,
  AnalyticsResult,
  PatternDetectionResult,
  ConversationState,
  EventPattern,
  PredictionResult,
  QueryResponse,
  TransactionResponse,
  ReminderResponse,
  AttendanceResponse
} from '@/types/responses';
import { updateTransaction } from './transaction-updater';
import { QueryProcessor } from './processors/query-processor';
import { generateDetailedResponse } from './response-generator';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { logger } from './logger';
import { openai, SYSTEM_PROMPTS } from './openai';

type SystemPromptType = 'transaction' | 'attendance' | 'reminder' | 'query' | 'unknown';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

export class ContextEngine {
  private userId: string;
  private currentIntent: Intent;
  private context: Context;
  private queryProcessor: QueryProcessor;

  constructor(userId: string) {
    this.userId = userId;
    this.queryProcessor = new QueryProcessor(userId);
    this.currentIntent = {
      type: 'unknown',
      confidence: 0,
      relatedEvents: []
    };
    this.context = this.initializeContext(userId);
  }

  private initializeContext(userId: string): Context {
    return {
      userId,
      currentIntent: this.currentIntent,
      recentEvents: [],
      relatedContexts: [],
      relatedEvents: [],
      history: [],
      timeContext: {
        referenceDate: new Date()
      }
    };
  }

  // Service Provider Pattern Detection
  private async detectServiceProviderPatterns(
    serviceProvider: string,
    timeRange: { start: Date; end: Date }
  ): Promise<PatternDetectionResult> {
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

    if (!attendanceData) return this.createEmptyPatternResult();

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

  // Multi-turn Conversation Handling
  private async handleMultiTurnConversation(
    input: string,
    currentState: ConversationState
  ): Promise<ProcessingResult> {
    // Handle pending questions first
    if (currentState.pendingQuestions.length > 0) {
      const currentQuestion = currentState.pendingQuestions[0];
      const answer = await this.processAnswer(input, currentQuestion, currentState);

      if (answer.isValid) {
        // Update state with answer
        currentState.confirmedDetails.set(answer.field!, answer.value);
        currentState.pendingQuestions.shift();

        // Check if we have all needed info
        if (currentState.pendingQuestions.length === 0) {
          return this.processCompleteIntent(
            currentState.previousIntent!, 
            currentState.context
          );
        }

        // Ask next question
        return {
          success: true,
          response: currentState.pendingQuestions[0],
          context: currentState.context,
          intent: currentState.previousIntent!.type,
          needsMoreInfo: {
            type: 'question',
            context: currentState.pendingQuestions[0]
          }
        };
      }

      // Invalid answer - ask again
      return {
        success: false,
        response: this.reformulateQuestion(currentQuestion, currentState),
        context: currentState.context,
        intent: currentState.previousIntent!.type,
        needsMoreInfo: {
          type: 'invalid_answer',
          context: this.reformulateQuestion(currentQuestion, currentState)
        }
      };
    }

    // No pending questions - process as new input
    const intent = await this.detectIntent(input);
    const context = await this.gatherContext(intent, input);
    const { missingFields, questions } = this.validateRequiredFields(intent, context);

    if (missingFields.length > 0) {
      return {
        success: true,
        response: questions[0],
        context,
        intent: intent.type,
        needsMoreInfo: {
          type: 'missing_fields',
          context: questions[0]
        }
      };
    }

    return this.processCompleteIntent(intent, context);
  }

  // Helper methods for service provider analysis
  private analyzeWorkDays(attendanceData: any[]): {
    mostCommon: string;
    regularity: number;
  } {
    const dayCount = attendanceData.reduce((acc, record) => {
      const day = new Date(record.date).getDay();
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Type assertion for Object.entries result
    const entries = Object.entries(dayCount) as Array<[string, number]>;
    const sortedDays = entries
      .sort(([, a], [, b]) => b - a);

    if (sortedDays.length === 0) {
      return {
        mostCommon: '',
        regularity: 0
      };
    }

    const [mostCommonDay, count] = sortedDays[0];

    return {
      mostCommon: this.getDayName(parseInt(mostCommonDay)),
      regularity: count / attendanceData.length
    };
  }

  private analyzePayments(attendanceData: any[]): {
    amounts: number[];
    dates: Date[];
    relatedTransactions: string[];
  } {
    const payments = attendanceData
      .filter(record => record.transactions?.length > 0)
      .map(record => ({
        amount: record.transactions[0].amount,
        date: new Date(record.transactions[0].date),
        id: record.transactions[0].id
      }));
      
      return {
      amounts: payments.map(p => p.amount),
      dates: payments.map(p => p.date),
      relatedTransactions: payments.map(p => p.id)
    };
  }

  // Pattern Detection
  private async detectTransactionPattern(context: Context): Promise<EventPattern | null> {
    const { data: similarTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('category', context.currentIntent.category)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!similarTransactions?.length) return null;

    const amounts = similarTransactions.map(t => t.amount);
    const dates = similarTransactions.map(t => new Date(t.created_at));
    
    const amountVariance = this.calculateVariance(amounts);
    const dateGaps = this.calculateDateGaps(dates);
    const timeVariance = this.calculateVariance(dateGaps);
      
      return {
      type: 'transaction',
      pattern_data: {
        category: context.currentIntent.category,
        average_amount: this.calculateMean(amounts),
        amount_variance: amountVariance,
        time_gaps: dateGaps,
        time_variance: timeVariance
      },
      confidence: this.calculateConfidence(amountVariance, timeVariance)
    };
  }

  // Utility methods
  private calculateVariance(numbers: (number | null)[]): number {
    const validNumbers = numbers.filter((n): n is number => n !== null);
    if (validNumbers.length === 0) return 0;
    const mean = this.calculateMean(validNumbers);
    return validNumbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / validNumbers.length;
  }

  private calculateMean(numbers: (number | null)[]): number {
    const validNumbers = numbers.filter((n): n is number => n !== null);
    if (validNumbers.length === 0) return 0;
    return validNumbers.reduce((sum, num) => sum + num, 0) / validNumbers.length;
  }

  private calculateDateGaps(dates: Date[]): number[] {
    return dates.slice(1).map((date, i) => date.getTime() - dates[i].getTime());
  }

  private calculateConfidence(amountVariance: number, timeVariance: number): number {
    const amountConfidence = 1 - Math.min(amountVariance / 10000, 1);
    const timeConfidence = 1 - Math.min(timeVariance / (7 * 24 * 60 * 60 * 1000), 1);
    return (amountConfidence + timeConfidence) / 2;
  }

  private getDayName(dayIndex: number): string {
    return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
  }

  private createEmptyPatternResult(): PatternDetectionResult {
      return {
      type: 'service_provider',
        confidence: 0,
      patterns: {
        frequency: '',
        amounts: [],
        dates: [],
        relationships: []
      }
    };
  }

  // Relationship Management
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

    // Payment-Attendance relationships
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

  private async linkAttendancePayments(serviceProvider: any): Promise<string[]> {
    const { data: attendance } = await supabase
      .from('attendance_logs')
      .select('date')
      .eq('provider_id', serviceProvider.id)
      .eq('present', true)
      .order('date', { ascending: false });

    if (!attendance?.length) return [];

    const lastAttendance = new Date(attendance[0].date);
    const { data: payments } = await supabase
      .from('transactions')
      .select('id')
      .eq('service_provider_id', serviceProvider.id)
      .gte('created_at', lastAttendance.toISOString())
      .limit(1);

    return payments?.map(p => p.id) || [];
  }

  // Main processInput method
  async processInput(message: string, context?: Context): Promise<ProcessingResult> {
    try {
      const intentAnalysis = await this.detectIntent(message, context);
      
      const processedInput = await processUserInput(message, this.userId);

      const result = await this.routeToProcessor(
        intentAnalysis,
        {
          ...processedInput,
          entities: intentAnalysis.category ? { category: intentAnalysis.category } : undefined
        }
      );

      return intentAnalysis.confidence 
        ? {
            ...result,
            confidence: intentAnalysis.confidence
          }
        : result;

    } catch (error) {
      console.error('Context processing error:', error);
      throw error;
    }
  }

  private async storeRelationships(relationships: RelationshipMap[]): Promise<void> {
    for (const rel of relationships) {
      await supabase
        .from('event_relationships')
        .insert(
          rel.related.map(relatedId => ({
            primary_event_id: rel.primary,
            related_event_id: relatedId,
            relationship_type: rel.type,
            strength: rel.strength,
            created_at: new Date()
          }))
        );
    }
  }

  // Analytics Features
  private async analyzeSpendingPatterns(
    timeRange: { start: Date; end: Date }
  ): Promise<SpendingAnalysis> {
    const { data: transactions } = await supabase
        .from('transactions')
        .select(`
        category,
        amount,
        created_at,
        type
        `)
        .eq('user_id', this.userId)
      .eq('type', 'expense')
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString());

    if (!transactions?.length) return this.createEmptySpendingAnalysis();

    // Group by category
    const categoryAnalysis = transactions.reduce((acc, transaction) => {
      const category = transaction.category || 'uncategorized';
      if (!acc[category]) {
        acc[category] = {
          total: 0,
          count: 0,
          average: 0,
          highest: 0,
          lowest: Infinity,
          trend: 'stable'
        };
      }
      
      acc[category].total += transaction.amount;
      acc[category].count += 1;
      acc[category].highest = Math.max(acc[category].highest, transaction.amount);
      acc[category].lowest = Math.min(acc[category].lowest, transaction.amount);
      acc[category].average = acc[category].total / acc[category].count;
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate trends
    for (const category in categoryAnalysis) {
      categoryAnalysis[category].trend = await this.calculateTrend(category, timeRange);
    }

    return {
      categories: categoryAnalysis,
      total_spending: Object.values(categoryAnalysis).reduce((sum: number, cat: any) => sum + cat.total, 0),
      period: {
        start: timeRange.start,
        end: timeRange.end
      },
      insights: await this.generateSpendingInsights(categoryAnalysis)
    };
  }

  private async analyzeServiceProviderPatterns(
    serviceProviderId: string
  ): Promise<ServiceProviderAnalysis> {
    const { data: logs } = await supabase
      .from('attendance_logs')
      .select(`
        date,
        present,
        notes,
        transactions(amount, date)
      `)
      .eq('provider_id', serviceProviderId)
      .order('date', { ascending: false })
      .limit(30);

    if (!logs?.length) return this.createEmptyServiceProviderAnalysis();

    const attendanceRate = logs.filter(l => l.present).length / logs.length;
    const payments = logs
      .filter(l => l.transactions?.[0])
      .map(l => ({
        amount: l.transactions[0].amount,
        date: new Date(l.transactions[0].date)
      }));

    return {
      attendanceRate,
      paymentPattern: {
        average: this.calculateMean(payments.map(p => p.amount)),
        mostCommonDay: this.findMostCommonDay(logs),
        regularityScore: this.calculateRegularity(payments.map(p => p.date)),
        lastPayment: payments[0]?.date || null
      },
      workPattern: {
        regularDays: this.findRegularWorkDays(logs),
        consistency: this.calculateConsistency(logs),
        typicalDuration: this.calculateTypicalDuration(logs)
      },
      recommendations: await this.generateProviderRecommendations({
        attendanceRate,
        payments,
        logs
      })
    };
  }

  private async calculateTrend(
    category: string, 
    timeRange: { start: Date; end: Date }
  ): Promise<'increasing' | 'decreasing' | 'stable'> {
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, created_at')
      .eq('category', category)
      .gte('created_at', timeRange.start.toISOString())
      .lte('created_at', timeRange.end.toISOString())
      .order('created_at', { ascending: true });

    if (!transactions?.length) return 'stable';

    const amounts = transactions.map(t => t.amount);
    const trend = this.calculateTrendLine(amounts);
    
    if (trend > 0.1) return 'increasing';
    if (trend < -0.1) return 'decreasing';
    return 'stable';
  }

  private async generateSpendingInsights(
    categoryAnalysis: Record<string, any>
  ): Promise<string[]> {
    const insights: string[] = [];
    
    // Find highest spending category
    const highestCategory = Object.entries(categoryAnalysis)
      .sort(([, a], [, b]) => (b as any).total - (a as any).total)[0];
    
    insights.push(`Highest spending in ${highestCategory[0]}: ₹${highestCategory[1].total}`);

    // Find unusual patterns
    for (const [category, data] of Object.entries(categoryAnalysis)) {
      const { average, highest, trend } = data as any;
      if (highest > average * 2) {
        insights.push(`Unusual high spending in ${category}: ₹${highest}`);
      }
      if (trend === 'increasing') {
        insights.push(`${category} spending is trending upward`);
      }
    }

    return insights;
  }

  private findRegularWorkDays(logs: any[]): string[] {
    const dayCount = logs.reduce((acc, log) => {
      const day = new Date(log.date).getDay();
      if (log.present) acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    return (Object.entries(dayCount) as Array<[string, number]>)
      .filter(([, count]) => count > logs.length * 0.6)
      .map(([day]) => this.getDayName(parseInt(day)));
  }

  private calculateConsistency(logs: any[]): number {
    const expectedDays = new Set(this.findRegularWorkDays(logs).map(day => 
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].indexOf(day)
    ));

    const consistency = logs.reduce((acc, log) => {
      const day = new Date(log.date).getDay();
      return acc + (expectedDays.has(day) === log.present ? 1 : 0);
    }, 0);

    return consistency / logs.length;
  }

  private calculateTypicalDuration(logs: any[]): string {
    const durations = logs
      .filter(log => log.present && log.notes?.includes('duration:'))
      .map(log => {
        const match = log.notes.match(/duration:\s*(\d+)/);
        return match ? parseInt(match[1]) : null;
      })
      .filter(Boolean);

    if (!durations.length) return 'unknown';
    
    const avgDuration = this.calculateMean(durations);
    return `${Math.round(avgDuration)} minutes`;
  }

  private async generateProviderRecommendations(data: {
    attendanceRate: number;
    payments: Array<{ amount: number; date: Date }>;
    logs: any[];
  }): Promise<string[]> {
    const recommendations: string[] = [];

    if (data.attendanceRate < 0.8) {
      recommendations.push('Consider discussing attendance consistency');
    }

    const paymentGaps = data.payments
      .slice(1)
      .map((p, i) => p.date.getTime() - data.payments[i].date.getTime());
    
    const avgGap = this.calculateMean(paymentGaps);
    const expectedGap = 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    
    if (Math.abs(avgGap - expectedGap) > 5 * 24 * 60 * 60 * 1000) {
      recommendations.push('Payment schedule seems irregular');
    }

    return recommendations;
  }

  // Helper methods for analytics
  private createEmptySpendingAnalysis(): SpendingAnalysis {
    return {
      categories: {},
      total_spending: 0,
      period: {
        start: new Date(),
        end: new Date()
      },
      insights: []
    };
  }

  private createEmptyServiceProviderAnalysis(): ServiceProviderAnalysis {
    return {
      attendanceRate: 0,
      paymentPattern: {
        average: 0,
        mostCommonDay: '',
        regularityScore: 0,
        lastPayment: null
      },
      workPattern: {
        regularDays: [],
        consistency: 0,
        typicalDuration: 'unknown'
      },
      recommendations: []
    };
  }

  private calculateTrendLine(numbers: number[]): number {
    const n = numbers.length;
    if (n < 2) return 0;

    const xMean = (n - 1) / 2;
    const yMean = this.calculateMean(numbers);

    const numerator = numbers.reduce((sum, y, x) => sum + (x - xMean) * (y - yMean), 0);
    const denominator = numbers.reduce((sum, _, x) => sum + Math.pow(x - xMean, 2), 0);

    return denominator === 0 ? 0 : numerator / denominator;
  }

  async predictFutureExpenses(category: string): Promise<PredictionResult> {
    const historicalData = await this.getHistoricalData(category);
    const seasonalPattern = this.detectSeasonality(historicalData);
    const trend = this.calculateTrendLine(historicalData.amounts);

    return {
      nextMonth: {
        predicted: this.calculatePrediction(trend, seasonalPattern),
        confidence: this.calculatePredictionConfidence(historicalData),
        factors: this.identifyInfluencingFactors(category)
      },
      suggestions: await this.generateOptimizationSuggestions(category)
    };
  }

  private async getHistoricalData(category: string) {
      const { data } = await supabase
      .from('transactions')
      .select('amount, created_at')
      .eq('category', category)
      .order('created_at', { ascending: true });

    return {
      amounts: data?.map(d => d.amount) || [],
      dates: data?.map(d => new Date(d.created_at)) || []
    };
  }

  private async updateAnalytics(result: ProcessingResult): Promise<void> {
    try {
      const data = result.dbOperations?.[0]?.data;
      if (!data) return;

      switch (result.intent) {
        case 'transaction':
          await this.updateSpendingAnalytics(data);
          break;
        case 'attendance':
          await this.updateServiceProviderAnalytics(data);
          break;
        // ... other cases
      }
    } catch (error) {
      logger.error('Analytics update error:', error);
      throw error;
    }
  }

  private async updateSpendingAnalytics(transaction: any): Promise<void> {
    const analysis = await this.analyzeSpendingPatterns({
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    });
    
    await this.storeAnalytics('spending', analysis);
  }

  private async updateServiceProviderAnalytics(data: any): Promise<void> {
    try {
      const analysis = await this.analyzeServiceProviderPatterns(data.provider_id);
      
      // Store the analytics result
      await this.storeAnalytics('service_provider', {
        serviceProvider: analysis,
        timestamp: new Date()
      });

      // Update provider metrics
      await supabase
        .from('service_providers')
        .update({
          attendance_rate: analysis.attendanceRate,
          regularity_score: analysis.paymentPattern.regularityScore,
          last_payment: analysis.paymentPattern.lastPayment,
          updated_at: new Date()
        })
        .eq('id', data.provider_id);

    } catch (error) {
      logger.error('Service provider analytics update error:', error);
      throw error;
    }
  }

  private async storeAnalytics(type: string, data: any): Promise<void> {
    await supabase
      .from('analytics')
      .insert({
        type,
        data,
        created_at: new Date(),
        user_id: this.userId
      });
  }

  // Public methods for analytics access
  async getSpendingAnalytics(timeRange: { start: Date; end: Date }): Promise<SpendingAnalysis> {
    return this.analyzeSpendingPatterns(timeRange);
  }

  async getServiceProviderAnalytics(serviceProvider: string): Promise<ServiceProviderAnalysis> {
    const timeRange = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date()
    };
    const result = await this.detectServiceProviderPatterns(serviceProvider, timeRange);
    
    return {
      attendanceRate: result.patterns.frequency ? 0.8 : 0,
      paymentPattern: {
        average: this.calculateMean(result.patterns.amounts || []),
        mostCommonDay: result.patterns.frequency || '',
        regularityScore: result.confidence,
        lastPayment: result.patterns.dates?.[0] || null
      },
      workPattern: {
        regularDays: [],
        consistency: result.confidence,
        typicalDuration: 'unknown'
      },
      recommendations: []
    };
  }

  async getCurrentContext(): Promise<Context> {
    try {
      // Get current context from database
      const { data: contextData } = await supabase
        .from('contexts')
        .select('*')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (contextData) {
      return {
          userId: this.userId,
          currentIntent: contextData.current_intent || this.currentIntent,
          lastIntent: contextData.last_intent,
          lastQuery: contextData.last_query,
          history: contextData.history || [],
          currentTransaction: contextData.current_transaction,
          currentReminder: contextData.current_reminder,
          recentEvents: contextData.recent_events || [],
          relatedContexts: contextData.related_contexts || [],
          relatedEvents: contextData.related_events || [],
          timeContext: {
            referenceDate: new Date(contextData.reference_date || Date.now())
          }
        };
      }

      // Return default context if none exists
      return this.initializeContext(this.userId);
    } catch (error) {
      logger.error('Error getting current context:', error);
      // Return default context on error
      return this.initializeContext(this.userId);
    }
  }
  
  async updateContext(newContext: Partial<Context>): Promise<void> {
    // Update context in database
  }

  private calculatePatternConfidence(
    workDays: { mostCommon: string; regularity: number },
    paymentPattern: { amounts: number[]; dates: Date[]; relatedTransactions: string[] }
  ): number {
    // Calculate confidence based on work days regularity
    const workDayConfidence = workDays.regularity;

    // Calculate payment pattern confidence
    const paymentConfidence = paymentPattern.amounts.length > 0 
      ? this.calculatePaymentConfidence(paymentPattern.amounts, paymentPattern.dates)
      : 0;

    // Weight and combine confidences
    return (workDayConfidence * 0.6) + (paymentConfidence * 0.4);
  }

  private calculatePaymentConfidence(amounts: number[], dates: Date[]): number {
    if (amounts.length < 2) return 0;

    // Check amount consistency
    const amountVariance = this.calculateVariance(amounts);
    const amountConfidence = 1 - Math.min(amountVariance / 10000, 1);

    // Check timing consistency
    const dateGaps = this.calculateDateGaps(dates);
    const timeVariance = this.calculateVariance(dateGaps);
    const timeConfidence = 1 - Math.min(timeVariance / (7 * 24 * 60 * 60 * 1000), 1);

    return (amountConfidence + timeConfidence) / 2;
  }

  private async processAnswer(
    input: string,
    question: string,
    currentState: ConversationState
  ): Promise<{ isValid: boolean; field?: string; value?: any }> {
    try {
      // Process the answer based on the question type
      const questionType = this.getQuestionType(question);
      const processedValue = await this.validateAnswer(input, questionType);

      if (processedValue.isValid) {
        return {
          isValid: true,
          field: questionType,
          value: processedValue.value
        };
      }

      return { isValid: false };
    } catch (error) {
      logger.error('Answer processing error:', error);
      return { isValid: false };
    }
  }

  private mapQueryType(type: QueryResponse['type']): 'spending' | 'listing' | 'summary' {
    switch (type) {
      case 'expense_query':
      case 'income_query':
        return 'spending';
      case 'transaction_query':
        return 'listing';
      case 'balance_query':
      case 'complex':
        return 'summary';
      default:
        return 'summary';
    }
  }

  private async processCompleteIntent(
    intent: Intent,
    context: Context
  ): Promise<ProcessingResult> {
    try {
      // Process the complete intent with all required information
      const systemPrompt = SYSTEM_PROMPTS[intent.type];
      const aiResponse = await this.processWithAI(
        JSON.stringify({ intent, context }),
        systemPrompt
      );

      const dbOperations = await this.handleDatabaseOperations(intent, aiResponse);

      // Map AIResponse to the expected format for generateDetailedResponse
      const mappedResponse = {
        transaction: aiResponse.transaction,
        reminder: aiResponse.reminder,
        query: aiResponse.query ? {
          type: this.mapQueryType(aiResponse.query.type),
          data: [aiResponse.query],
          summary: this.generateQuerySummary(aiResponse.query)
        } : undefined,
        summary: aiResponse.suggestedResponse,
        suggestAction: this.getSuggestedAction(aiResponse)
      };

      // Generate user response with mapped response
      const response = await generateDetailedResponse(mappedResponse);

      return {
        success: true,
        response,
        context,
        intent: intent.type,
        dbOperations
      };
    } catch (error) {
      logger.error('Intent processing error:', error);
      throw error;
    }
  }

  private generateQuerySummary(query: QueryResponse): {
    total?: number;
    timeFrame: string;
    category?: string;
  } {
    switch (query.type) {
      case 'expense_query':
        return {
          timeFrame: query.time_period || 'all time',
          category: query.category,
          total: query.transaction?.amount
        };
      case 'income_query':
        return {
          timeFrame: query.time_period || 'all time',
          total: query.transaction?.amount
        };
      case 'transaction_query':
        return {
          timeFrame: query.time_period || 'all time',
          category: query.provider?.name
        };
      case 'balance_query':
        return {
          timeFrame: 'current',
          total: query.transaction?.amount
        };
      default:
        return {
          timeFrame: 'not specified'
        };
    }
  }

  private getSuggestedAction(response: AIResponse): 'confirm_payment' | undefined {
    if (response.transaction?.type === 'expense' && response.transaction.amount > 1000) {
      return 'confirm_payment';
    }
    return undefined;
  }

  private getQuestionType(question: string): string {
    // Extract the type of information being asked
    const typeMatches = {
      amount: /how much|amount|cost|price/i,
      date: /when|date|time|day/i,
      description: /what|describe|details/i,
      category: /category|type|kind/i
    };

    for (const [type, pattern] of Object.entries(typeMatches)) {
      if (pattern.test(question)) return type;
    }

    return 'unknown';
  }

  private async validateAnswer(
    input: string,
    type: string
  ): Promise<{ isValid: boolean; value?: any }> {
    switch (type) {
      case 'amount':
        const amount = this.extractAmount(input);
        return { isValid: !!amount, value: amount };

      case 'date':
        const date = this.extractDate(input);
        return { isValid: !!date, value: date };

      case 'category':
        const category = await this.validateCategory(input);
        return { isValid: !!category, value: category };

      default:
        return { isValid: true, value: input.trim() };
    }
  }

  private reformulateQuestion(question: string, state: ConversationState): string {
    // Add context to the question if it's being asked again
    const baseQuestion = question.replace(/^(please|could you|can you)/i, '').trim();
    return `I still need to know ${baseQuestion}. Could you please provide that information?`;
  }

  private async detectIntent(
    input: string,
    context?: Context
  ): Promise<Intent> {
    try {
      // First try OpenAI intent detection
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            {
              role: "system" as const,
              content: SYSTEM_PROMPTS.default
            },
            {
              role: "user" as const,
              content: input
            },
            ...(context ? [{
              role: "assistant" as const,
              content: `Previous context: ${JSON.stringify(context)}`
            }] : [])
          ],
          response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No response content from OpenAI');
        }

        const result = JSON.parse(content);
        return {
          type: result.intent as Intent['type'],
          confidence: result.confidence,
          relatedEvents: [],
          category: result.entities?.category
        };
      } catch (aiError) {
        logger.error('OpenAI intent detection failed, falling back to pattern matching:', aiError);
        
        // Fallback to existing pattern matching
        const previousIntent = context?.currentIntent;
        
        // Basic intent patterns with proper type
        const patterns: Record<Intent['type'], RegExp> = {
          transaction: /paid|spent|received|got|gave|payment/i,
          reminder: /remind|schedule|remember|alert/i,
          attendance: /present|absent|worked|leave|holiday/i,
          query: /how much|when|what|show|tell|analyze/i,
          unknown: /./i // Catch-all pattern
        };

        // Check for continuation of previous intent
        if (previousIntent && previousIntent.type !== 'unknown') {
          const isRelated = this.isRelatedToIntent(input, previousIntent);
          if (isRelated) {
            return {
              ...previousIntent,
              confidence: 0.9
            };
          }
        }

        // Detect new intent
        for (const [type, pattern] of Object.entries(patterns)) {
          if (pattern.test(input)) {
            return {
              type: type as Intent['type'],
              confidence: 0.8,
              relatedEvents: [],
              category: this.detectCategory(input)
            };
          }
        }

        return {
          type: 'unknown',
          confidence: 0.3,
          relatedEvents: []
        };
      }
    } catch (error) {
      logger.error('Intent detection error:', error);
      throw error;
    }
  }

  private async gatherContext(
    intent: Intent,
    input: string
  ): Promise<Context> {
    try {
      const context: Context = {
        userId: this.userId,
        currentIntent: intent,
        recentEvents: await this.getRecentEvents(intent),
        relatedContexts: await this.findRelatedContexts(intent),
        relatedEvents: [],
        history: [],
        timeContext: {
          referenceDate: this.extractTimeReference(input) || new Date()
        }
      };

      // Add related events based on intent type
      if (intent.type === 'transaction') {
        context.relatedEvents = await this.findRelatedTransactions(input);
      } else if (intent.type === 'attendance') {
        context.relatedEvents = await this.findRelatedAttendance(input);
      }

      return context;
    } catch (error) {
      logger.error('Context gathering error:', error);
      throw error;
    }
  }

  private validateRequiredFields(
    intent: Intent,
    context: Context
  ): { missingFields: string[]; questions: string[] } {
    const requiredFields = {
      transaction: ['amount', 'type', 'description'],
      reminder: ['title', 'due_date'],
      attendance: ['provider_type', 'status', 'date'],
      query: ['type']
    };

    const questions = {
      amount: 'How much was the amount?',
      type: 'Was this an expense or income?',
      description: 'What was this for?',
      title: 'What should I remind you about?',
      due_date: 'When do you want to be reminded?',
      provider_type: 'Which service provider are you referring to?',
      status: 'Were they present or absent?',
      date: 'Which date are you referring to?'
    };

    const required = requiredFields[intent.type as keyof typeof requiredFields] || [];
    const missingFields = required.filter(field => !this.hasField(context, field));
    
    return {
      missingFields,
      questions: missingFields.map(field => questions[field as keyof typeof questions])
    };
  }

  private hasField(context: Context, field: string): boolean {
    if (context.currentIntent.type === 'transaction') {
      return !!context.currentTransaction?.[field as keyof typeof context.currentTransaction];
    }
    if (context.currentIntent.type === 'reminder') {
      return !!context.currentReminder?.[field as keyof typeof context.currentReminder];
    }
    return false;
  }

  private isRelatedToIntent(input: string, previousIntent: Intent): boolean {
    // Check if input is related to previous intent
    const continuationPatterns = {
      transaction: /yes|no|correct|right|wrong|that's right|that's wrong/i,
      reminder: /yes|no|that's right|change|modify/i,
      attendance: /yes|no|actually|instead/i
    };

    return !!continuationPatterns[previousIntent.type as keyof typeof continuationPatterns]?.test(input);
  }

  private async processWithAI(
    input: string,
    systemPrompt: string
  ): Promise<AIResponse> {
    // Implementation for AI processing
    // This should use your OpenAI or similar service
    return {
      intent: 'general',
      confidence: 0.8,
      suggestedResponse: 'Default response'
    };
  }

  private async routeToProcessor(
    intent: Intent,
    processedInput: ProcessingResult
  ): Promise<ProcessingResult> {
    try {
      let result: ProcessingResult;
      
      switch (intent.type) {
        case 'query':
          // Convert string to QueryResponse
          const queryInput: QueryResponse = {
            type: 'complex',
            query: processedInput.response
          };
          result = await this.queryProcessor.processQuery(queryInput);
          break;

        case 'transaction':
          // Ensure transaction type is correct
          const transactionInput: TransactionResponse = {
            type: processedInput.entities?.type as 'expense' | 'income' || 'expense',
            amount: processedInput.entities?.amount || 0,
            description: processedInput.response,
            category: processedInput.entities?.category,
            date: processedInput.entities?.date || new Date().toISOString()
          };
          result = await this.processTransaction(transactionInput);
          break;

        case 'reminder':
          // Properly type reminder input
          const reminderInput: ReminderResponse = {
            title: processedInput.response,
            due_date: processedInput.entities?.date || new Date().toISOString(),
            type: processedInput.entities?.type as "bill_payment" | "medicine" | "appointment" | "service_payment" | "other" | undefined,
            amount: processedInput.entities?.amount,
            priority: 'medium'
          };
          result = await this.processReminder(reminderInput);
          break;

        case 'attendance':
          // Properly type attendance input
          const attendanceInput: AttendanceResponse = {
            provider_type: 'maid',
            name: processedInput.entities?.name || '',
            status: processedInput.entities?.status as 'present' | 'absent' || 'present',
            date: processedInput.entities?.date || new Date().toISOString(),
            extra_info: processedInput.response
          };
          result = await this.processAttendance(attendanceInput);
          break;

        default:
          result = {
            success: true,
            response: processedInput.response,
            context: this.context,
            intent: intent.type
          };
      }

      return result;
    } catch (error) {
      logger.error('Processor routing error:', error);
      return {
        success: false,
        response: 'Sorry, I had trouble processing that request.',
        context: this.context,
        intent: intent.type,
        needsMoreInfo: {
          type: 'error',
          context: 'Processing error occurred'
        }
      };
    }
  }

  private async updateContextAndRelationships(
    currentContext: Context | undefined,
    result: ProcessingResult
  ): Promise<Context> {
    const updatedContext = {
      ...this.context,
      ...currentContext,
      lastIntent: result.intent,
      history: [
        ...(currentContext?.history || []),
        {
          isUser: false,
          content: result.response,
          timestamp: new Date().toISOString()
        }
      ]
    };

    if (result.dbOperations?.length) {
      const relationships = await this.handleRelationships(
        result.dbOperations[0].data,
        result.intent
      );
      await this.storeRelationships(relationships);
    }

    return updatedContext;
  }

  private findMostCommonDay(logs: any[]): string {
    const dayCount = logs.reduce((acc, log) => {
      if (log.present) {
        const day = new Date(log.date).getDay();
        acc[day] = (acc[day] || 0) + 1;
      }
      return acc;
    }, {} as Record<number, number>);

    if (Object.keys(dayCount).length === 0) return '';

    // Type assertion for Object.entries result
    const entries = Object.entries(dayCount) as Array<[string, number]>;
    const sortedEntries = entries
      .sort(([, a], [, b]) => b - a);

    const [mostCommonDay] = sortedEntries[0];

    return this.getDayName(parseInt(mostCommonDay));
  }

  private calculateRegularity(dates: Date[]): number {
    if (dates.length < 2) return 0;

    // Calculate gaps between dates
    const gaps = dates
      .slice(1)
      .map((date, i) => date.getTime() - dates[i].getTime());

    // Calculate variance in gaps
    const variance = this.calculateVariance(gaps);
    
    // Convert variance to regularity score (0-1)
    // Lower variance means higher regularity
    const maxVariance = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const regularity = 1 - Math.min(variance / maxVariance, 1);

    return regularity;
  }

  private detectSeasonality(data: { amounts: number[]; dates: Date[] }): number {
    if (data.amounts.length < 12) return 0;

    // Group amounts by month
    const monthlyAverages = data.amounts.reduce((acc, amount, i) => {
      const month = data.dates[i].getMonth();
      if (!acc[month]) {
        acc[month] = { sum: 0, count: 0 };
      }
      acc[month].sum += amount;
      acc[month].count += 1;
      return acc;
    }, {} as Record<number, { sum: number; count: number }>);

    // Calculate monthly patterns
    const monthlyPattern = Object.values(monthlyAverages)
      .map(({ sum, count }) => sum / count);

    // Calculate variance in monthly pattern
    const variance = this.calculateVariance(monthlyPattern);
    
    // Return seasonality strength (0-1)
    return Math.min(variance / 10000, 1);
  }

  private calculatePrediction(trend: number, seasonality: number): number {
    const lastAmount = this.context.currentTransaction?.amount || 0;
    const seasonalFactor = 1 + (seasonality * 0.1); // Max 10% seasonal adjustment
    const trendFactor = 1 + (trend * 0.05); // Max 5% trend adjustment
    
    return lastAmount * seasonalFactor * trendFactor;
  }

  private calculatePredictionConfidence(data: { amounts: number[]; dates: Date[] }): number {
    if (data.amounts.length < 3) return 0.3; // Low confidence with limited data

    // Factors affecting confidence
    const dataPoints = Math.min(data.amounts.length / 12, 1); // More data = higher confidence
    const variance = Math.min(this.calculateVariance(data.amounts) / 10000, 1);
    const regularity = this.calculateRegularity(data.dates);

    // Weight and combine factors
    return (dataPoints * 0.4) + ((1 - variance) * 0.3) + (regularity * 0.3);
  }

  private identifyInfluencingFactors(category: string): string[] {
    const factors: string[] = [];
    const transaction = this.context.currentTransaction;

    if (transaction?.amount) {  // Null check with optional chaining
      const recentAmounts = this.getRecentAmounts(category);
      if (recentAmounts.length > 0) {
        const mean = this.calculateMean(recentAmounts);
        if (transaction.amount > mean) {
          factors.push('Higher than usual spending');
        }
      }
      
      const seasonalPattern = this.detectSeasonality({
        amounts: this.getRecentAmounts(category),
        dates: this.getRecentDates(category)
      });
      if (seasonalPattern > 0.5) {
        factors.push('Strong seasonal pattern detected');
      }
    }

    return factors;
  }

  private async generateOptimizationSuggestions(category: string): Promise<string[]> {
    const suggestions: string[] = [];
    const recentTransactions = await this.getHistoricalData(category);

    // Analyze spending patterns
    const avgAmount = this.calculateMean(recentTransactions.amounts);
    const trend = this.calculateTrendLine(recentTransactions.amounts);

    if (trend > 0.1) {
      suggestions.push(`${category} expenses are trending upward. Consider reviewing spending in this category.`);
    }

    if (recentTransactions.amounts.some(amount => amount > avgAmount * 1.5)) {
      suggestions.push(`Some ${category} expenses are significantly higher than average. Look for cost-saving opportunities.`);
    }

    return suggestions;
  }

  private getRecentAmounts(category: string): number[] {
    // Implementation to get recent transaction amounts for category
    return [];
  }

  private getRecentDates(category: string): Date[] {
    // Implementation to get recent transaction dates for category
    return [];
  }

  private async handleDatabaseOperations(
    intent: Intent,
    aiResponse: AIResponse
  ): Promise<Array<{
    table: string;
    operation: string;
    data: Record<string, any>;
  }>> {
    const operations: Array<{
      table: string;
      operation: string;
      data: Record<string, any>;
    }> = [];

    try {
      switch (intent.type) {
        case 'transaction':
          if (aiResponse.transaction) {
            operations.push({
              table: 'transactions',
              operation: 'insert',
              data: {
                ...aiResponse.transaction,
                user_id: this.userId,
                created_at: new Date()
              }
            });
          }
          break;

        case 'attendance':
          if (aiResponse.attendance) {
            operations.push({
              table: 'attendance_logs',
              operation: 'insert',
              data: {
                ...aiResponse.attendance,
                user_id: this.userId,
                created_at: new Date()
              }
            });
          }
          break;

        case 'reminder':
          if (aiResponse.reminder) {
            operations.push({
              table: 'reminders',
              operation: 'insert',
              data: {
                ...aiResponse.reminder,
                user_id: this.userId,
                created_at: new Date(),
                status: 'PENDING'
              }
            });
          }
          break;
      }

      // Execute operations
      for (const op of operations) {
        await supabase
          .from(op.table)
          .insert(op.data);
      }

      return operations;
    } catch (error) {
      logger.error('Database operation error:', error);
      throw error;
    }
  }

  private extractAmount(input: string): number | null {
    // Match numbers with optional decimal places and optional currency symbols
    const amountMatch = input.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:,\d+)*(?:\.\d{1,2})?)/i);
    if (!amountMatch) return null;

    // Remove commas and convert to number
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    return isNaN(amount) ? null : amount;
  }

  private extractDate(input: string): Date | null {
    try {
      // Handle relative dates
      if (/today|now/i.test(input)) {
        return new Date();
      }
      if (/yesterday/i.test(input)) {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        return date;
      }
      if (/tomorrow/i.test(input)) {
        const date = new Date();
        date.setDate(date.getDate() + 1);
        return date;
      }

      // Handle specific date formats
      const dateMatch = input.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(?:,?\s*(\d{4}))?/i);
      if (dateMatch) {
        const [, day, month, year] = dateMatch;
        const monthIndex = new Date(Date.parse(`${month} 1, 2000`)).getMonth();
        return new Date(
          parseInt(year || new Date().getFullYear().toString()),
          monthIndex,
          parseInt(day)
        );
      }

      return null;
    } catch (error) {
      logger.error('Date extraction error:', error);
      return null;
    }
  }

  private async validateCategory(input: string): Promise<string | null> {
    // Predefined categories
    const categories = [
      'groceries',
      'utilities',
      'rent',
      'transportation',
      'healthcare',
      'entertainment',
      'dining',
      'shopping',
      'education',
      'services'
    ];

    // Clean and normalize input
    const normalizedInput = input.toLowerCase().trim();

    // Direct match
    if (categories.includes(normalizedInput)) {
      return normalizedInput;
    }

    // Fuzzy match
    for (const category of categories) {
      if (this.calculateSimilarity(normalizedInput, category) > 0.8) {
        return category;
      }
    }

    // Check database for custom categories
    const { data: customCategories } = await supabase
      .from('categories')
      .select('name')
      .eq('user_id', this.userId);

    if (customCategories?.some(cat => 
      this.calculateSimilarity(normalizedInput, cat.name.toLowerCase()) > 0.8
    )) {
      return normalizedInput;
    }

    return null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) matrix[i][0] = i;
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const maxLen = Math.max(len1, len2);
    return 1 - matrix[len1][len2] / maxLen;
  }

  private detectCategory(input: string): string | undefined {
    // Category patterns
    const categoryPatterns = {
      groceries: /groceries|food|vegetables|fruits|supermarket/i,
      utilities: /electricity|water|gas|internet|phone|utility|bill/i,
      rent: /rent|house|apartment|flat|accommodation/i,
      transportation: /transport|travel|bus|train|taxi|auto|fuel|petrol/i,
      healthcare: /health|medical|doctor|medicine|hospital|clinic/i,
      entertainment: /movie|entertainment|fun|game|sport/i,
      dining: /restaurant|dining|cafe|food|lunch|dinner/i,
      shopping: /shopping|clothes|dress|shoes|accessories/i,
      education: /education|school|college|tuition|course|books/i,
      services: /service|maid|driver|gardener|cleaning|maintenance/i
    };

    // Check each category pattern
    for (const [category, pattern] of Object.entries(categoryPatterns)) {
      if (pattern.test(input)) {
        return category;
      }
    }

    // Check for service provider names which indicate service category
    const serviceProviderPattern = /maid|driver|nurse|gardener|watchman|milkman|physiotherapist/i;
    if (serviceProviderPattern.test(input)) {
      return 'services';
    }

    return undefined;
  }

  private async getRecentEvents(intent: Intent): Promise<any[]> {
    try {
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', this.userId)
        .eq('type', intent.type)
        .order('created_at', { ascending: false })
        .limit(5);

      return events || [];
    } catch (error) {
      logger.error('Error getting recent events:', error);
      return [];
    }
  }

  private async findRelatedContexts(intent: Intent): Promise<any[]> {
    try {
      const { data: contexts } = await supabase
        .from('contexts')
        .select('*')
        .eq('user_id', this.userId)
        .eq('intent_type', intent.type)
        .order('created_at', { ascending: false })
        .limit(3);

      return contexts || [];
    } catch (error) {
      logger.error('Error finding related contexts:', error);
      return [];
    }
  }

  private extractTimeReference(input: string): Date | null {
    // Match time-related keywords
    const timeKeywords = {
      today: 0,
      yesterday: -1,
      tomorrow: 1,
      'last week': -7,
      'next week': 7,
      'last month': -30,
      'next month': 30
    };

    for (const [keyword, days] of Object.entries(timeKeywords)) {
      if (input.toLowerCase().includes(keyword)) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
      }
    }

    // Try to extract specific date if no keywords found
    return this.extractDate(input);
  }

  private async findRelatedTransactions(input: string): Promise<string[]> {
    try {
      // Extract potential identifiers from input
      const amount = this.extractAmount(input);
      const category = this.detectCategory(input);
      const date = this.extractDate(input);

      // Build query
      let query = supabase
        .from('transactions')
        .select('id')
        .eq('user_id', this.userId)
        .limit(5);

      // Add filters based on available information
      if (amount) {
        query = query.eq('amount', amount);
      }
      if (category) {
        query = query.eq('category', category);
      }
      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
        query = query
          .gte('created_at', startDate.toISOString())
          .lt('created_at', endDate.toISOString());
      }

      const { data } = await query;
      return data?.map(t => t.id) || [];

    } catch (error) {
      logger.error('Error finding related transactions:', error);
      return [];
    }
  }

  private async findRelatedAttendance(input: string): Promise<string[]> {
    try {
      // Extract service provider information
      const providerMatch = input.match(/(?:maid|driver|nurse|gardener|watchman|milkman|physiotherapist)\s+(\w+)/i);
      const providerName = providerMatch?.[1];
      const date = this.extractDate(input);

      // Build query
      let query = supabase
        .from('attendance_logs')
        .select('id')
        .eq('user_id', this.userId)
        .limit(5);

      // Add filters based on available information
      if (providerName) {
        query = query.ilike('provider_name', `%${providerName}%`);
      }
      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        endDate.setDate(endDate.getDate() + 1);
        query = query
          .gte('date', startDate.toISOString())
          .lt('date', endDate.toISOString());
      }

      const { data } = await query;
      return data?.map(a => a.id) || [];

    } catch (error) {
      logger.error('Error finding related attendance:', error);
      return [];
    }
  }

  private async processTransaction(transaction: TransactionResponse): Promise<ProcessingResult> {
    try {
      if (!transaction.amount) {
        throw new Error('Transaction amount is required');
      }

      // Process transaction data
      const dbOperation = {
        table: 'transactions',
        operation: 'insert',
        data: {
          ...transaction,
          user_id: this.userId,
          created_at: new Date()
        }
      };

      // Execute database operation
        await supabase
        .from('transactions')
        .insert(dbOperation.data);

      return {
        success: true,
        response: `Transaction recorded: ${transaction.type} of ₹${transaction.amount} for ${transaction.description || 'unspecified purpose'}`,
        context: this.context,
        intent: 'transaction',
        dbOperations: [dbOperation]
      };
    } catch (error) {
      logger.error('Transaction processing error:', error);
      throw error;
    }
  }

  private async processReminder(reminder: ReminderResponse): Promise<ProcessingResult> {
    try {
      // Process reminder data
      const dbOperation = {
        table: 'reminders',
        operation: 'insert',
        data: {
          ...reminder,
          user_id: this.userId,
          created_at: new Date(),
          status: 'PENDING'
        }
      };

      // Execute database operation
      await supabase
        .from('reminders')
        .insert(dbOperation.data);

      return {
        success: true,
        response: `Reminder set for ${reminder.title} on ${reminder.due_date}`,
        context: this.context,
        intent: 'reminder',
        dbOperations: [dbOperation]
      };
    } catch (error) {
      logger.error('Reminder processing error:', error);
      throw error;
    }
  }

  private async processAttendance(attendance: AttendanceResponse): Promise<ProcessingResult> {
    try {
      // Process attendance data
      const dbOperation = {
        table: 'attendance_logs',
        operation: 'insert',
        data: {
          ...attendance,
          user_id: this.userId,
          created_at: new Date()
        }
      };

      // Execute database operation
      await supabase
        .from('attendance_logs')
        .insert(dbOperation.data);

      return {
        success: true,
        response: `Attendance recorded for ${attendance.provider_type} ${attendance.name}: ${attendance.status}`,
        context: this.context,
        intent: 'attendance',
        dbOperations: [dbOperation]
      };
    } catch (error) {
      logger.error('Attendance processing error:', error);
      throw error;
    }
  }

  private async handleComplexQuery(
    query: string | QueryResponse,
    context?: Context
  ): Promise<ProcessingResult> {
    try {
      // Handle text-based complex query
      if (typeof query === 'string') {
        const aiResponse = await processAssistantMessage(this.userId, query);
        return {
          success: true,
          response: typeof aiResponse === 'string' ? aiResponse : aiResponse.suggestedResponse,
          context: {
            userId: this.userId,
            currentIntent: {
              type: 'query',
              confidence: 0.8,
              relatedEvents: []
            },
            lastIntent: 'query',
            lastQuery: { type: 'complex' as const, query },
            history: context?.history || [],
            currentTransaction: context?.currentTransaction,
            currentReminder: context?.currentReminder,
            recentEvents: [],
            relatedContexts: [],
            relatedEvents: [],
            timeContext: {
              referenceDate: new Date()
            }
          },
          intent: 'query'
        };
      }

      // Handle QueryResponse
      const timeRange = this.parseTimeRange(query.time_period || 'this month');
      const [expenses, income, balance] = await Promise.all([
        this.getExpenses(timeRange.start, timeRange.end),
        this.getIncome(timeRange.start, timeRange.end),
        this.getBalance(timeRange.start, timeRange.end)
      ]);

      return {
        success: true,
        response: this.formatComplexResponse({
          expenses,
          income,
          balance,
          period: query.time_period || 'this month'
        }),
        context: this.context,
        intent: 'query'
      };

    } catch (error) {
      logger.error('Complex query processing error:', error);
      throw error;
    }
  }

  private parseTimeRange(timePeriod: string): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    switch (timePeriod.toLowerCase()) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'this week':
        start.setDate(now.getDate() - now.getDay());
        end.setDate(start.getDate() + 6);
        break;
      case 'this month':
        start.setDate(1);
        end.setMonth(start.getMonth() + 1, 0);
        break;
      case 'last month':
        start.setMonth(start.getMonth() - 1, 1);
        end.setMonth(start.getMonth() + 1, 0);
        break;
      case 'last 3 months':
        start.setMonth(start.getMonth() - 3);
        break;
      default:
        // Default to last 30 days
        start.setDate(now.getDate() - 30);
    }

    return { start, end };
  }

  private async getExpenses(
    start: Date,
    end: Date,
    category?: string
  ): Promise<any[]> {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('type', 'expense')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (category) {
      query = query.eq('category', category);
    }

    const { data } = await query;
    return data || [];
  }

  private async getIncome(
    start: Date,
    end: Date
  ): Promise<any[]> {
      const { data } = await supabase
      .from('transactions')
        .select('*')
        .eq('user_id', this.userId)
      .eq('type', 'income')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    return data || [];
  }

  private async getBalance(
    start: Date,
    end: Date
  ): Promise<{ balance: number; income: number; expenses: number }> {
    const [income, expenses] = await Promise.all([
      this.getIncome(start, end),
      this.getExpenses(start, end)
    ]);

    const totalIncome = income.reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      balance: totalIncome - totalExpenses,
      income: totalIncome,
      expenses: totalExpenses
    };
  }

  private formatComplexResponse(data: {
    expenses: any[];
    income: any[];
    balance: { balance: number; income: number; expenses: number };
    period: string;
  }): string {
    return `Analysis for ${data.period}:\n` +
      `Income: ₹${data.balance.income}\n` +
      `Expenses: ₹${data.balance.expenses}\n` +
      `Balance: ₹${data.balance.balance}`;
  }
}