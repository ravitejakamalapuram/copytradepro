import { SymbolDatabaseService } from './symbolDatabaseService';
import { StandardizedSymbol } from '../models/symbolModels';

/**
 * Simple Symbol Lifecycle Service
 * Just handles basic symbol cleanup - no complex history tracking
 */
export class SymbolLifecycleService {
  constructor(private symbolDatabaseService: SymbolDatabaseService) {}

  /**
   * Clean up expired symbols (options/futures past expiry)
   */
  async cleanupExpiredSymbols(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Find expired options and futures
      const expiredSymbols = await this.symbolDatabaseService.searchSymbolsWithFilters({
        expiryEnd: today,
        limit: 10000
      });

      if (expiredSymbols.symbols.length === 0) {
        console.log('✅ No expired symbols to clean up');
        return 0;
      }

      // Delete expired symbols
      let deletedCount = 0;
      for (const symbol of expiredSymbols.symbols) {
        try {
          await this.symbolDatabaseService.deleteSymbol(symbol.id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete expired symbol ${symbol.tradingSymbol}:`, error);
        }
      }

      console.log(`✅ Cleaned up ${deletedCount} expired symbols`);
      return deletedCount;
    } catch (error) {
      console.error('🚨 Failed to cleanup expired symbols:', error);
      return 0;
    }
  }

  /**
   * Get active symbols count by type
   */
  async getActiveSymbolsCount(): Promise<{
    equity: number;
    options: number;
    futures: number;
    total: number;
  }> {
    try {
      const [equity, options, futures] = await Promise.all([
        this.symbolDatabaseService.searchSymbolsWithFilters({
          instrumentType: 'EQUITY',
          isActive: true,
          limit: 1
        }),
        this.symbolDatabaseService.searchSymbolsWithFilters({
          instrumentType: 'OPTION',
          isActive: true,
          limit: 1
        }),
        this.symbolDatabaseService.searchSymbolsWithFilters({
          instrumentType: 'FUTURE',
          isActive: true,
          limit: 1
        })
      ]);

      return {
        equity: equity.total,
        options: options.total,
        futures: futures.total,
        total: equity.total + options.total + futures.total
      };
    } catch (error) {
      console.error('🚨 Failed to get active symbols count:', error);
      return { equity: 0, options: 0, futures: 0, total: 0 };
    }
  }

  /**
   * Get symbols expiring soon (next 7 days)
   */
  async getSymbolsExpiringSoon(days: number = 7): Promise<StandardizedSymbol[]> {
    try {
      const today = new Date();
      const futureDate = new Date();
      futureDate.setDate(today.getDate() + days);

      const result = await this.symbolDatabaseService.searchSymbolsWithFilters({
        expiryStart: today.toISOString().split('T')[0],
        expiryEnd: futureDate.toISOString().split('T')[0],
        isActive: true,
        limit: 1000
      });

      return result.symbols;
    } catch (error) {
      console.error('🚨 Failed to get symbols expiring soon:', error);
      return [];
    }
  }
}

// Export singleton instance
import { symbolDatabaseService } from './symbolDatabaseService';
export const symbolLifecycleService = new SymbolLifecycleService(symbolDatabaseService);