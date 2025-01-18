import { supabase } from '@/lib/supabase';
import { queryCache } from '@/lib/queryCache';
import { processChatCompletion, processAssistantMessage } from '@/lib/openai';
import { generateQueryResponse } from '@/lib/response-generator';
import type { 
  QueryResponse, 
  ProcessingResult, 
  Context,
  TransactionResponse,
  QueryType 
} from '@/types/responses';
import type { CategoryType } from '@/types/database';
import { ContextEngine } from '../context-engine';
import type { SpendingAnalysis, AnalyticsResult } from '@/types/responses';
import { logger } from '../logger';

// System prompt for OpenAI
const SYSTEM_PROMPT = `You are a financial assistant for senior citizens in India.
Extract transaction details from their natural speech.

Examples:
Input: "gave the maid two thousand yesterday"
Output: {
  "transaction": {
    "amount": 2000,
    "type": "expense",
    "description": "maid payment",
    "service_provider": {
      "type": "maid",
      "frequency": "monthly"
    }
  }
}`;

export class QueryProcessor {
  private contextEngine: ContextEngine;

  constructor(private userId: string) {
    this.contextEngine = new ContextEngine(userId);
  }

  // Main entry point - handles both text and structured queries
  async process(
    input: string | QueryResponse, 
    context?: Context
  ): Promise<ProcessingResult> {
    try {
      // Handle text-based queries
      if (typeof input === 'string') {
        if (this.isSimpleQuery(input)) {
          return this.handleSimpleQuery(input, context);
        }
        return this.handleComplexQuery(input, context);
      }

      // Handle structured queries
      return this.handleStructuredQuery(input, context);
    } catch (error) {
      console.error('Query processing error:', error);
      throw error;
    }
  }

  // Text query handlers
  private async handleSimpleQuery(
    query: string, 
    context?: Context
  ): Promise<ProcessingResult> {
    const timeFrame = this.extractTimeFrame(query);
    const category = this.extractCategory(query);
    const timeRange = this.parseTimeRange(timeFrame);

    // Try cache first
    const cacheKey = `query_${timeRange.start}_${timeRange.end}_${category}`;
    const cached = await queryCache.get<ProcessingResult>(cacheKey);
    if (cached) {
      return cached as ProcessingResult;
    }

    // Process based on query pattern
    if (query.includes('how much') || query.includes('spent')) {
      return this.handleSpendingQuery(query, timeRange, category, context);
    } else if (query.includes('list') || query.includes('show')) {
      return this.handleListingQuery(query, timeRange, context);
    } else {
      return this.handleSummaryQuery(query, timeRange, context);
    }
  }

  private async handleComplexQuery(
    query: string | QueryResponse,
    context?: Context
  ): Promise<ProcessingResult | any> {
    try {
      // Handle text-based complex query
      if (typeof query === 'string') {
        const aiResponse = await processAssistantMessage(this.userId, query);
        return {
          success: true,
          response: aiResponse,
          context: {
            lastIntent: 'query',
            lastQuery: { type: 'complex' as const, query },
            history: context?.history || [],
            currentTransaction: context?.currentTransaction,
            currentReminder: context?.currentReminder
          },
          intent: 'query'
        };
      }

      // Handle structured complex query
      const timeRange = this.parseTimeRange(query.time_period);
      const [expenses, income, balance] = await Promise.all([
        this.getExpenses(timeRange.start, timeRange.end),
        this.getIncome(timeRange.start, timeRange.end),
        this.getBalance(timeRange.start, timeRange.end)
      ]);

      return {
        expenses,
        income,
        balance,
        period: query.time_period
      };
    } catch (error) {
      logger.error('Complex query processing error:', error);
      throw error;
    }
  }

  // Structured query handler
  private async handleStructuredQuery(
    aiResponse: QueryResponse, 
    context?: Context
  ): Promise<ProcessingResult> {
    const timeRange = this.parseTimeRange(aiResponse.time_period);
    let queryResult;

    switch (aiResponse.type) {
      case 'expense_query':
        queryResult = await this.getExpenses(timeRange.start, timeRange.end, aiResponse.category);
        break;
      case 'income_query':
        queryResult = await this.getIncome(timeRange.start, timeRange.end);
        break;
      case 'transaction_query':
        queryResult = await this.getTransactions(timeRange.start, timeRange.end, aiResponse.provider);
        break;
      case 'balance_query':
        queryResult = await this.getBalance(timeRange.start, timeRange.end);
        break;
    }

    const response = generateQueryResponse({
      query: aiResponse,
      result: queryResult
    });

    // Create a complete Context object
    const updatedContext: Context = {
      userId: this.userId,
      currentIntent: {
        type: 'query',
        confidence: 0.9,
        relatedEvents: []
      },
      lastIntent: 'query',
      lastQuery: aiResponse,
      history: context?.history || [],
      currentTransaction: context?.currentTransaction,
      currentReminder: context?.currentReminder,
      recentEvents: [],
      relatedContexts: [],
      relatedEvents: [],
      timeContext: {
        referenceDate: new Date()
      }
    };

    return {
      success: true,
      response,
      context: updatedContext,
      intent: 'query',
      dbOperations: []
    };
  }

  // Keep all existing helper methods...
  private isSimpleQuery(query: string): boolean {
    const simplePatterns = ['how much', 'show me', 'list', 'total'];
    return simplePatterns.some(pattern => 
      query.toLowerCase().includes(pattern)
    );
  }

  // Keep all existing data fetching methods...
  private async getExpenses(
    start: Date,
    end: Date,
    category?: string
  ): Promise<TransactionResponse[]> {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('type', 'expense')
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    return data?.map(d => d as TransactionResponse) || [];
  }

  private async getIncome(
    start: Date,
    end: Date
  ): Promise<TransactionResponse[]> {
    const cacheKey = `income_${start.toISOString()}_${end.toISOString()}`;
    const cached = await queryCache.get<TransactionResponse[]>(cacheKey);
    
    if (cached) {
      return cached as TransactionResponse[];
    }

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('type', 'income')
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    if (data) {
      await queryCache.set(cacheKey, data);
    }

    return data || [];
  }

  private async getTransactions(
    start: Date,
    end: Date,
    provider?: { type: string; name?: string }
  ): Promise<TransactionResponse[]> {
    const cacheKey = `transactions_${start.toISOString()}_${end.toISOString()}_${provider?.type}_${provider?.name}`;
    const cached = await queryCache.get<TransactionResponse[]>(cacheKey);

    if (cached) {
      return cached as TransactionResponse[];
    }

    let query = supabase
      .from('transactions')
      .select(`
        *,
        service_providers (
          type,
          name
        )
      `)
      .eq('user_id', this.userId)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    if (provider) {
      query = query
        .eq('service_providers.type', provider.type);
      if (provider.name) {
        query = query.eq('service_providers.name', provider.name);
      }
    }

    const { data } = await query;
    
    if (data) {
      await queryCache.set(cacheKey, data);
    }

    return data || [];
  }

  private async getBalance(
    start: Date,
    end: Date
  ): Promise<{
    income: number;
    expenses: number;
    balance: number;
    transactions: TransactionResponse[];
  }> {
    const cacheKey = `balance_${start.toISOString()}_${end.toISOString()}`;
    const cached = await queryCache.get<{
      income: number;
      expenses: number;
      balance: number;
      transactions: TransactionResponse[];
    }>(cacheKey);

    if (cached) {
      return cached;
    }

    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.userId)
      .gte('date', start.toISOString())
      .lte('date', end.toISOString());

    const result = (transactions || []).reduce((acc, t) => ({
      income: acc.income + (t.type === 'income' ? t.amount : 0),
      expenses: acc.expenses + (t.type === 'expense' ? t.amount : 0),
      transactions: [...acc.transactions, t]
    }), {
      income: 0,
      expenses: 0,
      transactions: [] as TransactionResponse[]
    });

    const balance = result.income - result.expenses;
    const finalResult = { ...result, balance };
    
    await queryCache.set(cacheKey, finalResult);
    return finalResult;
  }

  private extractTimeFrame(query: string): string {
    const timeFrames = {
      'this month': /this month/i,
      'last month': /last month/i,
      'this year': /this year/i,
      'last year': /last year/i,
      'today': /today/i,
      'yesterday': /yesterday/i,
      'this week': /this week/i,
      'last week': /last week/i
    };

    for (const [frame, regex] of Object.entries(timeFrames)) {
      if (regex.test(query)) return frame;
    }
    
    return 'this month'; // default
  }

  private extractCategory(query: string): CategoryType {
    const categoryMap: Record<string, CategoryType> = {
      'grocery': 'groceries',
      'groceries': 'groceries',
      'bill': 'bills',
      'bills': 'bills',
      'medical': 'medical',
      'medicine': 'medical',
      'vehicle': 'vehicle',
      'car': 'vehicle',
      'shopping': 'online_shopping',
      'utilities': 'home_utilities',
      'logbook': 'logbook'
    };

    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (query.includes(keyword)) return category;
    }

    return 'miscellaneous';
  }

  private parseTimeRange(period?: string) {
    const end = new Date();
    let start = new Date();

    switch (period?.toLowerCase()) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'this_week':
        start.setDate(end.getDate() - 7);
        break;
      case 'this_month':
        start.setMonth(end.getMonth(), 1);
        break;
      case 'last_month':
        start.setMonth(end.getMonth() - 1, 1);
        end.setMonth(end.getMonth(), 0);
        break;
      default:
        start.setMonth(end.getMonth() - 1); // Default to last 30 days
    }

    return { start, end };
  }

  private async handleSpendingQuery(
    query: string, 
    timeRange: { start: Date; end: Date },
    category: CategoryType,
    context?: Context
  ): Promise<ProcessingResult> {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', this.userId)
      .eq('category', category)
      .gte('date', timeRange.start.toISOString())
      .lte('date', timeRange.end.toISOString());

    const total = data?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    return {
      success: true,
      response: `You spent ₹${total} on ${category}`,
      context: {
        ...context,
        lastIntent: 'query',
        lastQuery: { type: 'expense_query', category },
        history: context?.history || []
      } as Context,
      intent: 'query'
    };
  }

  private async handleListingQuery(
    query: string,
    timeRange: { start: Date; end: Date },
    context?: Context
  ): Promise<ProcessingResult> {
    // Implementation
    return {
      success: true,
      response: "Here are your transactions...",
      context: {
        ...context,
        lastIntent: 'query',
        lastQuery: { type: 'transaction_query' }
      } as Context,
      intent: 'query'
    };
  }

  private async handleSummaryQuery(
    query: string,
    timeRange: { start: Date; end: Date },
    context?: Context
  ): Promise<ProcessingResult> {
    // Implementation
    return {
      success: true,
      response: "Here's your summary...",
      context: {
        ...context,
        lastIntent: 'query',
        lastQuery: { type: 'balance_query' }
      } as Context,
      intent: 'query'
    };
  }

  async processAnalyticsQuery(query: QueryResponse): Promise<AnalyticsResult> {
    const timeRange = this.parseTimeRange(query.time_period);

    const spendingAnalysis = await this.contextEngine.getSpendingAnalytics(timeRange);

    let serviceProviderAnalysis;
    if (query.provider?.type) {
      serviceProviderAnalysis = await this.contextEngine.getServiceProviderAnalytics(
        query.provider.type
      );
    }

    return {
      spending: spendingAnalysis,
      serviceProvider: serviceProviderAnalysis,
      timestamp: new Date()
    };
  }

  // Helper to generate visual-friendly data
  private formatForVisualization(analysis: SpendingAnalysis) {
    return {
      chartData: {
        labels: Object.keys(analysis.categories),
        datasets: [{
          data: Object.values(analysis.categories).map(c => c.total),
          trends: Object.values(analysis.categories).map(c => c.trend)
        }]
      },
      summaryCards: this.generateSummaryCards(analysis),
      insightsList: analysis.insights
    };
  }

  private generateSummaryCards(analysis: SpendingAnalysis) {
    return {
      totalSpending: {
        title: 'Total Spending',
        value: analysis.total_spending,
        trend: this.calculateOverallTrend(analysis),
        change: this.calculatePercentageChange(analysis)
      },
      topCategories: {
        title: 'Top Categories',
        items: this.getTopCategories(analysis, 3)
      },
      savings: {
        title: 'Potential Savings',
        value: this.calculatePotentialSavings(analysis),
        suggestions: this.generateSavingSuggestions(analysis)
      },
      alerts: {
        title: 'Alerts & Insights',
        items: this.generateAlerts(analysis)
      }
    };
  }

  private calculateOverallTrend(analysis: SpendingAnalysis): 'up' | 'down' | 'stable' {
    const trends = Object.values(analysis.categories).map(c => c.trend);
    const increasingCount = trends.filter(t => t === 'increasing').length;
    const decreasingCount = trends.filter(t => t === 'decreasing').length;

    if (increasingCount > decreasingCount) return 'up';
    if (decreasingCount > increasingCount) return 'down';
    return 'stable';
  }

  private calculatePercentageChange(analysis: SpendingAnalysis): number {
    // Calculate percentage change from previous period
    // This is a simplified example - you might want to get actual historical data
    const previousTotal = analysis.total_spending * 0.9; // Example
    return ((analysis.total_spending - previousTotal) / previousTotal) * 100;
  }

  private getTopCategories(analysis: SpendingAnalysis, limit: number) {
    return Object.entries(analysis.categories)
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, limit)
      .map(([category, data]) => ({
        category,
        amount: data.total,
        percentage: (data.total / analysis.total_spending) * 100,
        trend: data.trend
      }));
  }

  private calculatePotentialSavings(analysis: SpendingAnalysis): number {
    // Example logic - you might want to implement more sophisticated calculations
    return Object.values(analysis.categories).reduce((total, category) => {
      const potentialSaving = category.total * 0.1; // Assume 10% potential saving
      return total + potentialSaving;
    }, 0);
  }

  private generateSavingSuggestions(analysis: SpendingAnalysis): string[] {
    const suggestions: string[] = [];
    
    Object.entries(analysis.categories).forEach(([category, data]) => {
      if (data.trend === 'increasing') {
        suggestions.push(`Consider reviewing your ${category} expenses`);
      }
      if (data.average && data.total > data.average * 1.2) {
        suggestions.push(`${category} spending is 20% above average`);
      }
    });

    return suggestions;
  }

  private generateAlerts(analysis: SpendingAnalysis): Array<{
    type: 'warning' | 'info' | 'success';
    message: string;
  }> {
    const alerts: Array<{
      type: 'warning' | 'info' | 'success';
      message: string;
    }> = [];

    // Check for unusual spending
    Object.entries(analysis.categories).forEach(([category, data]) => {
      if (data.total > data.highest * 1.2) {
        alerts.push({
          type: 'warning' as const,
          message: `Unusually high spending in ${category}`
        });
      }
    });

    // Check for potential savings
    if (this.calculatePotentialSavings(analysis) > analysis.total_spending * 0.15) {
      alerts.push({
        type: 'info' as const,
        message: 'Significant saving opportunities identified'
      });
    }

    // Add positive feedback
    const stableCategories = Object.entries(analysis.categories)
      .filter(([, data]) => data.trend === 'stable')
      .length;
    if (stableCategories > Object.keys(analysis.categories).length * 0.5) {
      alerts.push({
        type: 'success' as const,
        message: 'Most spending categories are stable'
      });
    }

    return alerts;
  }

  async processQuery(query: QueryResponse): Promise<ProcessingResult> {
    try {
      let response: string;
      let data: any;

      switch (query.type) {
        case 'expense_query':
          data = await this.queryExpenses(query);
          response = this.formatExpenseResponse(data);
          break;
        case 'income_query':
          data = await this.queryIncome(query);
          response = this.formatIncomeResponse(data);
          break;
        case 'transaction_query':
          data = await this.queryTransactions(query);
          response = this.formatTransactionResponse(data);
          break;
        case 'balance_query':
          data = await this.queryBalance();
          response = this.formatBalanceResponse(data);
          break;
        default:
          data = await this.handleComplexQuery(query);
          response = this.formatComplexResponse(data);
      }

      return {
        success: true,
        response,
        context: { userId: this.userId } as Context,
        intent: 'query',
        dbOperations: []
      };
    } catch (error) {
      logger.error('Query processing error:', error);
      throw error;
    }
  }

  private async queryExpenses(query: QueryResponse): Promise<any> {
    const timeRange = this.parseTimeRange(query.time_period);
    return this.getExpenses(timeRange.start, timeRange.end, query.category);
  }

  private formatExpenseResponse(data: any): string {
    const total = data.reduce((sum: number, expense: any) => sum + expense.amount, 0);
    return `Total expenses: ₹${total}. ${data.length} transactions found.`;
  }

  private async queryIncome(query: QueryResponse): Promise<any> {
    const timeRange = this.parseTimeRange(query.time_period);
    return this.getIncome(timeRange.start, timeRange.end);
  }

  private formatIncomeResponse(data: any): string {
    const total = data.reduce((sum: number, income: any) => sum + income.amount, 0);
    return `Total income: ₹${total}. ${data.length} transactions found.`;
  }

  private async queryTransactions(query: QueryResponse): Promise<any> {
    const timeRange = this.parseTimeRange(query.time_period);
    return this.getTransactions(timeRange.start, timeRange.end, query.provider);
  }

  private formatTransactionResponse(data: any): string {
    return data.map((t: any) => 
      `${new Date(t.date).toLocaleDateString()}: ₹${t.amount} - ${t.description}`
    ).join('\n');
  }

  private async queryBalance(): Promise<any> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return this.getBalance(monthStart, now);
  }

  private formatBalanceResponse(data: any): string {
    return `Current balance: ₹${data.balance}\nIncome: ₹${data.income}\nExpenses: ₹${data.expenses}`;
  }

  private formatComplexResponse(data: any): string {
    return `Analysis for ${data.period}:\n` +
           `Income: ₹${data.income.reduce((sum: number, i: any) => sum + i.amount, 0)}\n` +
           `Expenses: ₹${data.expenses.reduce((sum: number, e: any) => sum + e.amount, 0)}\n` +
           `Balance: ₹${data.balance.balance}`;
  }

  // ... implement other required methods ...
} 