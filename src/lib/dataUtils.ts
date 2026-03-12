/**
 * Simple hash function to generate a seed from a string
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Deterministic random number generator
 */
export function seededRandom(seed: number) {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

/**
 * Generate dashboard data based on connection settings and date range
 */
export function generateDashboardData(seedStr: string, dateRange: 'today' | '7days' | '30days' | 'custom' = '30days', options?: { startDate?: Date; endDate?: Date }) {
  const seed = hashString(seedStr || 'default-seed');
  const points = dateRange === 'today' ? 1 : dateRange === '7days' ? 7 : 30;
  
  const data = [];
  for (let i = 1; i <= points; i++) {
    const daySeed = seed + i;
    const revenue = Math.floor(seededRandom(daySeed) * 2000) + 1000;
    const spend = Math.floor(seededRandom(daySeed + 100) * 800) + 300;
    data.push({
      name: dateRange === 'today' ? '1' : i.toString(),
      revenue,
      spend
    });
  }
  
  const totalRevenue = data.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalSpend = data.reduce((acc, curr) => acc + curr.spend, 0);
  const roas = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : '0.00';
  
  return {
    chartData: data,
    totalRevenue,
    totalSpend,
    roas,
    netProfit: totalRevenue - totalSpend
  };
}
