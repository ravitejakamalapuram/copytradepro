/**
 * Tracked Broker Manager
 * Wraps the Enhanced Unified Broker Manager with comprehensive error logging
 */

import { 
  EnhancedUnifiedBrokerManager,
  EnhancedBrokerConnection,
  ConnectionPoolStats
} from './enhancedUnifiedBrokerManager';
import { 
  IUnifiedBrokerService,
  UnifiedConnectionResponse,
  UnifiedOAuthResponse,
  UnifiedTokenRefreshResponse,
  UnifiedValidationResponse
} from '@copytrade/unified-broker';
import { brokerErrorLoggingService, BrokerOperationContext } from './brokerErrorLoggingService';
import { traceIdService } from './traceIdService';
import TraceContext from '../utils/traceContext';
import { logger } from '../utils/logger';

/**
 * Wrapper class that adds error logging to all broker operations
 */
export class TrackedBrokerManager {
  private static instance: TrackedBrokerManager;
  private brokerManager: EnhancedUnifiedBrokerManager;

  private constructor() {
    this.brokerManager = EnhancedUnifiedBrokerManager.getInstance();
  }

  public static getInstance(): TrackedBrokerManager {
    if (!TrackedBrokerManager.instance) {
      TrackedBrokerManager.instance = new TrackedBrokerManager();
    }
    return TrackedBrokerManager.instance;
  }

  /**
   * Connect to broker with error logging
   */
  async connectToBroker(
    userId: string,
    brokerName: string,
    credentials: any
  ): Promise<UnifiedConnectionResponse> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId,
      brokerName,
      accountId: 'pending',
      operation: 'CONNECT_BROKER',
      traceId,
      requestDetails: {
        method: 'POST',
        url: `/api/broker/connect`,
        requestId: traceId
      }
    };

    try {
      // Add trace operation
      await traceIdService.addOperation(traceId, 'CONNECT_BROKER', 'BROKER_MANAGER');

      logger.info(`Attempting to connect to ${brokerName}`, {
        component: 'TRACKED_BROKER_MANAGER',
        operation: 'CONNECT_BROKER',
        traceId,
        userId,
        brokerName
      });

      const result = await this.brokerManager.connectToBroker(userId, brokerName, credentials);
      const duration = performance.now() - startTime;

      if (result.success) {
        // Log successful connection
        await brokerErrorLoggingService.logBrokerSuccess(
          `Successfully connected to ${brokerName}`,
          {
            ...context,
            accountId: result.accountInfo?.accountId || 'unknown',
            requestDetails: {
              ...context.requestDetails,
              duration
            },
            accountInfo: {
              // balance: result.accountInfo?.balance, // Not available in UnifiedAccountInfo
              // marginAvailable: result.accountInfo?.marginAvailable // Not available in UnifiedAccountInfo
            }
          }
        );

        // Complete trace operation
        await traceIdService.completeOperation(
          traceId,
          'CONNECT_BROKER',
          'SUCCESS',
          { 
            brokerName, 
            accountId: result.accountInfo?.accountId,
            duration 
          }
        );

        logger.info(`Successfully connected to ${brokerName}`, {
          component: 'TRACKED_BROKER_MANAGER',
          operation: 'CONNECT_BROKER',
          traceId,
          userId,
          brokerName,
          accountId: result.accountInfo?.accountId,
          duration
        });
      } else {
        // Log connection failure
        await brokerErrorLoggingService.logBrokerError(
          result.message || 'Connection failed',
          new Error(result.message || 'Unknown connection error'),
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        // Complete trace operation with error
        await traceIdService.completeOperation(
          traceId,
          'CONNECT_BROKER',
          'ERROR',
          { 
            brokerName, 
            error: result.message,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      // Log connection error
      await brokerErrorLoggingService.logBrokerError(
        `Failed to connect to ${brokerName}: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      // Complete trace operation with error
      await traceIdService.completeOperation(
        traceId,
        'CONNECT_BROKER',
        'ERROR',
        { 
          brokerName, 
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }

  /**
   * Complete OAuth with error logging
   */
  async completeOAuthAuth(
    userId: string,
    brokerName: string,
    authCode: string,
    credentials: any
  ): Promise<UnifiedOAuthResponse> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId,
      brokerName,
      accountId: 'pending',
      operation: 'COMPLETE_OAUTH',
      traceId,
      requestDetails: {
        method: 'POST',
        url: `/api/broker/oauth/complete`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'COMPLETE_OAUTH', 'BROKER_MANAGER');

      const result = await this.brokerManager.completeOAuthAuth(userId, brokerName, authCode, credentials);
      const duration = performance.now() - startTime;

      if (result.success) {
        await brokerErrorLoggingService.logBrokerSuccess(
          `OAuth completed successfully for ${brokerName}`,
          {
            ...context,
            accountId: result.accountInfo?.accountId || 'unknown',
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'COMPLETE_OAUTH',
          'SUCCESS',
          { 
            brokerName, 
            accountId: result.accountInfo?.accountId,
            duration 
          }
        );
      } else {
        await brokerErrorLoggingService.logBrokerError(
          result.message || 'OAuth completion failed',
          new Error(result.message || 'Unknown OAuth error'),
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'COMPLETE_OAUTH',
          'ERROR',
          { 
            brokerName, 
            error: result.message,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `OAuth completion failed for ${brokerName}: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'COMPLETE_OAUTH',
        'ERROR',
        { 
          brokerName, 
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }

  /**
   * Validate session with error logging
   */
  async validateSession(
    userId: string,
    brokerName: string,
    accountId: string,
    credentials: any
  ): Promise<UnifiedValidationResponse> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId,
      brokerName,
      accountId,
      operation: 'VALIDATE_SESSION',
      traceId,
      requestDetails: {
        method: 'POST',
        url: `/api/broker/validate`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'VALIDATE_SESSION', 'BROKER_MANAGER');

      const result = await this.brokerManager.validateSession(userId, brokerName, accountId, credentials);
      const duration = performance.now() - startTime;

      if (result.isValid) {
        await brokerErrorLoggingService.logBrokerSuccess(
          `Session validation successful for ${brokerName}`,
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'VALIDATE_SESSION',
          'SUCCESS',
          { 
            brokerName, 
            accountId,
            duration 
          }
        );
      } else {
        await brokerErrorLoggingService.logBrokerWarning(
          `Session validation failed for ${brokerName}: ${result.message}`,
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'VALIDATE_SESSION',
          'ERROR',
          { 
            brokerName, 
            accountId,
            error: result.message,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `Session validation error for ${brokerName}: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'VALIDATE_SESSION',
        'ERROR',
        { 
          brokerName, 
          accountId,
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }

  /**
   * Refresh token with error logging
   */
  async refreshToken(
    userId: string,
    brokerName: string,
    accountId: string,
    credentials: any
  ): Promise<UnifiedTokenRefreshResponse> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId,
      brokerName,
      accountId,
      operation: 'REFRESH_TOKEN',
      traceId,
      requestDetails: {
        method: 'POST',
        url: `/api/broker/refresh`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'REFRESH_TOKEN', 'BROKER_MANAGER');

      const result = await this.brokerManager.refreshToken(userId, brokerName, accountId, credentials);
      const duration = performance.now() - startTime;

      if (result.success) {
        await brokerErrorLoggingService.logBrokerSuccess(
          `Token refresh successful for ${brokerName}`,
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'REFRESH_TOKEN',
          'SUCCESS',
          { 
            brokerName, 
            accountId,
            duration 
          }
        );
      } else {
        await brokerErrorLoggingService.logBrokerError(
          result.message || 'Token refresh failed',
          new Error(result.message || 'Unknown token refresh error'),
          {
            ...context,
            requestDetails: {
              ...context.requestDetails,
              duration
            }
          }
        );

        await traceIdService.completeOperation(
          traceId,
          'REFRESH_TOKEN',
          'ERROR',
          { 
            brokerName, 
            accountId,
            error: result.message,
            duration 
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `Token refresh error for ${brokerName}: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'REFRESH_TOKEN',
        'ERROR',
        { 
          brokerName, 
          accountId,
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }

  /**
   * Disconnect from broker with error logging
   */
  async disconnect(userId: string, brokerName: string, accountId: string): Promise<void> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const context: BrokerOperationContext = {
      userId,
      brokerName,
      accountId,
      operation: 'DISCONNECT_BROKER',
      traceId,
      requestDetails: {
        method: 'POST',
        url: `/api/broker/disconnect`,
        requestId: traceId
      }
    };

    try {
      await traceIdService.addOperation(traceId, 'DISCONNECT_BROKER', 'BROKER_MANAGER');

      await this.brokerManager.disconnect(userId, brokerName, accountId);
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerSuccess(
        `Successfully disconnected from ${brokerName}`,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'DISCONNECT_BROKER',
        'SUCCESS',
        { 
          brokerName, 
          accountId,
          duration 
        }
      );
    } catch (error: any) {
      const duration = performance.now() - startTime;

      await brokerErrorLoggingService.logBrokerError(
        `Failed to disconnect from ${brokerName}: ${error.message}`,
        error,
        {
          ...context,
          requestDetails: {
            ...context.requestDetails,
            duration
          }
        }
      );

      await traceIdService.completeOperation(
        traceId,
        'DISCONNECT_BROKER',
        'ERROR',
        { 
          brokerName, 
          accountId,
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }

  // Delegate methods that don't need error logging (read-only operations)
  getConnection(userId: string, brokerName: string, accountId: string): EnhancedBrokerConnection | null {
    return this.brokerManager.getConnection(userId, brokerName, accountId);
  }

  getBrokerService(userId: string, brokerName: string, accountId: string): IUnifiedBrokerService | null {
    return this.brokerManager.getBrokerService(userId, brokerName, accountId);
  }

  getUserConnections(userId: string): EnhancedBrokerConnection[] {
    return this.brokerManager.getUserConnections(userId);
  }

  getAvailableBrokers(): string[] {
    return this.brokerManager.getAvailableBrokers();
  }

  getConnectionPoolStats(): ConnectionPoolStats {
    return this.brokerManager.getConnectionPoolStats();
  }

  setConnectionDatabaseId(userId: string, brokerName: string, accountId: string, databaseAccountId: string): void {
    return this.brokerManager.setConnectionDatabaseId(userId, brokerName, accountId, databaseAccountId);
  }

  // cleanup(): void {
  //   return this.brokerManager.cleanup(); // Method doesn't exist in EnhancedUnifiedBrokerManager
  // }
}

// Export singleton instance
export const trackedBrokerManager = TrackedBrokerManager.getInstance();