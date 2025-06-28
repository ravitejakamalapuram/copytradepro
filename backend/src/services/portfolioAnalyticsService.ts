import { userDatabase } from './sqliteDatabase';
import type { OrderHistory } from './sqliteDatabase';

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

class PortfolioAnalyticsService {

  /**
   * Calculate portfolio positions from order history
   */
  calculatePortfolioPositions(userId: number): PortfolioPosition[] {
    const orders = userDatabase.getOrderHistoryByUserId(userId, 1000, 0);
    const executedOrders = orders.filter(order => order.status === 'EXECUTED');

    // Group orders by symbol
    const symbolGroups = new Map<string, OrderHistory[]>();

    executedOrders.forEach(order => {
      if (!symbolGroups.has(order.symbol)) {
        symbolGroups.set(order.symbol, []);
      }
      symbolGroups.get(order.symbol)!.push(order);
    });

    const positions: PortfolioPosition[] = [];

    symbolGroups.forEach((orders, symbol) => {
      let totalBuyQuantity = 0;
      let totalSellQuantity = 0;
      let totalBuyValue = 0;
      let totalSellValue = 0;
      const brokerAccounts = new Set<string>();
      let lastTradeDate = '';

      orders.forEach(order => {
        brokerAccounts.add(order.broker_name);
        if (order.executed_at > lastTradeDate) {
          lastTradeDate = order.executed_at;
        }

        if (order.action === 'BUY') {
          totalBuyQuantity += order.quantity;
          totalBuyValue += order.quantity * order.price;
        } else {
          totalSellQuantity += order.quantity;
          totalSellValue += order.quantity * order.price;
        }
      });

      const netQuantity = totalBuyQuantity - totalSellQuantity;

      // Only include positions with net quantity > 0
      if (netQuantity > 0) {
        const averagePrice = totalBuyValue / totalBuyQuantity;
        const investedValue = netQuantity * averagePrice;

        // For now, use the last trade price as current price
        // In a real implementation, you'd fetch current market prices
        const lastOrder = orders[orders.length - 1];
        const currentPrice = lastOrder?.price || averagePrice;
        const currentValue = netQuantity * currentPrice;

        const pnl = currentValue - investedValue;
        const pnlPercentage = investedValue > 0 ? (pnl / investedValue) * 100 : 0;

        positions.push({
          symbol,
          totalQuantity: netQuantity,
          averagePrice,
          currentValue,
          investedValue,
          pnl,
          pnlPercentage,
          lastTradeDate,
          brokerAccounts: Array.from(brokerAccounts)
        });
      }
    });

    return positions.sort((a, b) => b.currentValue - a.currentValue);
  }
  
  /**
   * Calculate overall portfolio metrics
   */
  calculatePortfolioMetrics(userId: number): PortfolioMetrics {
    const orders = userDatabase.getOrderHistoryByUserId(userId, 1000, 0);
    const positions = this.calculatePortfolioPositions(userId);
    
    const totalOrders = orders.length;
    const executedOrders = orders.filter(order => order.status === 'EXECUTED').length;
    const successRate = totalOrders > 0 ? (executedOrders / totalOrders) * 100 : 0;
    
    const totalInvested = positions.reduce((sum, pos) => sum + pos.investedValue, 0);
    const currentValue = positions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const totalPnL = currentValue - totalInvested;
    const totalPnLPercentage = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
    
    // Calculate time-based P&L
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const dayOrders = orders.filter(order => 
      order.status === 'EXECUTED' && new Date(order.executed_at) >= dayStart
    );
    const weekOrders = orders.filter(order => 
      order.status === 'EXECUTED' && new Date(order.executed_at) >= weekStart
    );
    const monthOrders = orders.filter(order => 
      order.status === 'EXECUTED' && new Date(order.executed_at) >= monthStart
    );
    
    const dayPnL = this.calculatePnLFromOrders(dayOrders);
    const weekPnL = this.calculatePnLFromOrders(weekOrders);
    const monthPnL = this.calculatePnLFromOrders(monthOrders);
    
    return {
      totalInvested,
      currentValue,
      totalPnL,
      totalPnLPercentage,
      totalOrders,
      executedOrders,
      successRate,
      activePositions: positions.length,
      dayPnL,
      weekPnL,
      monthPnL
    };
  }
  
  /**
   * Calculate trading statistics
   */
  calculateTradingStats(userId: number): TradingStats {
    const orders = userDatabase.getOrderHistoryByUserId(userId, 1000, 0);
    const executedOrders = orders.filter(order => order.status === 'EXECUTED');
    
    // Group by symbol to calculate trade pairs
    const symbolTrades = new Map<string, OrderHistory[]>();
    executedOrders.forEach(order => {
      if (!symbolTrades.has(order.symbol)) {
        symbolTrades.set(order.symbol, []);
      }
      symbolTrades.get(order.symbol)!.push(order);
    });
    
    let totalTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalWinAmount = 0;
    let totalLossAmount = 0;
    const returns: number[] = [];
    
    symbolTrades.forEach(trades => {
      // Sort by date
      trades.sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime());
      
      let position = 0;
      let avgPrice = 0;
      
      trades.forEach(trade => {
        if (trade.action === 'BUY') {
          if (position === 0) {
            avgPrice = trade.price;
          } else if (position > 0) {
            avgPrice = ((avgPrice * position) + (trade.price * trade.quantity)) / (position + trade.quantity);
          }
          position += trade.quantity;
        } else { // SELL
          if (position > 0) {
            const sellQuantity = Math.min(trade.quantity, position);
            const pnl = (trade.price - avgPrice) * sellQuantity;
            const returnPct = avgPrice > 0 ? (pnl / (avgPrice * sellQuantity)) * 100 : 0;
            
            returns.push(returnPct);
            totalTrades++;
            
            if (pnl > 0) {
              winningTrades++;
              totalWinAmount += pnl;
            } else {
              losingTrades++;
              totalLossAmount += Math.abs(pnl);
            }
            
            position -= sellQuantity;
          }
        }
      });
    });
    
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    const averageWin = winningTrades > 0 ? totalWinAmount / winningTrades : 0;
    const averageLoss = losingTrades > 0 ? totalLossAmount / losingTrades : 0;
    const profitFactor = totalLossAmount > 0 ? totalWinAmount / totalLossAmount : 0;
    
    // Calculate max drawdown
    let maxDrawdown = 0;
    let peak = 0;
    let cumulativePnL = 0;
    
    returns.forEach(returnPct => {
      cumulativePnL += returnPct;
      if (cumulativePnL > peak) {
        peak = cumulativePnL;
      }
      const drawdown = peak - cumulativePnL;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });
    
    // Calculate Sharpe ratio (simplified)
    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
    const variance = returns.length > 0 ? 
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
    
    return {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      averageWin,
      averageLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio
    };
  }
  
  /**
   * Get performance data for charts
   */
  getPerformanceData(userId: number, days: number = 30): PerformanceData[] {
    const orders = userDatabase.getOrderHistoryByUserId(userId, 1000, 0);
    const executedOrders = orders.filter(order => order.status === 'EXECUTED');
    
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
    
    const performanceData: PerformanceData[] = [];
    let cumulativePnL = 0;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOrders = executedOrders.filter(order =>
        order.executed_at && dateStr && order.executed_at.startsWith(dateStr)
      );
      
      const dayPnL = this.calculatePnLFromOrders(dayOrders);
      cumulativePnL += dayPnL;
      
      // Calculate portfolio value (simplified)
      const portfolioValue = 100000 + cumulativePnL; // Assuming starting value of 1 lakh
      
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
  }
  
  /**
   * Get symbol-wise performance
   */
  getSymbolPerformance(userId: number): SymbolPerformance[] {
    const orders = userDatabase.getOrderHistoryByUserId(userId, 1000, 0);
    const executedOrders = orders.filter(order => order.status === 'EXECUTED');
    
    const symbolStats = new Map<string, {
      trades: OrderHistory[];
      totalVolume: number;
    }>();
    
    executedOrders.forEach(order => {
      if (!symbolStats.has(order.symbol)) {
        symbolStats.set(order.symbol, { trades: [], totalVolume: 0 });
      }
      const stats = symbolStats.get(order.symbol)!;
      stats.trades.push(order);
      stats.totalVolume += order.quantity * order.price;
    });
    
    const symbolPerformance: SymbolPerformance[] = [];
    
    symbolStats.forEach((stats, symbol) => {
      const { trades, totalVolume } = stats;
      
      // Calculate trades and P&L for this symbol
      let totalTrades = 0;
      let winningTrades = 0;
      let totalPnL = 0;
      
      // Group buy/sell pairs
      let position = 0;
      let avgPrice = 0;
      
      trades.sort((a, b) => new Date(a.executed_at).getTime() - new Date(b.executed_at).getTime());
      
      trades.forEach(trade => {
        if (trade.action === 'BUY') {
          if (position === 0) {
            avgPrice = trade.price;
          } else if (position > 0) {
            avgPrice = ((avgPrice * position) + (trade.price * trade.quantity)) / (position + trade.quantity);
          }
          position += trade.quantity;
        } else {
          if (position > 0) {
            const sellQuantity = Math.min(trade.quantity, position);
            const pnl = (trade.price - avgPrice) * sellQuantity;
            totalPnL += pnl;
            totalTrades++;
            
            if (pnl > 0) {
              winningTrades++;
            }
            
            position -= sellQuantity;
          }
        }
      });
      
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const averageReturn = totalTrades > 0 ? totalPnL / totalTrades : 0;
      
      symbolPerformance.push({
        symbol,
        totalTrades,
        winningTrades,
        winRate,
        totalPnL,
        averageReturn,
        volume: totalVolume
      });
    });
    
    return symbolPerformance.sort((a, b) => b.totalPnL - a.totalPnL);
  }
  
  /**
   * Helper method to calculate P&L from orders
   */
  private calculatePnLFromOrders(orders: OrderHistory[]): number {
    // This is a simplified calculation
    // In reality, you'd need to match buy/sell pairs properly
    let totalBuyValue = 0;
    let totalSellValue = 0;
    
    orders.forEach(order => {
      const value = order.quantity * order.price;
      if (order.action === 'BUY') {
        totalBuyValue += value;
      } else {
        totalSellValue += value;
      }
    });
    
    return totalSellValue - totalBuyValue;
  }
}

export const portfolioAnalyticsService = new PortfolioAnalyticsService();
