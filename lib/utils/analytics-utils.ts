import type { SpendingAnalysis, ServiceProviderAnalysis } from '@/types/responses';

export function generateInsightMarkers(analysis: SpendingAnalysis) {
  return Object.entries(analysis.categories).map(([category, data]) => ({
    category,
    insights: generateCategoryInsights(data)
  }));
}

export function getDailySpending(analysis: SpendingAnalysis, date: Date): number {
  // Implementation for getting daily spending
  return 0; // Placeholder
}

export function getDailyEvents(analysis: SpendingAnalysis, date: Date): any[] {
  // Implementation for getting daily events
  return []; // Placeholder
}

export function generateHeatmapLegend() {
  return {
    min: 0,
    max: 100,
    steps: [0, 25, 50, 75, 100],
    colors: ['#f3f4f6', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8']
  };
}

export function calculateThreshold(days: any[]): number {
  const values = days.map(d => d.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
  );
  return mean + (2 * stdDev);
}

export function findFrequentTransactions(data: any) {
  return {
    count: data.count || 0,
    frequency: calculateTransactionFrequency(data),
    pattern: detectTransactionPattern(data)
  };
}

export function detectUnusualSpending(data: any) {
  return {
    isUnusual: data.total > data.average * 1.5,
    reason: data.total > data.average * 1.5 ? 'Above average spending' : null,
    difference: data.total - data.average
  };
}

export function generateRecommendations(data: any) {
  const recommendations = [];
  
  if (data.trend === 'increasing') {
    recommendations.push('Consider reviewing spending in this category');
  }
  if (data.total > data.average * 1.2) {
    recommendations.push('Spending is above average');
  }
  
  return recommendations;
}

export function determineSignificance(day: any) {
  if (day.value > day.average * 2) {
    return 'Unusually high spending';
  }
  return 'Normal spending day';
}

export function generateDayDetails(day: any) {
  return {
    date: day.date,
    spending: day.value,
    events: day.events,
    significance: determineSignificance(day)
  };
}

export function generateCategoryInsights(data: any) {
  return {
    frequentTransactions: findFrequentTransactions(data),
    unusualSpending: detectUnusualSpending(data),
    recommendations: generateRecommendations(data)
  };
}

// Private helper functions
function calculateTransactionFrequency(data: any) {
  return data.count / 30; // transactions per day
}

function detectTransactionPattern(data: any) {
  return {
    isRegular: data.count > 10,
    frequency: data.count > 20 ? 'daily' : data.count > 4 ? 'weekly' : 'monthly'
  };
}

// ... other utility functions ... 