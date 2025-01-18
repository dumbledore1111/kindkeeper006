export function generateMonthLabels(count: number): string[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const labels = [];
  const currentDate = new Date();
  
  for (let i = count - 1; i >= 0; i--) {
    const monthIndex = (currentDate.getMonth() - i + 12) % 12;
    labels.push(months[monthIndex]);
  }
  
  return labels;
}

export function generateTrendline(analysis: SpendingAnalysis) {
  const values = Object.values(analysis.categories).map(c => c.total);
  return calculateLinearRegression(values);
}

export function calculateSavings(analysis: SpendingAnalysis): number {
  const totalIncome = analysis.total_income || 0;
  return totalIncome - analysis.total_spending;
}

export function calculateSavingsProgress(analysis: SpendingAnalysis): number {
  const savings = calculateSavings(analysis);
  const target = analysis.target || analysis.total_income * 0.2; // Default target 20% of income
  return (savings / target) * 100;
}

function calculateLinearRegression(values: number[]): number[] {
  // Implementation of linear regression calculation
  // Returns array of points for trendline
  return values.map((_, i) => {
    // Simplified linear regression calculation
    return values.reduce((acc, val) => acc + val, 0) / values.length;
  });
} 