import { authService } from './authService';

export interface PortfolioPosition {
  symbol: string;
  totalQuantity: number;
  averagePrice: number;
  currentValue: number;
  investedValue: number;
  pnl: number;
  pnlPercentage: number;
  lastTradeDate: string;
  brokerAccounts: string[];
}

export interface PortfolioMetrics {
  totalInvested: number;
  currentValue: number;
  totalPnL: number;
  totalPnLPercentage: number;
  totalOrders: number;
  executedOrders: number;
  successRate: number;
  activePositions: number;
  dayPnL: number;
  weekPnL: number;
  monthPnL: number;
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface PerformanceData {
  date: string;
  portfolioValue: number;
  pnl: number;
  cumulativePnL: number;
}

export interface SymbolPerformance {
  symbol: string;
  totalTrades: number;
  winningTrades: number;
  winRate: number;
  totalPnL: number;
  averageReturn: number;
  volume: number;
}

export interface PortfolioSummary {
  metrics: PortfolioMetrics;
  positions: PortfolioPosition[];
  tradingStats: TradingStats;
  recentPerformance: PerformanceData[];
  summary: {
    totalPositions: number;
    portfolioValue: number;
    totalPnL: number;
    dayPnL: number;
    successRate: number;
    winRate: number;
  };
}

export interface PortfolioAnalytics {
  period: {
    startDate: string;
    endDate: string;
  };
  metrics: PortfolioMetrics;
  tradingStats: TradingStats;
  topPerformers: SymbolPerformance[];
  analytics: {
    riskMetrics: {
      maxDrawdown: number;
      sharpeRatio: number;
      volatility: number;
    };
    diversification: {
      totalSymbols: number;
      concentrationRisk: number;
    };
  };
}

class PortfolioService {
  private baseURL = '/api/portfolio';

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }

    return data.data;
  }

  /**
   * Get portfolio positions
   */
  async getPositions(): Promise<{ positions: PortfolioPosition[]; count: number }> {
    return this.makeRequest('/positions');
  }

  /**
   * Get portfolio metrics
   */
  async getMetrics(): Promise<PortfolioMetrics> {
    return this.makeRequest('/metrics');
  }

  /**
   * Get trading statistics
   */
  async getTradingStats(): Promise<TradingStats> {
    return this.makeRequest('/trading-stats');
  }

  /**
   * Get performance data for charts
   */
  async getPerformanceData(days: number = 30): Promise<{ performance: PerformanceData[]; period: string }> {
    return this.makeRequest(`/performance?days=${days}`);
  }

  /**
   * Get symbol-wise performance
   */
  async getSymbolPerformance(): Promise<{ symbols: SymbolPerformance[]; count: number }> {
    return this.makeRequest('/symbols');
  }

  /**
   * Get portfolio summary (combined overview)
   */
  async getSummary(): Promise<PortfolioSummary> {
    return this.makeRequest('/summary');
  }

  /**
   * Get portfolio analytics for a specific date range
   */
  async getAnalytics(startDate?: string, endDate?: string): Promise<PortfolioAnalytics> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const queryString = params.toString();
    return this.makeRequest(`/analytics${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Format currency values
   */
  formatCurrency(value: number, currency: string = '₹'): string {
    const absValue = Math.abs(value);
    
    if (absValue >= 10000000) { // 1 crore
      return `${currency}${(value / 10000000).toFixed(2)}Cr`;
    } else if (absValue >= 100000) { // 1 lakh
      return `${currency}${(value / 100000).toFixed(2)}L`;
    } else if (absValue >= 1000) { // 1 thousand
      return `${currency}${(value / 1000).toFixed(2)}K`;
    } else {
      return `${currency}${value.toFixed(2)}`;
    }
  }

  /**
   * Format percentage values
   */
  formatPercentage(value: number, decimals: number = 2): string {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
  }

  /**
   * Get color for P&L values
   */
  getPnLColor(value: number): string {
    if (value > 0) return '#10b981'; // green
    if (value < 0) return '#ef4444'; // red
    return '#6b7280'; // gray
  }

  /**
   * Calculate portfolio allocation
   */
  calculateAllocation(positions: PortfolioPosition[]): Array<{
    symbol: string;
    percentage: number;
    value: number;
  }> {
    const totalValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    
    return positions.map(pos => ({
      symbol: pos.symbol,
      percentage: totalValue > 0 ? (pos.currentValue / totalValue) * 100 : 0,
      value: pos.currentValue
    })).sort((a, b) => b.percentage - a.percentage);
  }

  /**
   * Get risk level based on metrics
   */
  getRiskLevel(_metrics: PortfolioMetrics, tradingStats: TradingStats): {
    level: 'Low' | 'Medium' | 'High';
    color: string;
    description: string;
  } {
    const volatility = tradingStats.sharpeRatio > 0 ? 1 / tradingStats.sharpeRatio : 0;
    const drawdown = tradingStats.maxDrawdown;
    
    if (volatility < 0.1 && drawdown < 5) {
      return {
        level: 'Low',
        color: '#10b981',
        description: 'Conservative portfolio with low volatility'
      };
    } else if (volatility < 0.2 && drawdown < 15) {
      return {
        level: 'Medium',
        color: '#f59e0b',
        description: 'Balanced portfolio with moderate risk'
      };
    } else {
      return {
        level: 'High',
        color: '#ef4444',
        description: 'Aggressive portfolio with high volatility'
      };
    }
  }

  /**
   * Calculate portfolio health score
   */
  calculateHealthScore(metrics: PortfolioMetrics, tradingStats: TradingStats): {
    score: number;
    grade: string;
    factors: Array<{ name: string; score: number; weight: number }>;
  } {
    const factors = [
      {
        name: 'Success Rate',
        score: Math.min(metrics.successRate / 80 * 100, 100), // 80% is excellent
        weight: 0.25
      },
      {
        name: 'Win Rate',
        score: Math.min(tradingStats.winRate / 60 * 100, 100), // 60% is excellent
        weight: 0.25
      },
      {
        name: 'Profit Factor',
        score: Math.min(tradingStats.profitFactor / 2 * 100, 100), // 2.0 is excellent
        weight: 0.2
      },
      {
        name: 'Sharpe Ratio',
        score: Math.min(Math.max(tradingStats.sharpeRatio, 0) / 1.5 * 100, 100), // 1.5 is excellent
        weight: 0.15
      },
      {
        name: 'Drawdown Control',
        score: Math.max(100 - tradingStats.maxDrawdown * 2, 0), // Lower drawdown is better
        weight: 0.15
      }
    ];

    const totalScore = factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0);
    
    let grade = 'F';
    if (totalScore >= 90) grade = 'A+';
    else if (totalScore >= 80) grade = 'A';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 60) grade = 'C';
    else if (totalScore >= 50) grade = 'D';

    return {
      score: totalScore,
      grade,
      factors
    };
  }
}

export const portfolioService = new PortfolioService();
