/**
 * Enhanced Unified Broker Manager
 * Simplified manager that uses standardized broker modules without broker-specific logic
 * All business logic is now encapsulated in the broker modules themselves
 */

import { 
  IUnifiedBrokerService,
  UnifiedConnectionResponse,
  UnifiedOAuthResponse,
  UnifiedTokenRefreshResponse,
  UnifiedValidationResponse,
  UnifiedAccountInfo,
  UnifiedTokenInfo,
  AccountStatus
} from '@copytrade/unified-broker';

import { UnifiedBrokerFactory } from '@copytrade/unified-broker';
import { logger } from '../utils/logger';
// import { BrokerOperationContext } from './brokerErrorLoggingService';
import { traceIdService } from './traceIdService';
import TraceContext from '../utils/traceContext';

export interface EnhancedBrokerConnection {
  userId: string;
  brokerName: string;
  accountId: string;
  databaseAccountId: string; // Database account ID for mapping
  service: IUnifiedBrokerService;
  isActive: boolean;
  connectedAt: Date;
  lastActivity: Date;
  accountInfo: UnifiedAccountInfo | null;
  tokenInfo: UnifiedTokenInfo | null;
  connectionAttempts: number;
  lastError?: string | undefined;
}

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  inactiveConnections: number;
  connectionsByBroker: Record<string, number>;
  connectionsByUser: Record<string, number>;
  oldestConnection: Date | null;
  newestConnection: Date | null;
}

export class EnhancedUnifiedBrokerManager {
  private static instance: EnhancedUnifiedBrokerManager;
  private connections: Map<string, EnhancedBrokerConnection> = new Map();
  private brokerFactory: UnifiedBrokerFactory;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_INACTIVE_TIME_MS = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.brokerFactory = UnifiedBrokerFactory.getInstance();
    this.startPeriodicCleanup();
    logger.info('Enhanced Unified Broker Manager initialized with periodic cleanup', {
      component: 'ENHANCED_BROKER_MANAGER',
      operation: 'INITIALIZE'
    });
  }

  static getInstance(): EnhancedUnifiedBrokerManager {
    if (!EnhancedUnifiedBrokerManager.instance) {
      EnhancedUnifiedBrokerManager.instance = new EnhancedUnifiedBrokerManager();
    }
    return EnhancedUnifiedBrokerManager.instance;
  }

  /**
   * Test broker connection and determine authentication state
   * Unified method to handle all authentication scenarios
   */
  async testBrokerConnection(credentials: any, brokerName: string): Promise<{
    activated: boolean;
    authFlowRequired: boolean;
    authUrl?: string;
    authToken?: string;
    refreshToken?: string;
    [key: string]: any;
  }> {
    try {
      // Check if auth token exists and not expired
      if (credentials.authToken && !this.isTokenExpired(credentials.authTokenExpiry)) {
        return {
          ...credentials,
          activated: true,
          authFlowRequired: false
        };
      }

      // Check if refresh token exists
      else if (credentials.refreshToken) {
        // If refresh token not expired
        if (!this.isTokenExpired(credentials.refreshTokenExpiry)) {
          try {
            const newAuthToken = await this.refreshAuthToken(credentials);
            return {
              ...credentials,
              authToken: newAuthToken.accessToken,
              authTokenExpiry: newAuthToken.expiryTime,
              activated: true,
              authFlowRequired: false
            };
          } catch (error) {
            // Refresh failed, fall through to OAuth flow
          }
        }

        // If refresh token expired and auth url exists
        if (credentials.authUrl) {
          return {
            ...credentials,
            activated: false,
            authFlowRequired: true
          };
        }

        // If refresh token expired and auth url does not exist
        else {
          const authUrl = await this.generateAuthUrl(credentials, brokerName);
          return {
            ...credentials,
            activated: false,
            authFlowRequired: true,
            authUrl
          };
        }
      }

      // If auth code exists (OAuth callback scenario)
      else if (credentials.authCode) {
        const { authCode, ...restCreds } = credentials; // Don't save authCode as it's single-use
        const tokens = await this.generateTokensFromAuthCode(authCode, restCreds);
        return {
          ...restCreds,
          activated: true,
          authFlowRequired: false,
          authToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          authTokenExpiry: tokens.accessTokenExpiry,
          refreshTokenExpiry: tokens.refreshTokenExpiry
        };
      }

      // Direct authentication (mostly Shoonya way)
      else {
        const testResult = await this.testDirectConnection(credentials, brokerName);
        return {
          ...testResult,
          activated: testResult.success,
          authFlowRequired: !testResult.success && testResult.authUrl ? true : false
        };
      }
    } catch (error: any) {
      logger.error('Test broker connection failed', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'TEST_CONNECTION'
      }, error);

      // Return credentials with error info, don't throw
      // This allows UI to handle gracefully and potentially retry
      return {
        ...credentials,
        activated: false,
        authFlowRequired: false,
        error: error.message,
        needsManualIntervention: true
      };
    }
  }

  /**
   * Connect to a broker using unified interface with optional detailed logging
   * Now uses testBrokerConnection for unified authentication logic
   */
  async connectToBroker(
    userId: string,
    brokerName: string,
    credentials: any,
    _enableDetailedLogging: boolean = false
  ): Promise<UnifiedConnectionResponse> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();

    // Context for potential future logging
    // const context: BrokerOperationContext = {
    //   userId,
    //   brokerName,
    //   accountId: 'pending',
    //   operation: 'CONNECT_BROKER',
    //   traceId,
    //   requestDetails: {
    //     method: 'POST',
    //     url: `/api/broker/connect`,
    //     requestId: traceId
    //   }
    // };

    try {
      logger.info('Connecting to broker', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'CONNECT',
        brokerName,
        userId,
        traceId: traceId
      });

      // Use unified test connection method to determine authentication state
      const testResult = await this.testBrokerConnection(credentials, brokerName);
      const duration = performance.now() - startTime;

      // Convert test result to UnifiedConnectionResponse format
      // Always return success=true for UI compatibility, even when auth flow is required
      const result = {
        success: true, // UI expects success=true even for OAuth flows
        message: testResult.activated
          ? 'Connection successful'
          : testResult.authFlowRequired
            ? 'OAuth authentication required'
            : 'Authentication required',
        accountInfo: testResult.accountInfo || null,
        tokenInfo: testResult.authToken ? {
          accessToken: testResult.authToken,
          refreshToken: testResult.refreshToken || '',
          expiryTime: testResult.authTokenExpiry,
          isExpired: this.isTokenExpired(testResult.authTokenExpiry),
          canRefresh: !!testResult.refreshToken
        } : undefined,
        accountStatus: (testResult.activated ? 'ACTIVE' : 'PROCEED_TO_OAUTH') as AccountStatus,
        requiresAuthCode: testResult.authFlowRequired,
        authUrl: testResult.authUrl,
        authenticationStep: testResult.authFlowRequired ? 'OAUTH_REQUIRED' : 'DIRECT_AUTH'
      } as UnifiedConnectionResponse;

      if (result.success && result.accountInfo) {
        // Connection successful - create and store connection
        const connectionKey = this.createConnectionKey(userId, brokerName, result.accountInfo.accountId);

        // Create broker service instance for the connection
        const brokerService = this.brokerFactory.createBroker(brokerName);

        const connection: EnhancedBrokerConnection = {
          userId,
          brokerName,
          accountId: result.accountInfo.accountId,
          databaseAccountId: '', // Will be set by caller
          service: brokerService,
          isActive: true,
          connectedAt: new Date(),
          lastActivity: new Date(),
          accountInfo: result.accountInfo,
          tokenInfo: result.tokenInfo ? {
            ...result.tokenInfo,
            isExpired: this.isTokenExpired(result.tokenInfo?.expiryTime),
            canRefresh: !!result.tokenInfo.refreshToken
          } : null,
          connectionAttempts: 1,
          lastError: undefined
        };

        this.connections.set(connectionKey, connection);

        logger.info('Successfully connected to broker', {
          component: 'ENHANCED_BROKER_MANAGER',
          operation: 'CONNECT_SUCCESS',
          brokerName,
          userId,
          accountId: result.accountInfo.accountId,
          totalConnections: this.connections.size,
          duration: Math.round(duration),
          traceId: traceId
        });
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      logger.error('Failed to connect to broker', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'CONNECT_FAILED',
        brokerName,
        userId,
        duration: Math.round(duration),
        traceId: traceId
      }, error);

      throw error;
    }
  }

  /**
   * Complete OAuth authentication
   * No broker-specific logic - all handled by broker modules
   */
  async completeOAuthAuth(
    userId: string,
    brokerName: string,
    authCode: string,
    credentials: any,
    _enableDetailedLogging: boolean = false
  ): Promise<UnifiedOAuthResponse> {
    try {
      logger.info('Completing OAuth for broker', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'OAUTH_COMPLETE',
        brokerName,
        userId
      });

      // Create broker service instance
      const brokerService = this.brokerFactory.createBroker(brokerName);
      
      // Complete OAuth - broker handles all OAuth logic
      const result = await brokerService.completeOAuth(authCode, credentials);
      
      if (result.success && result.accountInfo) {
        // OAuth successful - create and store connection
        const connectionKey = this.createConnectionKey(userId, brokerName, result.accountInfo.accountId);
        
        const connection: EnhancedBrokerConnection = {
          userId,
          brokerName,
          accountId: result.accountInfo.accountId,
          databaseAccountId: '', // Will be set by caller
          service: brokerService,
          isActive: true,
          connectedAt: new Date(),
          lastActivity: new Date(),
          accountInfo: result.accountInfo,
          tokenInfo: result.tokenInfo || null,
          connectionAttempts: 1,
          lastError: undefined
        };

        this.connections.set(connectionKey, connection);
        
        logger.info('Successfully completed OAuth for broker', {
          component: 'ENHANCED_BROKER_MANAGER',
          operation: 'OAUTH_SUCCESS',
          brokerName,
          userId,
          accountId: result.accountInfo.accountId,
          totalConnections: this.connections.size
        });
      }
      
      return result;
    } catch (error: any) {
      logger.error('Failed to complete OAuth for broker', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'OAUTH_FAILED',
        brokerName,
        userId
      }, error);
      throw error;
    }
  }

  /**
   * Refresh token for a broker connection
   * No broker-specific logic - all handled by broker modules
   */
  async refreshToken(
    userId: string,
    brokerName: string,
    accountId: string,
    credentials: any
  ): Promise<UnifiedTokenRefreshResponse> {
    try {
      const connection = this.getConnection(userId, brokerName, accountId);
      
      if (!connection) {
        throw new Error(`No connection found for ${brokerName} account ${accountId}`);
      }

      logger.info('Refreshing token for broker', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'TOKEN_REFRESH',
        brokerName,
        accountId
      });
      
      // Refresh token - broker handles all refresh logic
      const result = await connection.service.refreshToken(credentials);
      
      if (result.success && result.tokenInfo) {
        // Update connection with new token info
        connection.tokenInfo = result.tokenInfo;
        connection.isActive = true;
        
        logger.info('Token refreshed successfully', {
          component: 'ENHANCED_BROKER_MANAGER',
          operation: 'TOKEN_REFRESH_SUCCESS',
          brokerName,
          accountId
        });
      } else {
        // Refresh failed - mark connection as inactive
        connection.isActive = false;
        logger.warn('Token refresh failed', {
          component: 'ENHANCED_BROKER_MANAGER',
          operation: 'TOKEN_REFRESH_FAILED',
          brokerName,
          accountId
        });
      }
      
      return result;
    } catch (error: any) {
      logger.error('Failed to refresh token for broker', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'TOKEN_REFRESH_ERROR',
        brokerName,
        accountId
      }, error);
      throw error;
    }
  }

  /**
   * Validate session for a broker connection
   * No broker-specific logic - all handled by broker modules
   */
  async validateSession(
    userId: string,
    brokerName: string,
    accountId: string,
    credentials: any
  ): Promise<UnifiedValidationResponse> {
    try {
      const connection = this.getConnection(userId, brokerName, accountId);
      
      if (!connection) {
        return {
          isValid: false,
          accountStatus: 'INACTIVE',
          message: `No connection found for ${brokerName} account ${accountId}`,
          errorType: 'AUTH_FAILED'
        };
      }

      // Validate session - broker handles all validation logic
      const result = await connection.service.validateSession(credentials);
      
      // Update connection status based on validation result
      connection.isActive = result.isValid;
      
      if (result.tokenInfo) {
        connection.tokenInfo = result.tokenInfo;
      }
      
      return result;
    } catch (error: any) {
      logger.error('Failed to validate session for broker', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'SESSION_VALIDATION_ERROR',
        brokerName,
        accountId
      }, error);
      
      return {
        isValid: false,
        accountStatus: 'INACTIVE',
        message: 'Session validation failed',
        errorType: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Get a broker connection
   */
  getConnection(userId: string, brokerName: string, accountId: string): EnhancedBrokerConnection | null {
    const connectionKey = this.createConnectionKey(userId, brokerName, accountId);
    return this.connections.get(connectionKey) || null;
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): EnhancedBrokerConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.userId === userId);
  }

  /**
   * Disconnect from a broker
   */
  async disconnect(userId: string, brokerName: string, accountId: string): Promise<void> {
    const connectionKey = this.createConnectionKey(userId, brokerName, accountId);
    const connection = this.connections.get(connectionKey);

    if (connection) {
      try {
        await connection.service.disconnect();
      } catch (error) {
        logger.error('Disconnect failed for broker', {
          component: 'ENHANCED_BROKER_MANAGER',
          operation: 'DISCONNECT_FAILED',
          brokerName,
          userId,
          accountId
        }, error);
      }

      this.connections.delete(connectionKey);
      logger.info('Disconnected from broker', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'DISCONNECT_SUCCESS',
        brokerName,
        userId,
        accountId,
        remainingConnections: this.connections.size
      });
    }
  }

  /**
   * Disconnect all connections for a user
   */
  async disconnectUser(userId: string): Promise<void> {
    const userConnections = this.getUserConnections(userId);
    
    for (const connection of userConnections) {
      await this.disconnect(userId, connection.brokerName, connection.accountId);
    }
  }

  /**
   * Get broker service for operations
   */
  getBrokerService(userId: string, brokerName: string, accountId: string): IUnifiedBrokerService | null {
    const connection = this.getConnection(userId, brokerName, accountId);
    return connection?.service || null;
  }

  /**
   * Get available brokers
   */
  getAvailableBrokers(): string[] {
    return this.brokerFactory.getSupportedBrokers();
  }

  /**
   * Debug: List all connections
   */
  debugListConnections(): void {
    logger.debug('Enhanced Unified Broker Manager connections', {
      component: 'ENHANCED_BROKER_MANAGER',
      operation: 'DEBUG_LIST_CONNECTIONS',
      totalConnections: this.connections.size
    });
    
    for (const [key, connection] of Array.from(this.connections)) {
      logger.debug('Connection details', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'DEBUG_CONNECTION',
        connectionKey: key,
        brokerName: connection.brokerName,
        isActive: connection.isActive,
        accountId: connection.accountId
      });
    }
  }

  /**
   * Set database account ID for a connection (for proper mapping)
   */
  setConnectionDatabaseId(userId: string, brokerName: string, accountId: string, databaseAccountId: string): void {
    const connection = this.getConnection(userId, brokerName, accountId);
    if (connection) {
      connection.databaseAccountId = databaseAccountId;
      logger.info('Database account ID set for connection', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'SET_DATABASE_ID',
        brokerName,
        accountId,
        databaseAccountId
      });
    }
  }

  /**
   * Update connection activity timestamp
   */
  updateConnectionActivity(userId: string, brokerName: string, accountId: string): void {
    const connection = this.getConnection(userId, brokerName, accountId);
    if (connection) {
      connection.lastActivity = new Date();
    }
  }

  /**
   * Mark connection as having an error
   */
  markConnectionError(userId: string, brokerName: string, accountId: string, error: string): void {
    const connection = this.getConnection(userId, brokerName, accountId);
    if (connection) {
      connection.lastError = error;
      connection.connectionAttempts++;
      connection.isActive = false;
      logger.error('Connection error marked', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'MARK_CONNECTION_ERROR',
        brokerName,
        accountId,
        error
      });
    }
  }

  /**
   * Get connection pool statistics
   */
  getConnectionPoolStats(): ConnectionPoolStats {
    const connections = Array.from(this.connections.values());
    
    if (connections.length === 0) {
      return {
        totalConnections: 0,
        activeConnections: 0,
        inactiveConnections: 0,
        connectionsByBroker: {},
        connectionsByUser: {},
        oldestConnection: null,
        newestConnection: null
      };
    }

    const activeConnections = connections.filter(conn => conn.isActive).length;
    const inactiveConnections = connections.length - activeConnections;

    // Group by broker
    const connectionsByBroker: Record<string, number> = {};
    connections.forEach(conn => {
      connectionsByBroker[conn.brokerName] = (connectionsByBroker[conn.brokerName] || 0) + 1;
    });

    // Group by user
    const connectionsByUser: Record<string, number> = {};
    connections.forEach(conn => {
      connectionsByUser[conn.userId] = (connectionsByUser[conn.userId] || 0) + 1;
    });

    // Find oldest and newest connections
    const sortedByDate = connections.sort((a, b) => a.connectedAt.getTime() - b.connectedAt.getTime());
    const oldestConnection = sortedByDate[0]?.connectedAt || null;
    const newestConnection = sortedByDate[sortedByDate.length - 1]?.connectedAt || null;

    return {
      totalConnections: connections.length,
      activeConnections,
      inactiveConnections,
      connectionsByBroker,
      connectionsByUser,
      oldestConnection,
      newestConnection
    };
  }

  /**
   * Clean up inactive connections
   */
  cleanupInactiveConnections(maxInactiveTimeMs: number = 30 * 60 * 1000): number {
    const now = Date.now();
    let cleanedCount = 0;
    const connectionsToRemove: string[] = [];

    for (const [key, connection] of Array.from(this.connections.entries())) {
      const timeSinceLastActivity = now - connection.lastActivity.getTime();
      
      // Clean up connections that are inactive and haven't been used recently
      if (!connection.isActive && timeSinceLastActivity > maxInactiveTimeMs) {
        connectionsToRemove.push(key);
      }
    }

    // Remove inactive connections
    for (const key of connectionsToRemove) {
      const connection = this.connections.get(key);
      if (connection) {
        try {
          // Attempt graceful disconnect
          connection.service.disconnect().catch(() => {
            // Ignore disconnect errors during cleanup
          });
        } catch (error) {
          // Ignore errors during cleanup
        }
        
        this.connections.delete(key);
        cleanedCount++;
        logger.info('Cleaned up inactive connection', {
          component: 'ENHANCED_BROKER_MANAGER',
          operation: 'CLEANUP_CONNECTION',
          brokerName: connection.brokerName,
          accountId: connection.accountId
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up inactive connections', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'CLEANUP_COMPLETE',
        cleanedCount
      });
    }

    return cleanedCount;
  }

  /**
   * Get connections that need attention (errors, expired tokens, etc.)
   */
  getConnectionsNeedingAttention(): EnhancedBrokerConnection[] {
    const now = new Date();
    return Array.from(this.connections.values()).filter(connection => {
      // Connection has errors
      if (connection.lastError) {
        return true;
      }

      // Connection is inactive
      if (!connection.isActive) {
        return true;
      }

      // Token is expired or expiring soon
      if (connection.tokenInfo?.expiryTime) {
        const expiryTime = new Date(connection.tokenInfo.expiryTime);
        const timeUntilExpiry = expiryTime.getTime() - now.getTime();
        const thirtyMinutes = 30 * 60 * 1000;
        
        if (timeUntilExpiry <= thirtyMinutes) {
          return true;
        }
      }

      return false;
    });
  }

  /**
   * Find connection by database account ID
   */
  findConnectionByDatabaseId(databaseAccountId: string): EnhancedBrokerConnection | null {
    for (const connection of Array.from(this.connections.values())) {
      if (connection.databaseAccountId === databaseAccountId) {
        return connection;
      }
    }
    return null;
  }

  /**
   * Get all connections for a specific broker
   */
  getBrokerConnections(brokerName: string): EnhancedBrokerConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.brokerName === brokerName);
  }

  /**
   * Enhanced debug method with detailed connection information
   */
  debugListConnectionsDetailed(): void {
    const stats = this.getConnectionPoolStats();
    
    logger.debug('Enhanced Unified Broker Manager - Connection Pool Stats', {
      component: 'ENHANCED_BROKER_MANAGER',
      operation: 'DEBUG_DETAILED_STATS',
      totalConnections: stats.totalConnections,
      activeConnections: stats.activeConnections,
      inactiveConnections: stats.inactiveConnections,
      connectionsByBroker: stats.connectionsByBroker,
      connectionsByUser: stats.connectionsByUser,
      oldestConnection: stats.oldestConnection?.toISOString(),
      newestConnection: stats.newestConnection?.toISOString()
    });

    for (const [key, connection] of this.connections.entries()) {
      logger.debug('Individual connection details', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'DEBUG_CONNECTION_DETAIL',
        connectionKey: key,
        isActive: connection.isActive,
        brokerName: connection.brokerName,
        accountId: connection.accountId,
        databaseAccountId: connection.databaseAccountId,
        connectionAttempts: connection.connectionAttempts,
        lastError: connection.lastError,
        connectedAt: connection.connectedAt.toISOString(),
        lastActivity: connection.lastActivity.toISOString()
      });
    }

    // Show connections needing attention
    const needingAttention = this.getConnectionsNeedingAttention();
    if (needingAttention.length > 0) {
      logger.warn('Connections needing attention detected', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'DEBUG_ATTENTION_NEEDED',
        count: needingAttention.length,
        connections: needingAttention.map(conn => ({
          brokerName: conn.brokerName,
          accountId: conn.accountId,
          issue: conn.lastError || 'Token expiring/expired'
        }))
      });
    }
  }

  /**
   * Start periodic cleanup of inactive connections
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanupInactiveConnections(this.MAX_INACTIVE_TIME_MS);
    }, this.CLEANUP_INTERVAL_MS);

    logger.info('Periodic connection cleanup started', {
      component: 'ENHANCED_BROKER_MANAGER',
      operation: 'START_CLEANUP',
      intervalSeconds: this.CLEANUP_INTERVAL_MS / 1000
    });
  }

  /**
   * Stop periodic cleanup
   */
  private stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Periodic connection cleanup stopped', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'STOP_CLEANUP'
      });
    }
  }

  /**
   * Destroy the manager and cleanup resources
   */
  destroy(): void {
    this.stopPeriodicCleanup();
    
    // Disconnect all connections
    const disconnectPromises = Array.from(this.connections.values()).map(async (connection) => {
      try {
        await connection.service.disconnect();
      } catch (error) {
        // Ignore disconnect errors during cleanup
      }
    });

    Promise.allSettled(disconnectPromises).then(() => {
      this.connections.clear();
      logger.info('Enhanced Unified Broker Manager destroyed', {
        component: 'ENHANCED_BROKER_MANAGER',
        operation: 'DESTROY'
      });
    });
  }

  /**
   * Create connection key for internal mapping with improved collision resistance
   */
  private createConnectionKey(userId: string, brokerName: string, accountId: string): string {
    // Normalize inputs to prevent key collisions
    const normalizedUserId = userId.toString().trim();
    const normalizedBrokerName = brokerName.toLowerCase().trim();
    const normalizedAccountId = accountId.toString().trim();

    return `${normalizedUserId}::${normalizedBrokerName}::${normalizedAccountId}`;
  }

  /**
   * Helper method to check if token is expired
   */
  private isTokenExpired(expiryTime?: string | null): boolean {
    if (!expiryTime) return false; // No expiry means token doesn't expire (like Shoonya)
    return new Date() > new Date(expiryTime);
  }

  /**
   * Helper method to refresh auth token using refresh token
   */
  private async refreshAuthToken(credentials: any): Promise<{ accessToken: string; expiryTime: string }> {
    // This would delegate to the appropriate broker service
    const brokerService = this.brokerFactory.createBroker(credentials.brokerName);
    const result = await brokerService.refreshToken(credentials.refreshToken);

    if (!result.success) {
      throw new Error(result.message || 'Failed to refresh token');
    }

    return {
      accessToken: result.tokenInfo?.accessToken || '',
      expiryTime: result.tokenInfo?.expiryTime || ''
    };
  }

  /**
   * Helper method to generate OAuth URL
   */
  private async generateAuthUrl(credentials: any, brokerName?: string): Promise<string> {
    const name = brokerName || credentials.brokerName || credentials.clientId || credentials.client_id || '';
    if (!name) {
      throw new Error('Broker name is missing for OAuth URL generation');
    }
    const brokerService = this.brokerFactory.createBroker(String(name));
    const result = await brokerService.connect(credentials);

    if (!result.authUrl) {
      throw new Error('Failed to generate OAuth URL');
    }

    return result.authUrl;
  }

  /**
   * Helper method to generate tokens from auth code
   */
  private async generateTokensFromAuthCode(authCode: string, credentials: any): Promise<{
    accessToken: string;
    refreshToken: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
  }> {
    const brokerService = this.brokerFactory.createBroker(credentials.brokerName);
    const result = await brokerService.completeOAuth(authCode, credentials);

    if (!result.success || !result.tokenInfo) {
      throw new Error(result.message || 'Failed to generate tokens from auth code');
    }

    return {
      accessToken: result.tokenInfo.accessToken || '',
      refreshToken: result.tokenInfo.refreshToken || '',
      accessTokenExpiry: result.tokenInfo.expiryTime || '',
      refreshTokenExpiry: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString() // 15 days for refresh token
    };
  }

  /**
   * Helper method to test direct connection (Shoonya style)
   */
  private async testDirectConnection(credentials: any, brokerName: string): Promise<{
    success: boolean;
    authUrl?: string;
    [key: string]: any;
  }> {
    try {
      const brokerService = this.brokerFactory.createBroker(brokerName);
      const result = await brokerService.connect(credentials);

      return {
        ...credentials,
        success: result.success,
        authUrl: result.authUrl,
        accountInfo: result.accountInfo,
        tokenInfo: result.tokenInfo
      };
    } catch (error: any) {
      return {
        ...credentials,
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const enhancedUnifiedBrokerManager = EnhancedUnifiedBrokerManager.getInstance();
