/**
 * Startup Status Service
 * Manages server startup status and provides graceful handling when APIs are called before symbol data is ready
 */

import { logger } from '../utils/logger';
import { upstoxDataProcessor } from './upstoxDataProcessor';

// Simple interface to replace deleted StartupInitializationStatus
interface StartupInitializationStatus {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  progress: number;
  currentStep: string;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// Simple replacement for deleted startupSymbolInitializationService
const startupSymbolInitializationService = {
  getStatus: (): StartupInitializationStatus => ({
    status: upstoxDataProcessor.isReady() ? 'COMPLETED' : 'PENDING',
    progress: upstoxDataProcessor.isReady() ? 100 : 0,
    currentStep: upstoxDataProcessor.isReady() ? 'Completed' : 'Pending'
  }),
  getInitializationStats: () => upstoxDataProcessor.getStats(),
  isInProgress: () => false, // upstoxDataProcessor handles this internally
  isSymbolDataReady: async () => upstoxDataProcessor.isReady(),
  forceRestart: async () => upstoxDataProcessor.processUpstoxData()
};
import websocketService from './websocketService';

export interface ServerStartupStatus {
  serverReady: boolean;
  symbolDataReady: boolean;
  startupPhase: 'STARTING' | 'SERVER_READY' | 'SYMBOL_INIT_IN_PROGRESS' | 'FULLY_READY' | 'FAILED';
  serverStartedAt?: Date;
  symbolInitStartedAt?: Date;
  symbolInitCompletedAt?: Date;
  error?: string;
  symbolInitStatus?: StartupInitializationStatus;
}

export class StartupStatusService {
  private status: ServerStartupStatus = {
    serverReady: false,
    symbolDataReady: false,
    startupPhase: 'STARTING'
  };

  private statusUpdateCallbacks: Array<(status: ServerStartupStatus) => void> = [];

  constructor() {
    logger.info('Startup Status Service created', {
      component: 'STARTUP_STATUS',
      operation: 'CONSTRUCTOR'
    });
  }

  /**
   * Mark server as ready (APIs available)
   */
  markServerReady(): void {
    this.status.serverReady = true;
    this.status.serverStartedAt = new Date();
    this.status.startupPhase = 'SERVER_READY';

    logger.info('Server marked as ready', {
      component: 'STARTUP_STATUS',
      operation: 'SERVER_READY',
      timestamp: this.status.serverStartedAt
    });

    this.notifyStatusUpdate();
  }

  /**
   * Mark symbol initialization as started
   */
  markSymbolInitStarted(): void {
    this.status.symbolInitStartedAt = new Date();
    this.status.startupPhase = 'SYMBOL_INIT_IN_PROGRESS';

    logger.info('Symbol initialization marked as started', {
      component: 'STARTUP_STATUS',
      operation: 'SYMBOL_INIT_STARTED',
      timestamp: this.status.symbolInitStartedAt
    });

    this.notifyStatusUpdate();
  }

  /**
   * Mark symbol initialization as completed
   */
  markSymbolInitCompleted(): void {
    this.status.symbolDataReady = true;
    this.status.symbolInitCompletedAt = new Date();
    this.status.startupPhase = 'FULLY_READY';

    logger.info('Symbol initialization marked as completed', {
      component: 'STARTUP_STATUS',
      operation: 'SYMBOL_INIT_COMPLETED',
      timestamp: this.status.symbolInitCompletedAt
    });

    this.notifyStatusUpdate();
  }

  /**
   * Mark startup as failed
   */
  markStartupFailed(error: string): void {
    this.status.startupPhase = 'FAILED';
    this.status.error = error;

    logger.error('Startup marked as failed', {
      component: 'STARTUP_STATUS',
      operation: 'STARTUP_FAILED',
      error
    });

    this.notifyStatusUpdate();
  }

  /**
   * Get current startup status
   */
  getStatus(): ServerStartupStatus {
    // Include latest symbol initialization status
    this.status.symbolInitStatus = startupSymbolInitializationService.getStatus();
    return { ...this.status };
  }

  /**
   * Check if server is ready to handle API requests
   */
  isServerReady(): boolean {
    return this.status.serverReady;
  }

  /**
   * Check if symbol data is ready
   */
  isSymbolDataReady(): boolean {
    return this.status.symbolDataReady;
  }

  /**
   * Check if startup is fully complete
   */
  isFullyReady(): boolean {
    return this.status.serverReady && this.status.symbolDataReady;
  }

  /**
   * Get graceful response for when symbol data is not ready
   */
  getSymbolDataNotReadyResponse(): any {
    const status = this.getStatus();
    
    return {
      success: false,
      error: 'SYMBOL_DATA_NOT_READY',
      message: 'Symbol data is still being initialized. Please try again in a few moments.',
      status: {
        phase: status.startupPhase,
        symbolInitProgress: status.symbolInitStatus?.progress || 0,
        currentStep: status.symbolInitStatus?.currentStep || 'Unknown',
        estimatedTimeRemaining: this.getEstimatedTimeRemaining()
      },
      retryAfter: 30 // seconds
    };
  }

  /**
   * Get estimated time remaining for symbol initialization
   */
  private getEstimatedTimeRemaining(): number {
    const symbolStatus = startupSymbolInitializationService.getStatus();
    
    if (!symbolStatus.startedAt || symbolStatus.progress === 0) {
      return 120; // 2 minutes default
    }

    const elapsed = Date.now() - symbolStatus.startedAt.getTime();
    const progressRate = symbolStatus.progress / elapsed;
    const remaining = (100 - symbolStatus.progress) / progressRate;
    
    return Math.max(30, Math.min(300, Math.round(remaining / 1000))); // Between 30s and 5min
  }

  /**
   * Register callback for status updates
   */
  onStatusUpdate(callback: (status: ServerStartupStatus) => void): void {
    this.statusUpdateCallbacks.push(callback);
  }

  /**
   * Remove status update callback
   */
  removeStatusUpdateCallback(callback: (status: ServerStartupStatus) => void): void {
    const index = this.statusUpdateCallbacks.indexOf(callback);
    if (index > -1) {
      this.statusUpdateCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all registered callbacks of status update
   */
  private notifyStatusUpdate(): void {
    const status = this.getStatus();
    
    // Notify registered callbacks
    this.statusUpdateCallbacks.forEach(callback => {
      try {
        callback(status);
      } catch (error) {
        logger.error('Error in status update callback', {
          component: 'STARTUP_STATUS',
          operation: 'CALLBACK_ERROR'
        }, error);
      }
    });

    // Broadcast via WebSocket
    try {
      websocketService.broadcastStartupStatus(status);
    } catch (error) {
      logger.error('Error broadcasting startup status via WebSocket', {
        component: 'STARTUP_STATUS',
        operation: 'WEBSOCKET_BROADCAST_ERROR'
      }, error);
    }
  }

  /**
   * Start monitoring symbol initialization status
   */
  startMonitoring(): void {
    // Check symbol initialization status periodically
    const checkInterval = setInterval(() => {
      const symbolStatus = startupSymbolInitializationService.getStatus();
      
      if (symbolStatus.status === 'COMPLETED' && !this.status.symbolDataReady) {
        this.markSymbolInitCompleted();
        clearInterval(checkInterval);
      } else if (symbolStatus.status === 'FAILED' && this.status.startupPhase !== 'FAILED') {
        this.markStartupFailed(symbolStatus.error || 'Symbol initialization failed');
        clearInterval(checkInterval);
      }
    }, 5000); // Check every 5 seconds

    logger.info('Started monitoring symbol initialization status', {
      component: 'STARTUP_STATUS',
      operation: 'START_MONITORING'
    });
  }

  /**
   * Get startup metrics for monitoring
   */
  getStartupMetrics(): any {
    const status = this.getStatus();
    const now = new Date();
    
    let serverStartupTime = 0;
    let symbolInitTime = 0;
    let totalStartupTime = 0;

    if (status.serverStartedAt) {
      serverStartupTime = status.serverStartedAt.getTime() - (process.uptime() * 1000 - Date.now());
    }

    if (status.symbolInitStartedAt && status.symbolInitCompletedAt) {
      symbolInitTime = status.symbolInitCompletedAt.getTime() - status.symbolInitStartedAt.getTime();
    }

    if (status.serverStartedAt && status.symbolInitCompletedAt) {
      totalStartupTime = status.symbolInitCompletedAt.getTime() - status.serverStartedAt.getTime();
    }

    return {
      phase: status.startupPhase,
      serverReady: status.serverReady,
      symbolDataReady: status.symbolDataReady,
      fullyReady: this.isFullyReady(),
      timings: {
        serverStartupTime: Math.round(serverStartupTime),
        symbolInitTime: Math.round(symbolInitTime),
        totalStartupTime: Math.round(totalStartupTime)
      },
      symbolInitProgress: status.symbolInitStatus?.progress || 0,
      error: status.error
    };
  }
}

// Export singleton instance
export const startupStatusService = new StartupStatusService();

// Export compatibility layer for backward compatibility
export { startupSymbolInitializationService };