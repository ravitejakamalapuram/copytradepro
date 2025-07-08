/**
 * Broker Manager
 * Centralized broker management without hardcoded broker checks
 * Uses factory pattern and polymorphism for broker operations
 */

import { IBrokerService, createBroker, getSupportedBrokers } from '@copytrade/unified-broker';

export interface BrokerConnection {
  service: IBrokerService;
  accountId: string;
  userId: string;
  brokerName: string;
  connectionKey: string;
  lastActivity: Date;
}

export class BrokerManager {
  private static instance: BrokerManager;
  private connections: Map<string, Map<string, BrokerConnection>> = new Map();

  private constructor() {}

  public static getInstance(): BrokerManager {
    if (!BrokerManager.instance) {
      BrokerManager.instance = new BrokerManager();
    }
    return BrokerManager.instance;
  }

  /**
   * Create a broker connection
   * @param userId - User ID
   * @param brokerName - Broker name
   * @param credentials - Broker credentials
   * @returns Promise<BrokerConnection>
   */
  async createConnection(userId: string, brokerName: string, credentials: any): Promise<BrokerConnection> {
    try {
      // Create broker service using unified broker system
      const brokerService = createBroker(brokerName);
      
      // Attempt login
      const loginResponse = await brokerService.login(credentials);
      
      if (!loginResponse.success) {
        throw new Error(loginResponse.message || 'Login failed');
      }

      // Create connection object
      const accountId = loginResponse.data?.accountId || brokerService.getAccountId() || 'unknown';
      const connectionKey = `${brokerName}_${accountId}`;
      
      const connection: BrokerConnection = {
        service: brokerService,
        accountId,
        userId,
        brokerName,
        connectionKey,
        lastActivity: new Date()
      };

      // Store connection
      if (!this.connections.has(userId)) {
        this.connections.set(userId, new Map());
      }
      
      this.connections.get(userId)!.set(connectionKey, connection);
      
      return connection;
    } catch (error: any) {
      const availableBrokers = getSupportedBrokers();
      throw new Error(`Failed to create ${brokerName} connection: ${error.message}. Available brokers: ${availableBrokers.join(', ')}`);
    }
  }

  /**
   * Get a broker connection
   * @param userId - User ID
   * @param brokerName - Broker name
   * @param accountId - Optional specific account ID
   * @returns BrokerConnection or null
   */
  getConnection(userId: string, brokerName: string, accountId?: string): BrokerConnection | null {
    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return null;
    }

    if (accountId) {
      // Look for specific account
      const connectionKey = `${brokerName}_${accountId}`;
      return userConnections.get(connectionKey) || null;
    } else {
      // Find any connection for this broker
      for (const [, connection] of userConnections) {
        if (connection.brokerName === brokerName) {
          return connection;
        }
      }
    }

    return null;
  }

  /**
   * Get all connections for a user
   * @param userId - User ID
   * @returns Array of BrokerConnection
   */
  getUserConnections(userId: string): BrokerConnection[] {
    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return [];
    }
    
    return Array.from(userConnections.values());
  }

  /**
   * Get all connections for a specific broker
   * @param userId - User ID
   * @param brokerName - Broker name
   * @returns Array of BrokerConnection
   */
  getBrokerConnections(userId: string, brokerName: string): BrokerConnection[] {
    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return [];
    }
    
    return Array.from(userConnections.values()).filter(conn => conn.brokerName === brokerName);
  }

  /**
   * Validate a connection
   * @param connection - BrokerConnection to validate
   * @returns Promise<boolean>
   */
  async validateConnection(connection: BrokerConnection): Promise<boolean> {
    try {
      const isValid = await connection.service.validateSession(connection.accountId);
      if (isValid) {
        connection.lastActivity = new Date();
      }
      return isValid;
    } catch (error) {
      console.error(`Connection validation failed for ${connection.brokerName}:`, error);
      return false;
    }
  }

  /**
   * Remove a connection
   * @param userId - User ID
   * @param connectionKey - Connection key
   * @returns boolean indicating success
   */
  removeConnection(userId: string, connectionKey: string): boolean {
    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return false;
    }

    const connection = userConnections.get(connectionKey);
    if (connection) {
      // Logout from broker
      connection.service.logout().catch(error => {
        console.error(`Logout failed for ${connection.brokerName}:`, error);
      });
      
      // Remove from memory
      userConnections.delete(connectionKey);
      
      // Clean up empty user map
      if (userConnections.size === 0) {
        this.connections.delete(userId);
      }
      
      return true;
    }
    
    return false;
  }

  /**
   * Remove all connections for a user
   * @param userId - User ID
   */
  removeUserConnections(userId: string): void {
    const userConnections = this.connections.get(userId);
    if (userConnections) {
      // Logout from all brokers
      for (const connection of userConnections.values()) {
        connection.service.logout().catch(error => {
          console.error(`Logout failed for ${connection.brokerName}:`, error);
        });
      }
      
      // Remove all connections
      this.connections.delete(userId);
    }
  }

  /**
   * Get supported brokers
   * @returns Array of supported broker names
   */
  getSupportedBrokers(): string[] {
    return getSupportedBrokers();
  }

  /**
   * Check if a broker is supported
   * @param brokerName - Broker name to check
   * @returns boolean
   */
  isBrokerSupported(brokerName: string): boolean {
    return getSupportedBrokers().includes(brokerName);
  }

  /**
   * Get connection statistics
   * @returns Object with connection stats
   */
  getStats() {
    const totalUsers = this.connections.size;
    let totalConnections = 0;
    const brokerStats: { [key: string]: number } = {};

    for (const userConnections of this.connections.values()) {
      totalConnections += userConnections.size;
      
      for (const connection of userConnections.values()) {
        brokerStats[connection.brokerName] = (brokerStats[connection.brokerName] || 0) + 1;
      }
    }

    return {
      totalUsers,
      totalConnections,
      brokerStats,
      supportedBrokers: this.getSupportedBrokers()
    };
  }
}

// Export singleton instance
export const brokerManager = BrokerManager.getInstance();
