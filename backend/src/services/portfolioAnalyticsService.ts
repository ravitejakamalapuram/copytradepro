import { userDatabase, OrderHistory } from './sqliteDatabase';

export interface PortfolioPosition {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  value: number;
}

export interface PortfolioMetrics {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayPnL: number;
  dayPnLPercent: number;
  totalInvested: number;
  availableCash: number;
}

export interface TradingStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
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
  totalPnL: number;
  winRate: number;
  avgHoldingPeriod: number;
}

class PortfolioAnalyticsService {
  
  /**
   * Get portfolio positions
   */
  async getPortfolioPositions(userId: number): Promise<PortfolioPosition[]> {
    try {
      // Get all executed orders for the user
      const orders = userDatabase.getOrderHistory(userId);
      
      // Group by symbol and calculate positions
      const positionMap = new Map<string, PortfolioPosition>();
      
      for (const order of orders as OrderHistory[]) {
        if (order.status !== 'EXECUTED') continue;
        
        const symbol = order.symbol;
        const existing = positionMap.get(symbol) || {
          symbol,
          quantity: 0,
          averagePrice: 0,
          currentPrice: order.price,
          pnl: 0,
          pnlPercent: 0,
          value: 0
        };
        
        if (order.action === 'BUY') {
          const newQuantity = existing.quantity + order.quantity;
          existing.averagePrice = ((existing.averagePrice * existing.quantity) + (order.price * order.quantity)) / newQuantity;
          existing.quantity = newQuantity;
        } else {
          existing.quantity -= order.quantity;
        }
        
        // Calculate current values
        existing.value = existing.quantity * existing.currentPrice;
        existing.pnl = (existing.currentPrice - existing.averagePrice) * existing.quantity;
        existing.pnlPercent = existing.averagePrice > 0 ? (existing.pnl / (existing.averagePrice * existing.quantity)) * 100 : 0;
        
        if (existing.quantity > 0) {
          positionMap.set(symbol, existing);
        } else {
          positionMap.delete(symbol);
        }
      }
      
      return Array.from(positionMap.values());
    } catch (error: any) {
      console.error('Failed to get portfolio positions:', error);
      return [];
    }
  }

  /**
   * Get portfolio metrics
   */
  async getPortfolioMetrics(userId: number): Promise<PortfolioMetrics> {
    try {
      const positions = await this.getPortfolioPositions(userId);
      
      const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
      const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
      const totalInvested = positions.reduce((sum, pos) => sum + (pos.averagePrice * pos.quantity), 0);
      
      return {
        totalValue,
        totalPnL,
        totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
        dayPnL: 0, // Would need real-time price data
        dayPnLPercent: 0,
        totalInvested,
        availableCash: 100000 // Mock value
      };
    } catch (error: any) {
      console.error('Failed to get portfolio metrics:', error);
      return {
        totalValue: 0,
        totalPnL: 0,
        totalPnLPercent: 0,
        dayPnL: 0,
        dayPnLPercent: 0,
        totalInvested: 0,
        availableCash: 0
      };
    }
  }

  /**
   * Get trading statistics
   */
  async getTradingStatistics(userId: number): Promise<TradingStatistics> {
    try {
      const orders = userDatabase.getOrderHistory(userId);
      const executedOrders = orders.filter((order: OrderHistory) => order.status === 'EXECUTED');
      
      // Group trades by symbol and calculate P&L
      const trades = new Map<string, { pnl: number; quantity: number }>();
      
      for (const order of executedOrders) {
        const key = `${order.symbol}_${order.executed_at}`;
        const existing = trades.get(key) || { pnl: 0, quantity: 0 };
        
        if (order.action === 'BUY') {
          existing.pnl -= order.price * order.quantity;
          existing.quantity += order.quantity;
        } else {
          existing.pnl += order.price * order.quantity;
          existing.quantity -= order.quantity;
        }
        
        trades.set(key, existing);
      }
      
      const completedTrades = Array.from(trades.values()).filter(trade => trade.quantity === 0);
      const totalTrades = completedTrades.length;
      const winningTrades = completedTrades.filter(trade => trade.pnl > 0).length;
      const losingTrades = completedTrades.filter(trade => trade.pnl < 0).length;
      
      const wins = completedTrades.filter(trade => trade.pnl > 0);
      const losses = completedTrades.filter(trade => trade.pnl < 0);
      
      const avgWin = wins.length > 0 ? wins.reduce((sum, trade) => sum + trade.pnl, 0) / wins.length : 0;
      const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, trade) => sum + trade.pnl, 0) / losses.length) : 0;
      
      return {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate: totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0,
        avgWin,
        avgLoss,
        profitFactor: avgLoss > 0 ? avgWin / avgLoss : 0,
        maxDrawdown: 0 // Would need historical calculation
      };
    } catch (error: any) {
      console.error('Failed to get trading statistics:', error);
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        maxDrawdown: 0
      };
    }
  }

  /**
   * Get performance data over time
   */
  async getPerformanceData(userId: number, days: number = 30): Promise<PerformanceData[]> {
    try {
      const orders = userDatabase.getOrderHistory(userId);
      const executedOrders = orders.filter((order: OrderHistory) => order.status === 'EXECUTED');
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - days);
      
      const performanceData: PerformanceData[] = [];
      let cumulativePnL = 0;
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dayOrders = executedOrders.filter((order: OrderHistory) =>
          order.executed_at && dateStr && order.executed_at.startsWith(dateStr)
        );

        const dayPnL = dayOrders.reduce((sum: number, order: OrderHistory) => {
          return sum + (order.action === 'SELL' ? order.price * order.quantity : -order.price * order.quantity);
        }, 0);
        
        cumulativePnL += dayPnL;
        const portfolioValue = 100000 + cumulativePnL; // Mock starting value
        
        if (dateStr) {
          performanceData.push({
            date: dateStr,
            portfolioValue,
            pnl: dayPnL,
            cumulativePnL
          });
        }
      }
      
      return performanceData;
    } catch (error: any) {
      console.error('Failed to get performance data:', error);
      return [];
    }
  }

  /**
   * Get symbol performance
   */
  async getSymbolPerformance(userId: number): Promise<SymbolPerformance[]> {
    try {
      const orders = userDatabase.getOrderHistory(userId);
      const executedOrders = orders.filter((order: OrderHistory) => order.status === 'EXECUTED');
      
      const symbolMap = new Map<string, SymbolPerformance>();
      
      for (const order of executedOrders) {
        const existing = symbolMap.get(order.symbol) || {
          symbol: order.symbol,
          totalTrades: 0,
          totalPnL: 0,
          winRate: 0,
          avgHoldingPeriod: 0
        };
        
        existing.totalTrades++;
        // Simplified P&L calculation
        existing.totalPnL += order.action === 'SELL' ? order.price * order.quantity : -order.price * order.quantity;
        
        symbolMap.set(order.symbol, existing);
      }
      
      return Array.from(symbolMap.values());
    } catch (error: any) {
      console.error('Failed to get symbol performance:', error);
      return [];
    }
  }

  /**
   * Get portfolio summary
   */
  async getPortfolioSummary(userId: number): Promise<any> {
    try {
      const [positions, metrics, stats] = await Promise.all([
        this.getPortfolioPositions(userId),
        this.getPortfolioMetrics(userId),
        this.getTradingStatistics(userId)
      ]);
      
      return {
        positions: positions.slice(0, 5), // Top 5 positions
        metrics,
        stats,
        recentActivity: [] // Would need recent orders
      };
    } catch (error: any) {
      console.error('Failed to get portfolio summary:', error);
      return {
        positions: [],
        metrics: {},
        stats: {},
        recentActivity: []
      };
    }
  }

  /**
   * Get detailed analytics
   */
  async getDetailedAnalytics(userId: number): Promise<any> {
    try {
      const [positions, metrics, stats, performance, symbols] = await Promise.all([
        this.getPortfolioPositions(userId),
        this.getPortfolioMetrics(userId),
        this.getTradingStatistics(userId),
        this.getPerformanceData(userId, 90),
        this.getSymbolPerformance(userId)
      ]);
      
      return {
        positions,
        metrics,
        stats,
        performance,
        symbols,
        riskMetrics: {
          sharpeRatio: 0,
          volatility: 0,
          beta: 0,
          alpha: 0
        }
      };
    } catch (error: any) {
      console.error('Failed to get detailed analytics:', error);
      return {
        positions: [],
        metrics: {},
        stats: {},
        performance: [],
        symbols: [],
        riskMetrics: {}
      };
    }
  }
}

export const portfolioAnalyticsService = new PortfolioAnalyticsService();
