import type { SpendingAnalysis, ServiceProviderAnalysis } from '@/types/responses';
import { generateColorPalette } from './utils/color-utils';
import {
  generateMonthLabels,
  generateTrendline,
  calculateSavings,
  calculateSavingsProgress
} from './utils/chart-utils';
import {
  generateInsightMarkers,
  getDailySpending,
  getDailyEvents,
  generateHeatmapLegend,
  calculateThreshold,
  findFrequentTransactions,
  detectUnusualSpending,
  generateRecommendations,
  determineSignificance,
  generateDayDetails
} from './utils/analytics-utils';
import {
  generateAttendanceHighlights,
  detectAttendancePatterns,
  calculatePaymentTrend,
  detectPaymentAnomalies,
  generateWorkRecommendations,
  calculateDayFrequency,
  calculateReliability,
  generateDayNotes,
  generateTimelinePoints,
  generateConsistencyAnnotations
} from './utils/service-provider-utils';

// Chart Data Generators
export function generateChartData(analysis: SpendingAnalysis) {
  return {
    // Pie Chart for Category Distribution
    categoryDistribution: {
      labels: Object.keys(analysis.categories),
      data: Object.values(analysis.categories).map(c => c.total),
      colors: generateColorPalette(Object.keys(analysis.categories).length),
      tooltips: generateCategoryTooltips(analysis.categories)
    },
    
    // Line Chart for Spending Trends
    spendingTrends: {
      labels: generateMonthLabels(6), // Last 6 months
      datasets: [{
        label: 'Monthly Spending',
        data: Object.values(analysis.categories).map(c => c.total),
        trendline: generateTrendline(analysis)
      }]
    },

    // Bar Chart for Category Comparison
    categoryComparison: {
      labels: Object.keys(analysis.categories),
      datasets: [
        {
          label: 'Current Month',
          data: Object.values(analysis.categories).map(c => c.total)
        },
        {
          label: 'Previous Month',
          data: Object.values(analysis.categories).map(c => c.average)
        }
      ],
      insights: generateInsightMarkers(analysis)
    },

    // Heatmap for Daily Spending
    dailySpendingHeatmap: generateDailyHeatmap(analysis),

    // Savings Progress
    savingsProgress: {
      current: calculateSavings(analysis),
      target: analysis.period.target || 0,
      progress: calculateSavingsProgress(analysis)
    }
  };
}

// Service Provider Visualizations
export function generateServiceProviderVisuals(analysis: ServiceProviderAnalysis) {
  return {
    // Interactive Attendance Calendar
    attendanceCalendar: {
      dates: analysis.workPattern.regularDays,
      consistency: analysis.workPattern.consistency,
      highlights: generateAttendanceHighlights(analysis),
      patterns: detectAttendancePatterns(analysis)
    },

    // Payment History Timeline
    paymentTimeline: {
      amounts: analysis.paymentPattern.amounts,
      dates: analysis.paymentPattern.dates,
      trend: calculatePaymentTrend(analysis),
      anomalies: detectPaymentAnomalies(analysis)
    },

    // Work Pattern Analysis
    workPatternAnalysis: {
      regularDays: generateWorkDayVisual(analysis),
      consistencyGraph: generateConsistencyGraph(analysis),
      recommendations: generateWorkRecommendations(analysis)
    }
  };
}

// Helper Functions
function generateCategoryTooltips(categories: Record<string, any>) {
  return Object.entries(categories).map(([category, data]) => ({
    category,
    trend: data.trend,
    change: calculatePercentageChange(data),
    insights: generateCategoryInsights(data)
  }));
}

function generateDailyHeatmap(analysis: SpendingAnalysis) {
  // Create a 7x5 grid representing days of the month
  const days = Array.from({ length: 35 }, (_, i) => {
    const date = new Date(analysis.period.start);
    date.setDate(date.getDate() + i);
    return {
      date,
      value: getDailySpending(analysis, date),
      events: getDailyEvents(analysis, date)
    };
  });

  return {
    grid: days,
    legend: generateHeatmapLegend(),
    highlights: findSignificantDays(days)
  };
}

function generateWorkDayVisual(analysis: ServiceProviderAnalysis) {
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdays.map(day => ({
    day,
    frequency: calculateDayFrequency(analysis, day),
    reliability: calculateReliability(analysis, day),
    notes: generateDayNotes(analysis, day)
  }));
}

function generateConsistencyGraph(analysis: ServiceProviderAnalysis) {
  return {
    timeline: generateTimelinePoints(analysis),
    threshold: analysis.workPattern.consistency,
    annotations: generateConsistencyAnnotations(analysis)
  };
}

// Utility Functions
function calculatePercentageChange(data: any) {
  const previousTotal = data.history?.[data.history.length - 2]?.total || 0;
  return previousTotal ? ((data.total - previousTotal) / previousTotal) * 100 : 0;
}

function generateCategoryInsights(data: any) {
  return {
    frequentTransactions: findFrequentTransactions(data),
    unusualSpending: detectUnusualSpending(data),
    recommendations: generateRecommendations(data)
  };
}

function findSignificantDays(days: any[]) {
  return days.filter(day => {
    const isSignificant = day.value > calculateThreshold(days);
    return isSignificant ? {
      date: day.date,
      reason: determineSignificance(day),
      details: generateDayDetails(day)
    } : null;
  }).filter(Boolean);
}