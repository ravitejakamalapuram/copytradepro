/**
 * Unified Broker Manager
 * Manages broker connections using the unified broker interface
 * Replaces legacy broker-specific implementations
 */

import { BrokerRegistry, IBrokerService, BrokerCredentials, LoginResponse } from '@copytrade/unified-broker';
import { userDatabase } from './databaseCompatibility';

export interface BrokerConnection {
  userId: string;
  brokerName: string;
  accountId: string;
  service: IBrokerService;
  isActive: boolean;
  connectedAt: Date;
}

export class UnifiedBrokerManager {
  private static instance: UnifiedBrokerManager;
  private connections: Map<string, BrokerConnection> = new Map();
  private brokerRegistry: BrokerRegistry;

  private constructor() {
    this.brokerRegistry = BrokerRegistry.getInstance();
  }

  static getInstance(): UnifiedBrokerManager {
    if (!UnifiedBrokerManager.instance) {
      UnifiedBrokerManager.instance = new UnifiedBrokerManager();
    }
    return UnifiedBrokerManager.instance;
  }

  /**
   * Create a connection key for storing connections
   */
  private createConnectionKey(userId: string, brokerName: string, accountId: string): string {
    return `${userId}_${brokerName}_${accountId}`;
  }

  /**
   * Connect to a broker using unified interface
   */
  async connectToBroker(
    userId: string, 
    brokerName: string, 
    credentials: BrokerCredentials
  ): Promise<{ success: boolean; accountId?: string; message?: string; authUrl?: string }> {
    try {
      // Check if broker is available
      if (!this.brokerRegistry.isBrokerAvailable(brokerName)) {
        throw new Error(`Broker ${brokerName} is not available`);
      }

      // Create temporary broker instance for login
      const tempBrokerService = this.brokerRegistry.createBroker(brokerName);

      // Attempt login
      const loginResult: LoginResponse = await tempBrokerService.login(credentials);

      if (!loginResult.success) {
        // Check if this is an OAuth flow that needs auth URL
        if (loginResult.data?.authUrl) {
          return {
            success: false,
            authUrl: loginResult.data.authUrl,
            message: loginResult.message || 'Authentication URL generated'
          };
        }
        throw new Error(loginResult.message || 'Login failed');
      }

      // Get account ID from the broker service
      const accountId = tempBrokerService.getAccountId();
      if (!accountId) {
        throw new Error('Failed to get account ID from broker');
      }

      // For now, use the temp service directly as the account-specific service
      // This avoids session transfer issues while maintaining isolation per account
      const accountSpecificService = tempBrokerService;

      // Store this instance as the account-specific instance in the registry
      // This ensures each account gets its own isolated instance with proper session
      const accountKey = `${brokerName.toLowerCase()}_${accountId}`;
      (this.brokerRegistry as any).accountInstances.set(accountKey, accountSpecificService);

      console.log(`✅ Using temp service as account-specific service for ${brokerName} account ${accountId}`);

      // Create connection with account-specific service
      const connectionKey = this.createConnectionKey(userId, brokerName, accountId);
      const connection: BrokerConnection = {
        userId,
        brokerName,
        accountId,
        service: accountSpecificService,
        isActive: true,
        connectedAt: new Date()
      };

      this.connections.set(connectionKey, connection);

      console.log(`✅ Successfully connected to ${brokerName} for user ${userId}, account ${accountId}`);
      console.log(`📊 Total connections: ${this.connections.size}`);
      
      return {
        success: true,
        accountId,
        message: `Successfully connected to ${brokerName}`
      };

    } catch (error: any) {
      console.error(`🚨 Failed to connect to ${brokerName}:`, error.message);
      
      // Check if error contains auth URL (for OAuth flows)
      if (error.authUrl) {
        return {
          success: false,
          authUrl: error.authUrl,
          message: error.message || 'Authentication required'
        };
      }
      
      throw error;
    }
  }

  /**
   * Complete OAuth authentication
   */
  async completeOAuthAuth(
    userId: string,
    brokerName: string,
    authCode: string,
    credentials: BrokerCredentials
  ): Promise<{ success: boolean; accountId?: string; message?: string }> {
    try {
      // Check if broker is available
      if (!this.brokerRegistry.isBrokerAvailable(brokerName)) {
        throw new Error(`Broker ${brokerName} is not available`);
      }

      // Create temporary broker instance for OAuth completion
      const tempBrokerService = this.brokerRegistry.createBroker(brokerName);
      
      // Complete OAuth flow
      const loginResult: LoginResponse = await tempBrokerService.login({
        ...credentials,
        authCode
      });

      if (!loginResult.success) {
        throw new Error(loginResult.message || 'OAuth completion failed');
      }

      // Get account ID from the broker service
      const accountId = tempBrokerService.getAccountId();
      if (!accountId) {
        throw new Error('Failed to get account ID from broker');
      }

      // Use the temp service directly as the account-specific service for OAuth
      const accountSpecificService = tempBrokerService;

      // Store this instance as the account-specific instance in the registry
      const accountKey = `${brokerName.toLowerCase()}_${accountId}`;
      (this.brokerRegistry as any).accountInstances.set(accountKey, accountSpecificService);

      console.log(`✅ Using OAuth temp service as account-specific service for ${brokerName} account ${accountId}`);

      // Create connection
      const connectionKey = this.createConnectionKey(userId, brokerName, accountId);
      const connection: BrokerConnection = {
        userId,
        brokerName,
        accountId,
        service: accountSpecificService,
        isActive: true,
        connectedAt: new Date()
      };

      this.connections.set(connectionKey, connection);

      console.log(`✅ Successfully completed OAuth for ${brokerName}, user ${userId}, account ${accountId}`);
      console.log(`📊 Total connections: ${this.connections.size}`);
      
      return {
        success: true,
        accountId,
        message: `Successfully connected to ${brokerName}`
      };

    } catch (error: any) {
      console.error(`🚨 Failed to complete OAuth for ${brokerName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get a broker connection
   */
  getConnection(userId: string, brokerName: string, accountId: string): BrokerConnection | null {
    const connectionKey = this.createConnectionKey(userId, brokerName, accountId);
    return this.connections.get(connectionKey) || null;
  }

  /**
   * Get all connections for a user
   */
  getUserConnections(userId: string): BrokerConnection[] {
    return Array.from(this.connections.values()).filter(conn => conn.userId === userId);
  }

  /**
   * Get all connections for a user and broker
   */
  getUserBrokerConnections(userId: string, brokerName: string): BrokerConnection[] {
    return Array.from(this.connections.values()).filter(
      conn => conn.userId === userId && conn.brokerName === brokerName
    );
  }

  /**
   * Validate a connection
   */
  async validateConnection(userId: string, brokerName: string, accountId: string): Promise<boolean> {
    const connection = this.getConnection(userId, brokerName, accountId);
    if (!connection) {
      return false;
    }

    try {
      const isValid = await connection.service.validateSession(accountId);
      connection.isActive = isValid;
      return isValid;
    } catch (error) {
      console.error(`🚨 Connection validation failed for ${brokerName}:`, error);
      connection.isActive = false;
      return false;
    }
  }

  /**
   * Disconnect from a broker
   */
  async disconnect(userId: string, brokerName: string, accountId: string): Promise<void> {
    const connectionKey = this.createConnectionKey(userId, brokerName, accountId);
    const connection = this.connections.get(connectionKey);

    if (connection) {
      try {
        await connection.service.logout();
      } catch (error) {
        console.error(`🚨 Logout failed for ${brokerName}:`, error);
      }

      this.connections.delete(connectionKey);

      // Clean up the account-specific broker instance
      this.brokerRegistry.removeBrokerForAccount(brokerName, accountId);

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
  getBrokerService(userId: string, brokerName: string, accountId: string): IBrokerService | null {
    const connection = this.getConnection(userId, brokerName, accountId);
    return connection?.service || null;
  }

  /**
   * Auto-activate account using stored credentials
   */
  async autoActivateAccount(userId: string, accountId: string): Promise<boolean> {
    try {
      // Get account from database
      const account = await userDatabase.getConnectedAccountById(accountId);
      if (!account) {
        console.log(`❌ Account ${accountId} not found in database`);
        return false;
      }

      // Get stored credentials
      const credentials = await userDatabase.getAccountCredentials(accountId);
      if (!credentials) {
        console.log(`❌ No credentials found for account ${accountId}`);
        return false;
      }

      // Try to connect using account-specific instance
      const result = await this.connectToBroker(userId, account.broker_name, credentials);
      
      if (result.success) {
        console.log(`✅ Auto-activated account ${accountId} for user ${userId}`);
        return true;
      } else {
        console.log(`⚠️ Auto-activation failed for account ${accountId}: ${result.message}`);
        return false;
      }
    } catch (error: any) {
      console.error(`🚨 Auto-activation failed for account ${accountId}:`, error.message);
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): { totalConnections: number; activeConnections: number; brokerCounts: Record<string, number> } {
    const connections = Array.from(this.connections.values());
    const activeConnections = connections.filter(conn => conn.isActive);

    const brokerCounts: Record<string, number> = {};
    connections.forEach(conn => {
      brokerCounts[conn.brokerName] = (brokerCounts[conn.brokerName] || 0) + 1;
    });

    return {
      totalConnections: connections.length,
      activeConnections: activeConnections.length,
      brokerCounts
    };
  }

  /**
   * Debug method to list all connections
   */
  debugListConnections(): void {
    console.log('🔍 DEBUG: Current connections:');
    this.connections.forEach((connection, key) => {
      console.log(`  ${key}: ${connection.brokerName} - ${connection.accountId} (${connection.isActive ? 'Active' : 'Inactive'})`);
    });
    console.log(`📊 Total: ${this.connections.size} connections`);
  }
}

// Export singleton instance
export const unifiedBrokerManager = UnifiedBrokerManager.getInstance();
