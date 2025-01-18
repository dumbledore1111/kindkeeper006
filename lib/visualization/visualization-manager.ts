export class VisualizationManager {
  generateVisuals(data: AnalyticsResult): VisualizationData {
    return {
      charts: this.generateCharts(data),
      insights: this.generateInsightCards(data),
      recommendations: this.generateRecommendations(data)
    };
  }

  private generateCharts(data: AnalyticsResult): ChartData {
    return {
      spending: generateSpendingCharts(data.spending),
      attendance: generateAttendanceCharts(data.serviceProvider),
      trends: generateTrendCharts(data)
    };
  }
} 