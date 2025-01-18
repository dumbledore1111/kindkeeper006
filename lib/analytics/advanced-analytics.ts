import { supabase } from '@/lib/supabase';

interface PredictiveInsights {
  spendingPredictions: {
    nextMonth: number;
    trends: string[];
    confidence: number;
  };
  savingsProjections: {
    potential: number;
    recommendations: string[];
    timeline: string;
  };
  serviceProviderSchedule: {
    upcoming: Array<{
      service: string;
      dueDate: Date;
      estimatedAmount: number;
    }>;
  };
}

interface BehavioralInsights {
  spendingPatterns: {
    frequentCategories: string[];
    unusualSpending: string[];
    peakSpendingDays: string[];
  };
  serviceProviderInteractions: {
    regularProviders: string[];
    paymentPatterns: string[];
    attendanceStats: Record<string, number>;
  };
  financialHabits: {
    savingTendency: number;
    budgetAdherence: number;
    recommendations: string[];
  };
}

export class AdvancedAnalytics {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async generatePredictiveInsights(): Promise<PredictiveInsights> {
    return {
      spendingPredictions: await this.predictSpendingTrends(),
      savingsProjections: await this.projectSavings(),
      serviceProviderSchedule: await this.predictServiceNeeds()
    };
  }

  async generateBehavioralInsights(): Promise<BehavioralInsights> {
    return {
      spendingPatterns: await this.analyzeSpendingBehavior(),
      serviceProviderInteractions: await this.analyzeProviderBehavior(),
      financialHabits: await this.analyzeFinancialHabits()
    };
  }

  private async predictSpendingTrends(): Promise<{
    nextMonth: number;
    trends: string[];
    confidence: number;
  }> {
    // Get historical spending data
    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, created_at')
      .eq('user_id', this.userId)
      .eq('type', 'expense')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!transactions?.length) {
      return {
        nextMonth: 0,
        trends: ['Not enough data'],
        confidence: 0
      };
    }

    const amounts = transactions.map(t => t.amount);
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const trend = this.calculateTrend(amounts);

    return {
      nextMonth: Math.round(average * trend),
      trends: this.analyzeTrends(amounts),
      confidence: 0.8
    };
  }

  private async projectSavings(): Promise<{
    potential: number;
    recommendations: string[];
    timeline: string;
  }> {
    const { data: monthlyData } = await supabase
      .from('transactions')
      .select('amount, type')
      .eq('user_id', this.userId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (!monthlyData?.length) {
      return {
        potential: 0,
        recommendations: ['Start tracking your transactions'],
        timeline: '1 month'
      };
    }

    const income = monthlyData
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const expenses = monthlyData
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    const potential = Math.round(income * 0.2); // Suggest 20% savings

    return {
      potential,
      recommendations: this.generateSavingsRecommendations(income, expenses),
      timeline: '1 month'
    };
  }

  private async predictServiceNeeds(): Promise<{
    upcoming: Array<{
      service: string;
      dueDate: Date;
      estimatedAmount: number;
    }>;
  }> {
    const { data: providers } = await supabase
      .from('attendance_logs')
      .select(`
        provider_type,
        name,
        date,
        transactions (amount)
      `)
      .eq('user_id', this.userId)
      .order('date', { ascending: false });

    if (!providers?.length) {
      return { upcoming: [] };
    }

    return {
      upcoming: this.generateUpcomingServices(providers)
    };
  }

  private async analyzeSpendingBehavior(): Promise<{
    frequentCategories: string[];
    unusualSpending: string[];
    peakSpendingDays: string[];
  }> {
    // Implementation here
    return {
      frequentCategories: ['groceries', 'utilities'],
      unusualSpending: ['Large purchase detected'],
      peakSpendingDays: ['Monday', 'Friday']
    };
  }

  private async analyzeProviderBehavior(): Promise<{
    regularProviders: string[];
    paymentPatterns: string[];
    attendanceStats: Record<string, number>;
  }> {
    // Implementation here
    return {
      regularProviders: ['maid', 'driver'],
      paymentPatterns: ['Monthly payment on 1st'],
      attendanceStats: { maid: 0.95, driver: 0.88 }
    };
  }

  private async analyzeFinancialHabits(): Promise<{
    savingTendency: number;
    budgetAdherence: number;
    recommendations: string[];
  }> {
    // Implementation here
    return {
      savingTendency: 0.7,
      budgetAdherence: 0.85,
      recommendations: ['Consider increasing emergency fund']
    };
  }

  // Helper methods
  private calculateTrend(amounts: number[]): number {
    // Simple linear trend
    return amounts.length > 1 ? amounts[0] / amounts[amounts.length - 1] : 1;
  }

  private analyzeTrends(amounts: number[]): string[] {
    const trends: string[] = [];
    const average = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    
    if (amounts[0] > average * 1.2) {
      trends.push('Spending is increasing');
    } else if (amounts[0] < average * 0.8) {
      trends.push('Spending is decreasing');
    } else {
      trends.push('Spending is stable');
    }

    return trends;
  }

  private generateSavingsRecommendations(income: number, expenses: number): string[] {
    const recommendations: string[] = [];
    const savingsRate = (income - expenses) / income;

    if (savingsRate < 0.1) {
      recommendations.push('Consider reducing non-essential expenses');
      recommendations.push('Look for additional income sources');
    } else if (savingsRate < 0.2) {
      recommendations.push('You\'re on track, try to increase savings by 5%');
    } else {
      recommendations.push('Great savings rate! Consider investing');
    }

    return recommendations;
  }

  private generateUpcomingServices(providers: any[]): Array<{
    service: string;
    dueDate: Date;
    estimatedAmount: number;
  }> {
    return providers.map(provider => ({
      service: provider.provider_type,
      dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      estimatedAmount: provider.transactions?.[0]?.amount || 0
    }));
  }
} 