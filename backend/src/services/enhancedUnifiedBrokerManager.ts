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

export interface EnhancedBrokerConnection {
  userId: string;
  brokerName: string;
  accountId: string;
  service: IUnifiedBrokerService;
  isActive: boolean;
  connectedAt: Date;
  accountInfo: UnifiedAccountInfo | null;
  tokenInfo: UnifiedTokenInfo | null;
}

export class EnhancedUnifiedBrokerManager {
  private static instance: EnhancedUnifiedBrokerManager;
  private connections: Map<string, EnhancedBrokerConnection> = new Map();
  private brokerFactory: UnifiedBrokerFactory;

  private constructor() {
    this.brokerFactory = UnifiedBrokerFactory.getInstance();
    console.log('🚀 Enhanced Unified Broker Manager initialized');
  }

  static getInstance(): EnhancedUnifiedBrokerManager {
    if (!EnhancedUnifiedBrokerManager.instance) {
      EnhancedUnifiedBrokerManager.instance = new EnhancedUnifiedBrokerManager();
    }
    return EnhancedUnifiedBrokerManager.instance;
  }

  /**
   * Connect to a broker using unified interface
   * No broker-specific logic - all handled by broker modules
   */
  async connectToBroker(
    userId: string, 
    brokerName: string, 
    credentials: any
  ): Promise<UnifiedConnectionResponse> {
    try {
      console.log(`🔄 Connecting to ${brokerName} for user ${userId}`);

      // Create broker service instance
      const brokerService = this.brokerFactory.createBroker(brokerName);
      
      // Attempt connection - broker handles all authentication logic
      const result = await brokerService.connect(credentials);
      
      if (result.success && result.accountInfo) {
        // Connection successful - create and store connection
        const connectionKey = this.createConnectionKey(userId, brokerName, result.accountInfo.accountId);
        
        const connection: EnhancedBrokerConnection = {
          userId,
          brokerName,
          accountId: result.accountInfo.accountId,
          service: brokerService,
          isActive: true,
          connectedAt: new Date(),
          accountInfo: result.accountInfo,
          tokenInfo: result.tokenInfo || null
        };

        this.connections.set(connectionKey, connection);
        
        console.log(`✅ Successfully connected to ${brokerName} for user ${userId}, account ${result.accountInfo.accountId}`);
        console.log(`📊 Total connections: ${this.connections.size}`);
      }
      
      return result;
    } catch (error: any) {
      console.error(`🚨 Failed to connect to ${brokerName}:`, error.message);
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
    credentials: any
  ): Promise<UnifiedOAuthResponse> {
    try {
      console.log(`🔄 Completing OAuth for ${brokerName} with user ${userId}`);

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
          service: brokerService,
          isActive: true,
          connectedAt: new Date(),
          accountInfo: result.accountInfo,
          tokenInfo: result.tokenInfo || null
        };

        this.connections.set(connectionKey, connection);
        
        console.log(`✅ Successfully completed OAuth for ${brokerName}, user ${userId}, account ${result.accountInfo.accountId}`);
        console.log(`📊 Total connections: ${this.connections.size}`);
      }
      
      return result;
    } catch (error: any) {
      console.error(`🚨 Failed to complete OAuth for ${brokerName}:`, error.message);
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

      console.log(`🔄 Refreshing token for ${brokerName} account ${accountId}`);
      
      // Refresh token - broker handles all refresh logic
      const result = await connection.service.refreshToken(credentials);
      
      if (result.success && result.tokenInfo) {
        // Update connection with new token info
        connection.tokenInfo = result.tokenInfo;
        connection.isActive = true;
        
        console.log(`✅ Token refreshed successfully for ${brokerName} account ${accountId}`);
      } else {
        // Refresh failed - mark connection as inactive
        connection.isActive = false;
        console.log(`❌ Token refresh failed for ${brokerName} account ${accountId}`);
      }
      
      return result;
    } catch (error: any) {
      console.error(`🚨 Failed to refresh token for ${brokerName}:`, error.message);
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
      console.error(`🚨 Failed to validate session for ${brokerName}:`, error.message);
      
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
        console.error(`🚨 Disconnect failed for ${brokerName}:`, error);
      }

      this.connections.delete(connectionKey);
      console.log(`✅ Disconnected from ${brokerName} for user ${userId}, account ${accountId}`);
      console.log(`📊 Remaining connections: ${this.connections.size}`);
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
    console.log(`📊 Enhanced Unified Broker Manager - Total connections: ${this.connections.size}`);
    
    for (const [key, connection] of this.connections) {
      console.log(`  🔗 ${key}: ${connection.brokerName} | Active: ${connection.isActive} | Account: ${connection.accountId}`);
    }
  }

  /**
   * Create connection key for internal mapping
   */
  private createConnectionKey(userId: string, brokerName: string, accountId: string): string {
    return `${userId}_${brokerName}_${accountId}`;
  }
}

// Export singleton instance
export const enhancedUnifiedBrokerManager = EnhancedUnifiedBrokerManager.getInstance();
