/**
 * Robust Error Logging Service
 * Handles error logging with circuit breaker pattern and queue management
 * Prevents infinite loops and backpressure issues
 */

import { logger } from '../utils/logger';
import { ErrorLog } from '../models/errorLogModels';

interface QueuedError {
  id: string;
  timestamp: Date;
  level: string;
  message: string;
  context: any;
  data?: any;
  retryCount: number;
  maxRetries: number;
}

class RobustErrorLoggingService {
  private errorQueue: QueuedError[] = [];
  private maxQueueSize = 1000;
  private isProcessing = false;
  private processingInterval = 5000; // 5 seconds
  private processingTimer?: NodeJS.Timeout;
  
  // Circuit breaker for database operations
  private circuitBreaker = {
    isOpen: false,
    failureCount: 0,
    maxFailures: 5,
    resetTimeout: 30000, // 30 seconds
    lastFailureTime: 0
  };

  constructor() {
    this.startProcessing();
  }

  /**
   * Log error with circuit breaker protection
   */
  public async logError(
    level: string,
    message: string,
    context: any,
    data?: any
  ): Promise<void> {
    const errorEntry: QueuedError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message,
      context,
      data,
      retryCount: 0,
      maxRetries: 3
    };

    // Try immediate logging if circuit breaker is closed
    if (!this.circuitBreaker.isOpen) {
      const success = await this.tryLogToDatabase(errorEntry);
      if (success) {
        return;
      }
    }

    // Add to queue for retry
    this.addToQueue(errorEntry);
  }

  /**
   * Check if circuit breaker allows database operations
   */
  private canAccessDatabase(): boolean {
    const now = Date.now();
    
    // If circuit is closed, allow operations
    if (!this.circuitBreaker.isOpen) {
      return true;
    }
    
    // If enough time has passed, try to reset circuit breaker
    if (now - this.circuitBreaker.lastFailureTime > this.circuitBreaker.resetTimeout) {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      return true;
    }
    
    return false;
  }

  /**
   * Record circuit breaker success
   */
  private recordSuccess(): void {
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failureCount = 0;
  }

  /**
   * Record circuit breaker failure
   */
  private recordFailure(): void {
    this.circuitBreaker.failureCount++;
    this.circuitBreaker.lastFailureTime = Date.now();
    
    if (this.circuitBreaker.failureCount >= this.circuitBreaker.maxFailures) {
      this.circuitBreaker.isOpen = true;
      console.warn('Error logging circuit breaker opened - database issues detected');
    }
  }

  /**
   * Map source values to valid enum values
   */
  private mapSourceToEnum(source?: string): 'UI' | 'BE' | 'DB' | 'API' {
    if (!source) return 'BE';
    
    switch (source.toLowerCase()) {
      case 'frontend':
      case 'ui':
        return 'UI';
      case 'backend':
      case 'be':
        return 'BE';
      case 'database':
      case 'db':
        return 'DB';
      case 'api':
        return 'API';
      default:
        return 'BE';
    }
  }

  /**
   * Try to log error to database
   */
  private async tryLogToDatabase(errorEntry: QueuedError): Promise<boolean> {
    try {
      // Don't use the logger here to prevent infinite loops
      // Instead, directly save to database
      const errorLog = new ErrorLog({
        errorId: errorEntry.id,
        traceId: errorEntry.context.traceId || errorEntry.id,
        timestamp: errorEntry.timestamp,
        level: errorEntry.level.toUpperCase(),
        source: this.mapSourceToEnum(errorEntry.context.source) || 'BE',
        component: errorEntry.context.component || 'UNKNOWN',
        operation: errorEntry.context.operation || 'LOG_ERROR',
        message: errorEntry.message,
        errorType: errorEntry.context.errorType || 'GENERAL',
        context: {
          requestId: errorEntry.context.requestId,
          userId: errorEntry.context.userId,
          sessionId: errorEntry.context.sessionId,
          userAgent: errorEntry.context.userAgent,
          ipAddress: errorEntry.context.ipAddress,
          brokerName: errorEntry.context.brokerName,
          accountId: errorEntry.context.accountId,
          url: errorEntry.context.url,
          method: errorEntry.context.method,
          statusCode: errorEntry.context.statusCode,
          duration: errorEntry.context.duration,
          retryCount: errorEntry.retryCount
        },
        stackTrace: errorEntry.data?.error?.stack || errorEntry.data?.stack,
        metadata: {
          environment: process.env.NODE_ENV || 'development',
          version: process.env.APP_VERSION || '1.0.0',
          nodeVersion: process.version,
          platform: process.platform
        }
      });

      await errorLog.save();
      this.recordSuccess();
      return true;
    } catch (error) {
      this.recordFailure();
      console.error('Failed to save error log to database:', error);
      return false;
    }
  }

  /**
   * Add error to queue
   */
  private addToQueue(errorEntry: QueuedError): void {
    // Prevent queue overflow
    if (this.errorQueue.length >= this.maxQueueSize) {
      // Remove oldest entries
      this.errorQueue = this.errorQueue.slice(-this.maxQueueSize + 1);
    }

    this.errorQueue.push(errorEntry);
  }

  /**
   * Start background processing of error queue
   */
  private startProcessing(): void {
    this.processingTimer = setInterval(() => {
      this.processQueue();
    }, this.processingInterval);
  }

  /**
   * Process error queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.errorQueue.length === 0) {
      return;
    }

    // Don't process if circuit breaker is open
    if (!this.canAccessDatabase()) {
      return;
    }

    this.isProcessing = true;

    try {
      // Process errors in small batches to avoid overwhelming the database
      const batchSize = 10;
      const batch = this.errorQueue.splice(0, batchSize);
      
      for (const errorEntry of batch) {
        const success = await this.tryLogToDatabase(errorEntry);
        
        if (!success) {
          errorEntry.retryCount++;
          
          // Re-queue if under retry limit
          if (errorEntry.retryCount < errorEntry.maxRetries) {
            this.errorQueue.unshift(errorEntry);
          } else {
            // Log to console as last resort
            console.error('Failed to log error after max retries:', {
              id: errorEntry.id,
              message: errorEntry.message,
              retryCount: errorEntry.retryCount
            });
          }
          
          // Stop processing batch if database is having issues
          break;
        }
        
        // Small delay between database operations
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('Error processing error queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): {
    queueSize: number;
    circuitBreakerOpen: boolean;
    failureCount: number;
    isProcessing: boolean;
  } {
    return {
      queueSize: this.errorQueue.length,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      failureCount: this.circuitBreaker.failureCount,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Force process queue (for testing or manual intervention)
   */
  public async forceProcessQueue(): Promise<void> {
    await this.processQueue();
  }

  /**
   * Clear error queue
   */
  public clearQueue(): void {
    this.errorQueue = [];
  }

  /**
   * Reset circuit breaker
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failureCount = 0;
    this.circuitBreaker.lastFailureTime = 0;
  }

  /**
   * Cleanup service
   */
  public destroy(): void {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    
    // Process remaining queue items
    this.forceProcessQueue();
  }
}

// Export singleton instance
export const robustErrorLoggingService = new RobustErrorLoggingService();

export default robustErrorLoggingService;