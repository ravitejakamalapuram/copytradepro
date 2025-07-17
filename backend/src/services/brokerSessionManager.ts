/**
 * Broker Session Manager
 * Monitors and manages broker session health across all connected accounts
 * Provides automatic session validation, token refresh, and health scoring
 */

import { enhancedUnifiedBrokerManager } from './enhancedUnifiedBrokerManager';
import { userDatabase } from './databaseCompatibility';

export interface SessionHealthMetrics {
  accountId: string;
  brokerName: string;
  userId: string;
  isHealthy: boolean;
  healthScore: number; // 0-100 scale
  lastValidated: Date;
  lastSuccessfulCall: Date;
  consecutiveFailures: number;
  averageResponseTime: number;
  tokenExpiryTime: Date | null;
  needsRefresh: boolean;
  errorHistory: SessionError[];
}

export interface SessionError {
  timestamp: Date;
  errorType: 'NETWORK' | 'AUTH' | 'TOKEN_EXPIRED' | 'BROKER_ERROR';
  message: string;
  responseTime?: number;
}

export interface SessionValidationResult {
  isValid: boolean;
  healthScore: number;
  needsRefresh: boolean;
  errorMessage?: string | undefined;
  responseTime: number;
}

export class BrokerSessionManager {
  private static instance: BrokerSessionManager;
  private sessionMetrics: Map<string, SessionHealthMetrics> = new Map();
  private validationInterval: NodeJS.Timeout | null = null;
  private readonly VALIDATION_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly HEALTH_CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
  private readonly MAX_ERROR_HISTORY = 10;
  private readonly TOKEN_REFRESH_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes before expiry

  private constructor() {
    this.startPeriodicValidation();
    console.log('🏥 Broker Session Manager initialized');
  }

  static getInstance(): BrokerSessionManager {
    if (!BrokerSessionManager.instance) {
      BrokerSessionManager.instance = new BrokerSessionManager();
    }
    return BrokerSessionManager.instance;
  }

  /**
   * Register a new session for monitoring
   */
  registerSession(
    userId: string,
    brokerName: string,
    accountId: string,
    tokenExpiryTime?: string | null
  ): void {
    const sessionKey = this.createSessionKey(userId, brokerName, accountId);
    
    const metrics: SessionHealthMetrics = {
      accountId,
      brokerName,
      userId,
      isHealthy: true,
      healthScore: 100,
      lastValidated: new Date(),
      lastSuccessfulCall: new Date(),
      consecutiveFailures: 0,
      averageResponseTime: 0,
      tokenExpiryTime: tokenExpiryTime ? new Date(tokenExpiryTime) : null,
      needsRefresh: false,
      errorHistory: []
    };

    this.sessionMetrics.set(sessionKey, metrics);
  }

  /**
   * Unregister a session from monitoring
   */
  unregisterSession(userId: string, brokerName: string, accountId: string): void {
    const sessionKey = this.createSessionKey(userId, brokerName, accountId);
    const removed = this.sessionMetrics.delete(sessionKey);
    
    // Session removed silently
  }

  /**
   * Get session health metrics
   */
  getSessionHealth(userId: string, brokerName: string, accountId: string): SessionHealthMetrics | null {
    const sessionKey = this.createSessionKey(userId, brokerName, accountId);
    return this.sessionMetrics.get(sessionKey) || null;
  }

  /**
   * Get all session health metrics for a user
   */
  getUserSessionHealth(userId: string): SessionHealthMetrics[] {
    return Array.from(this.sessionMetrics.values()).filter(
      metrics => metrics.userId === userId
    );
  }

  /**
   * Validate a specific session
   */
  async validateSession(
    userId: string,
    brokerName: string,
    accountId: string
  ): Promise<SessionValidationResult> {
    const startTime = Date.now();
    const sessionKey = this.createSessionKey(userId, brokerName, accountId);
    let metrics = this.sessionMetrics.get(sessionKey);

    if (!metrics) {
      // Register session if not found
      this.registerSession(userId, brokerName, accountId);
      metrics = this.sessionMetrics.get(sessionKey)!;
    }

    try {
      // Get stored credentials for validation
      const dbAccountId = await this.findDatabaseAccountId(userId, brokerName, accountId);
      if (!dbAccountId) {
        throw new Error('Account not found in database');
      }

      const credentials = await userDatabase.getAccountCredentials(dbAccountId);
      if (!credentials) {
        throw new Error('Account credentials not found');
      }

      // Validate session using enhanced unified broker manager
      const validationResult = await enhancedUnifiedBrokerManager.validateSession(
        userId,
        brokerName,
        accountId,
        credentials
      );

      const responseTime = Date.now() - startTime;

      if (validationResult.isValid) {
        // Session is valid - update metrics
        this.updateSuccessMetrics(metrics, responseTime);
        
        // Check if token needs refresh
        const needsRefresh = this.checkTokenRefreshNeeded(metrics);
        
        return {
          isValid: true,
          healthScore: metrics.healthScore,
          needsRefresh,
          responseTime
        };
      } else {
        // Session is invalid - update error metrics
        const errorType = this.categorizeError(validationResult.errorType);
        this.updateErrorMetrics(metrics, errorType, validationResult.message || 'Session validation failed', responseTime);
        
        return {
          isValid: false,
          healthScore: metrics.healthScore,
          needsRefresh: validationResult.accountStatus === 'REFRESH_REQUIRED',
          errorMessage: validationResult.message,
          responseTime
        };
      }
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const errorType = this.categorizeError(error.message);
      this.updateErrorMetrics(metrics, errorType, error.message, responseTime);
      
      return {
        isValid: false,
        healthScore: metrics.healthScore,
        needsRefresh: false,
        errorMessage: error.message,
        responseTime
      };
    }
  }

  /**
   * Attempt to refresh token for a session
   */
  async refreshSessionToken(
    userId: string,
    brokerName: string,
    accountId: string
  ): Promise<boolean> {
    try {
      console.log(`🔄 Attempting token refresh for ${brokerName} account ${accountId}`);

      // Get stored credentials for refresh
      const dbAccountId = await this.findDatabaseAccountId(userId, brokerName, accountId);
      if (!dbAccountId) {
        console.error(`❌ Account not found for token refresh: ${accountId}`);
        return false;
      }

      const credentials = await userDatabase.getAccountCredentials(dbAccountId);
      if (!credentials) {
        console.error(`❌ Credentials not found for token refresh: ${accountId}`);
        return false;
      }

      // Attempt token refresh using enhanced unified broker manager
      const refreshResult = await enhancedUnifiedBrokerManager.refreshToken(
        userId,
        brokerName,
        accountId,
        credentials
      );

      if (refreshResult.success && refreshResult.tokenInfo) {
        console.log(`✅ Token refreshed successfully for ${brokerName} account ${accountId}`);

        // Update database with new token info
        try {
          const updatedCredentials = {
            ...credentials,
            accessToken: refreshResult.tokenInfo.accessToken,
            refreshToken: refreshResult.tokenInfo.refreshToken
          };

          await userDatabase.updateConnectedAccount(dbAccountId, {
            credentials: updatedCredentials,
            token_expiry_time: refreshResult.tokenInfo.expiryTime,
            account_status: refreshResult.accountStatus
          });

          // Update session metrics
          const sessionKey = this.createSessionKey(userId, brokerName, accountId);
          const metrics = this.sessionMetrics.get(sessionKey);
          if (metrics) {
            metrics.tokenExpiryTime = refreshResult.tokenInfo.expiryTime ? new Date(refreshResult.tokenInfo.expiryTime) : null;
            metrics.needsRefresh = false;
            metrics.isHealthy = true;
            metrics.lastSuccessfulCall = new Date();
          }

          return true;
        } catch (updateError: any) {
          console.error(`⚠️ Failed to update database after token refresh:`, updateError.message);
          return false;
        }
      } else {
        console.log(`❌ Token refresh failed for ${brokerName} account ${accountId}: ${refreshResult.message}`);
        return false;
      }
    } catch (error: any) {
      console.error(`🚨 Token refresh error for ${brokerName} account ${accountId}:`, error.message);
      return false;
    }
  }

  /**
   * Start periodic session validation
   */
  private startPeriodicValidation(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
    }

    this.validationInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL_MS);

    console.log(`🔄 Periodic session validation started (every ${this.HEALTH_CHECK_INTERVAL_MS / 1000}s)`);
  }

  /**
   * Perform health check on all registered sessions
   */
  private async performHealthCheck(): Promise<void> {
    const sessions = Array.from(this.sessionMetrics.values());
    
    if (sessions.length === 0) {
      return;
    }

    console.log(`🏥 Performing health check on ${sessions.length} sessions...`);

    const healthCheckPromises = sessions.map(async (metrics) => {
      try {
        // Check if session needs validation (based on last validation time)
        const timeSinceLastValidation = Date.now() - metrics.lastValidated.getTime();
        
        if (timeSinceLastValidation > this.VALIDATION_INTERVAL_MS) {
          const result = await this.validateSession(metrics.userId, metrics.brokerName, metrics.accountId);
          
          // Attempt token refresh if needed and possible
          if (result.needsRefresh && !metrics.needsRefresh) {
            metrics.needsRefresh = true;
            
            // Attempt automatic refresh
            const refreshSuccess = await this.refreshSessionToken(
              metrics.userId,
              metrics.brokerName,
              metrics.accountId
            );
            
            if (refreshSuccess) {
              console.log(`✅ Automatic token refresh successful for ${metrics.brokerName} account ${metrics.accountId}`);
            } else {
              console.log(`⚠️ Automatic token refresh failed for ${metrics.brokerName} account ${metrics.accountId}`);
            }
          }
        }
      } catch (error: any) {
        console.error(`🚨 Health check error for ${metrics.brokerName} account ${metrics.accountId}:`, error.message);
      }
    });

    await Promise.allSettled(healthCheckPromises);
    
    const healthySessions = sessions.filter(s => s.isHealthy).length;
    console.log(`🏥 Health check completed: ${healthySessions}/${sessions.length} sessions healthy`);
  }

  /**
   * Update metrics after successful operation
   */
  private updateSuccessMetrics(metrics: SessionHealthMetrics, responseTime: number): void {
    metrics.lastValidated = new Date();
    metrics.lastSuccessfulCall = new Date();
    metrics.consecutiveFailures = 0;
    metrics.isHealthy = true;
    
    // Update average response time
    if (metrics.averageResponseTime === 0) {
      metrics.averageResponseTime = responseTime;
    } else {
      metrics.averageResponseTime = (metrics.averageResponseTime * 0.8) + (responseTime * 0.2);
    }
    
    // Calculate health score (100 for healthy sessions)
    metrics.healthScore = Math.min(100, metrics.healthScore + 5);
  }

  /**
   * Update metrics after error
   */
  private updateErrorMetrics(
    metrics: SessionHealthMetrics,
    errorType: SessionError['errorType'],
    message: string,
    responseTime: number
  ): void {
    metrics.lastValidated = new Date();
    metrics.consecutiveFailures++;
    
    // Add to error history
    const error: SessionError = {
      timestamp: new Date(),
      errorType,
      message,
      responseTime
    };
    
    metrics.errorHistory.unshift(error);
    if (metrics.errorHistory.length > this.MAX_ERROR_HISTORY) {
      metrics.errorHistory.pop();
    }
    
    // Update health score based on consecutive failures
    const healthPenalty = Math.min(50, metrics.consecutiveFailures * 10);
    metrics.healthScore = Math.max(0, 100 - healthPenalty);
    
    // Mark as unhealthy if too many consecutive failures
    metrics.isHealthy = metrics.consecutiveFailures < 3;
    
    // Set refresh flag for token-related errors
    if (errorType === 'TOKEN_EXPIRED' || errorType === 'AUTH') {
      metrics.needsRefresh = true;
    }
  }

  /**
   * Check if token needs refresh based on expiry time
   */
  private checkTokenRefreshNeeded(metrics: SessionHealthMetrics): boolean {
    if (!metrics.tokenExpiryTime) {
      return false; // No expiry time (e.g., Shoonya infinity tokens)
    }
    
    const now = Date.now();
    const expiryTime = metrics.tokenExpiryTime.getTime();
    const timeUntilExpiry = expiryTime - now;
    
    return timeUntilExpiry <= this.TOKEN_REFRESH_THRESHOLD_MS;
  }

  /**
   * Categorize error for metrics
   */
  private categorizeError(errorMessage?: string): SessionError['errorType'] {
    if (!errorMessage) return 'BROKER_ERROR';
    
    const message = errorMessage.toLowerCase();
    
    if (message.includes('token') || message.includes('expired') || message.includes('unauthorized')) {
      return 'TOKEN_EXPIRED';
    } else if (message.includes('auth') || message.includes('login') || message.includes('credential')) {
      return 'AUTH';
    } else if (message.includes('network') || message.includes('timeout') || message.includes('connection')) {
      return 'NETWORK';
    } else {
      return 'BROKER_ERROR';
    }
  }

  /**
   * Find database account ID from broker account ID
   */
  private async findDatabaseAccountId(userId: string, brokerName: string, accountId: string): Promise<string | null> {
    try {
      const accounts = await userDatabase.getConnectedAccountsByUserId(userId);
      const account = accounts.find(acc => 
        acc.broker_name === brokerName && acc.account_id === accountId
      );
      return account ? account.id.toString() : null;
    } catch (error: any) {
      console.error('Failed to find database account ID:', error.message);
      return null;
    }
  }

  /**
   * Create session key for internal mapping
   */
  private createSessionKey(userId: string, brokerName: string, accountId: string): string {
    return `${userId}_${brokerName}_${accountId}`;
  }

  /**
   * Get overall health statistics
   */
  getHealthStatistics(): {
    totalSessions: number;
    healthySessions: number;
    unhealthySessions: number;
    averageHealthScore: number;
    sessionsNeedingRefresh: number;
  } {
    const sessions = Array.from(this.sessionMetrics.values());
    
    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        healthySessions: 0,
        unhealthySessions: 0,
        averageHealthScore: 0,
        sessionsNeedingRefresh: 0
      };
    }
    
    const healthySessions = sessions.filter(s => s.isHealthy).length;
    const unhealthySessions = sessions.length - healthySessions;
    const averageHealthScore = sessions.reduce((sum, s) => sum + s.healthScore, 0) / sessions.length;
    const sessionsNeedingRefresh = sessions.filter(s => s.needsRefresh).length;
    
    return {
      totalSessions: sessions.length,
      healthySessions,
      unhealthySessions,
      averageHealthScore: Math.round(averageHealthScore),
      sessionsNeedingRefresh
    };
  }

  /**
   * Debug method to list all session metrics
   */
  debugListSessions(): void {
    console.log(`🏥 Broker Session Manager - Monitoring ${this.sessionMetrics.size} sessions:`);
    
    for (const [key, metrics] of this.sessionMetrics.entries()) {
      const status = metrics.isHealthy ? '✅' : '❌';
      const refresh = metrics.needsRefresh ? '🔄' : '';
      console.log(`  ${status}${refresh} ${key}: Health ${metrics.healthScore}% | Failures: ${metrics.consecutiveFailures} | Avg Response: ${Math.round(metrics.averageResponseTime)}ms`);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
    
    this.sessionMetrics.clear();
    console.log('🏥 Broker Session Manager destroyed');
  }
}

// Export singleton instance
export const brokerSessionManager = BrokerSessionManager.getInstance();