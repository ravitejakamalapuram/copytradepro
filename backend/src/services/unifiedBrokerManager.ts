/**
 * Unified Broker Manager
 * Manages broker connections using the unified broker interface
 * Replaces legacy broker-specific implementations
 */

import { BrokerRegistry, IBrokerService, BrokerCredentials, LoginResponse } from '@copytrade/unified-broker';
import { userDatabase } from './databaseCompatibility';
import { AuthenticationStep } from '@copytrade/shared-types';
import { logger } from '../utils/logger';

export interface BrokerConnection {
  userId: string;
  brokerName: string;
  accountId: string;
  service: IBrokerService;
  isActive: boolean;
  connectedAt: Date;
}

export interface ActivationResult {
  success: boolean;
  message: string;
  authStep: AuthenticationStep;
  authUrl?: string;
  redirectUri?: string;
  accountId?: string;
  brokerName?: string;
  userName?: string;
  error?: string;
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

      logger.debug('Login result for broker', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'LOGIN_RESULT',
        brokerName,
        success: loginResult.success,
        message: loginResult.message,
        hasData: !!loginResult.data,
        dataKeys: loginResult.data ? Object.keys(loginResult.data) : [],
        authUrl: loginResult.data?.authUrl
      });

      if (!loginResult.success) {
        // Check if this is an OAuth flow that needs auth URL
        if (loginResult.data?.authUrl) {
          logger.info('OAuth URL detected', {
            component: 'UNIFIED_BROKER_MANAGER',
            operation: 'OAUTH_URL_DETECTED',
            brokerName,
            authUrl: loginResult.data.authUrl
          });
          return {
            success: false,
            authUrl: loginResult.data.authUrl,
            message: loginResult.message || 'Authentication URL generated'
          };
        }
        logger.warn('No OAuth URL found in login result', {
          component: 'UNIFIED_BROKER_MANAGER',
          operation: 'OAUTH_URL_NOT_FOUND',
          brokerName
        });
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

      logger.info('Using temp service as account-specific service', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'TEMP_SERVICE_ASSIGNED',
        brokerName,
        accountId
      });

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

      logger.info('Successfully connected to broker', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'CONNECT_SUCCESS',
        brokerName,
        userId,
        accountId,
        totalConnections: this.connections.size
      });
      
      return {
        success: true,
        accountId,
        message: `Successfully connected to ${brokerName}`
      };

    } catch (error: any) {
      logger.error('Failed to connect to broker', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'CONNECT_FAILED',
        brokerName,
        userId
      }, error);
      
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

      logger.info('Using OAuth temp service as account-specific service', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'OAUTH_TEMP_SERVICE_ASSIGNED',
        brokerName,
        accountId
      });

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

      logger.info('Successfully completed OAuth for broker', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'OAUTH_SUCCESS',
        brokerName,
        userId,
        accountId,
        totalConnections: this.connections.size
      });
      
      return {
        success: true,
        accountId,
        message: `Successfully connected to ${brokerName}`
      };

    } catch (error: any) {
      logger.error('Failed to complete OAuth for broker', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'OAUTH_FAILED',
        brokerName,
        userId
      }, error);
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
      logger.error('Connection validation failed for broker', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'VALIDATION_FAILED',
        brokerName,
        userId,
        accountId
      }, error);
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
        logger.error('Logout failed for broker', {
          component: 'UNIFIED_BROKER_MANAGER',
          operation: 'LOGOUT_FAILED',
          brokerName,
          userId,
          accountId
        }, error);
      }

      this.connections.delete(connectionKey);

      // Clean up the account-specific broker instance
      this.brokerRegistry.removeBrokerForAccount(brokerName, accountId);

      logger.info('Disconnected from broker', {
        component: 'UNIFIED_BROKER_MANAGER',
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
  getBrokerService(userId: string, brokerName: string, accountId: string): IBrokerService | null {
    const connection = this.getConnection(userId, brokerName, accountId);
    return connection?.service || null;
  }

  /**
   * Auto-activate account using stored credentials
   */
  async autoActivateAccount(userId: string, accountId: string): Promise<ActivationResult> {
    try {
      // Get account from database
      const account = await userDatabase.getConnectedAccountById(accountId);
      if (!account) {
        logger.warn('Account not found in database', {
          component: 'UNIFIED_BROKER_MANAGER',
          operation: 'AUTO_ACTIVATE_ACCOUNT_NOT_FOUND',
          userId,
          accountId
        });
        return {
          success: false,
          message: 'Account not found in database',
          authStep: AuthenticationStep.REAUTH_REQUIRED,
          error: 'ACCOUNT_NOT_FOUND'
        };
      }

      // Check if account is already active
      const existingConnection = this.getConnection(userId, account.broker_name, account.account_id);
      if (existingConnection && existingConnection.isActive) {
        logger.info('Account is already active', {
          component: 'UNIFIED_BROKER_MANAGER',
          operation: 'AUTO_ACTIVATE_ALREADY_ACTIVE',
          userId,
          accountId
        });
        return {
          success: true,
          message: 'Account is already active',
          authStep: AuthenticationStep.ALREADY_ACTIVE,
          accountId: account.account_id,
          brokerName: account.broker_name,
          userName: account.user_name
        };
      }

      // Get stored credentials
      const credentials = await userDatabase.getAccountCredentials(accountId);
      if (!credentials) {
        logger.warn('No credentials found for account', {
          component: 'UNIFIED_BROKER_MANAGER',
          operation: 'AUTO_ACTIVATE_NO_CREDENTIALS',
          userId,
          accountId
        });
        return {
          success: false,
          message: 'No credentials found for account',
          authStep: AuthenticationStep.REAUTH_REQUIRED,
          error: 'CREDENTIALS_NOT_FOUND'
        };
      }

      // Try to connect using account-specific instance
      const result = await this.connectToBroker(userId, account.broker_name, credentials);

      if (result.success) {
        logger.info('Auto-activated account successfully', {
          component: 'UNIFIED_BROKER_MANAGER',
          operation: 'AUTO_ACTIVATE_SUCCESS',
          userId,
          accountId
        });
        return {
          success: true,
          message: 'Account activated successfully',
          authStep: AuthenticationStep.DIRECT_LOGIN,
          accountId: account.account_id,
          brokerName: account.broker_name,
          userName: account.user_name
        };
      } else {
        logger.warn('Auto-activation failed for account', {
          component: 'UNIFIED_BROKER_MANAGER',
          operation: 'AUTO_ACTIVATE_FAILED',
          userId,
          accountId,
          message: result.message
        });

        // Check if this is an OAuth flow
        if (result.authUrl) {
          logger.info('OAuth flow required for account', {
            component: 'UNIFIED_BROKER_MANAGER',
            operation: 'AUTO_ACTIVATE_OAUTH_REQUIRED',
            brokerName: account.broker_name,
            accountId,
            userId
          });
          return {
            success: false,
            message: result.message || 'OAuth authentication required',
            authStep: AuthenticationStep.OAUTH_REQUIRED,
            authUrl: result.authUrl,
            accountId: account.account_id,
            brokerName: account.broker_name,
            userName: account.user_name
          };
        }

        return {
          success: false,
          message: result.message || 'Failed to activate account',
          authStep: AuthenticationStep.REAUTH_REQUIRED,
          error: 'ACTIVATION_FAILED',
          accountId: account.account_id,
          brokerName: account.broker_name
        };
      }
    } catch (error: any) {
      logger.error('Auto-activation failed for account', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'AUTO_ACTIVATE_ERROR',
        userId,
        accountId
      }, error);
      return {
        success: false,
        message: error.message || 'Failed to activate account',
        authStep: AuthenticationStep.REAUTH_REQUIRED,
        error: 'INTERNAL_ERROR'
      };
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
    logger.debug('Current connections debug info', {
      component: 'UNIFIED_BROKER_MANAGER',
      operation: 'DEBUG_LIST_CONNECTIONS',
      totalConnections: this.connections.size
    });
    
    this.connections.forEach((connection, key) => {
      logger.debug('Connection details', {
        component: 'UNIFIED_BROKER_MANAGER',
        operation: 'DEBUG_CONNECTION',
        connectionKey: key,
        brokerName: connection.brokerName,
        accountId: connection.accountId,
        isActive: connection.isActive
      });
    });
  }

  /**
   * Get list of available/initialized brokers
   */
  getAvailableBrokers(): string[] {
    return this.brokerRegistry.getAvailableBrokers();
  }

  /**
   * Check if a specific broker is available
   */
  isBrokerAvailable(brokerName: string): boolean {
    return this.brokerRegistry.isBrokerAvailable(brokerName);
  }


}

// Export singleton instance
export const unifiedBrokerManager = UnifiedBrokerManager.getInstance();
