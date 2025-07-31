import { SymbolLifecycleService } from './symbolLifecycleService';
import { symbolDatabaseService } from './symbolDatabaseService';

/**
 * Symbol Lifecycle Manager
 * Manages the initialization and provides access to the symbol lifecycle service
 */
class SymbolLifecycleManager {
  private lifecycleService: SymbolLifecycleService | null = null;
  private isInitialized: boolean = false;

  /**
   * Initialize the lifecycle service
   */
  async initialize(): Promise<void> {
    try {
      // Ensure database service is initialized
      if (!symbolDatabaseService.isReady()) {
        await symbolDatabaseService.initialize();
      }

      // Create lifecycle service instance
      this.lifecycleService = new SymbolLifecycleService(symbolDatabaseService);
      this.isInitialized = true;

      console.log('✅ Symbol Lifecycle Manager initialized successfully');
    } catch (error) {
      console.error('🚨 Failed to initialize Symbol Lifecycle Manager:', error);
      throw error;
    }
  }

  /**
   * Get the lifecycle service instance
   */
  getService(): SymbolLifecycleService {
    if (!this.isInitialized || !this.lifecycleService) {
      throw new Error('Symbol Lifecycle Manager not initialized. Call initialize() first.');
    }
    return this.lifecycleService;
  }

  /**
   * Check if the manager is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.lifecycleService !== null;
  }
}

// Export singleton instance
export const symbolLifecycleManager = new SymbolLifecycleManager();

// Export the service getter for convenience
export const getSymbolLifecycleService = (): SymbolLifecycleService => {
  return symbolLifecycleManager.getService();
};