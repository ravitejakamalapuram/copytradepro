import { Response } from 'express';
import { IBrokerService } from '@copytrade/unified-broker';
import { unifiedBrokerManager } from '../services/unifiedBrokerManager';
import { logger } from '../utils/logger';

// Type definitions
export type BrokerService = IBrokerService;

export interface BrokerConnectionResult {
  success: boolean;
  connection?: BrokerService;
  error?: string;
  accountId?: string;
}

export interface MultipleBrokerConnectionsResult {
  success: boolean;
  connections?: Array<{ accountId: string; connection: BrokerService }>;
  error?: string;
}

/**
 * Broker Connection Helper
 * 
 * Provides centralized broker connection management for multiple accounts per broker.
 * Handles finding connections, validation, and consistent error responses.
 */
export class BrokerConnectionHelper {
  
  /**
   * Find a specific broker connection or the first available one
   * @param userId - User ID
   * @param brokerName - Broker name (e.g., 'shoonya', 'fyers')
   * @param accountId - Optional specific account ID
   * @returns BrokerConnectionResult with connection or error
   */
  static findBrokerConnection(
    userId: string,
    brokerName: string,
    accountId?: string
  ): BrokerConnectionResult {
    if (accountId) {
      // Look for specific connection
      const connection = unifiedBrokerManager.getConnection(userId, brokerName, accountId);
      if (connection) {
        return {
          success: true,
          connection: connection.service,
          accountId: connection.accountId
        };
      }
    } else {
      // Look for any connection for this broker
      const connections = unifiedBrokerManager.getUserBrokerConnections(userId, brokerName);
      if (connections.length > 0 && connections[0]) {
        return {
          success: true,
          connection: connections[0].service,
          accountId: connections[0].accountId
        };
      }
    }

    return {
      success: false,
      error: 'No connections found for user'
    };

  }

  /**
   * Find all broker connections for a specific broker
   * @param userId - User ID
   * @param brokerName - Broker name
   * @returns MultipleBrokerConnectionsResult with all connections or error
   */
  static findAllBrokerConnections(
    userId: string,
    brokerName: string
  ): MultipleBrokerConnectionsResult {
    const connections = unifiedBrokerManager.getUserBrokerConnections(userId, brokerName);

    if (connections.length === 0) {
      return {
        success: false,
        error: 'No connections found for user'
      };
    }

    const brokerConnections: Array<{ accountId: string; connection: BrokerService }> = connections.map(conn => ({
      accountId: conn.accountId,
      connection: conn.service
    }));

    if (brokerConnections.length === 0) {
      return {
        success: false,
        error: `Not connected to ${brokerName}`
      };
    }

    return {
      success: true,
      connections: brokerConnections
    };
  }

  /**
   * Validate that a connection is active for a specific account
   * @param connection - Broker service connection
   * @param brokerName - Broker name
   * @param accountId - Account ID
   * @returns Promise<boolean> indicating if connection is valid
   */
  static async validateConnection(
    connection: BrokerService,
    brokerName: string,
    accountId: string
  ): Promise<boolean> {
    try {
      // Use unified broker interface - all brokers implement validateSession
      // The broker service handles the specific validation logic internally
      const result = await connection.validateSession(accountId);

      // Handle both boolean and object responses
      if (typeof result === 'boolean') {
        return result;
      } else if (result && typeof result === 'object' && 'isValid' in result) {
        return (result as any).isValid;
      }

      return false;
    } catch (error) {
      logger.error('Connection validation failed', {
        component: 'BROKER_CONNECTION_HELPER',
        operation: 'VALIDATE_CONNECTION',
        brokerName,
        accountId
      }, error);
      return false;
    }
  }

  /**
   * Send standardized error response for connection not found
   */
  static sendConnectionNotFoundError(
    res: Response, 
    brokerName: string, 
    accountId?: string
  ): void {
    const message = accountId 
      ? `Not connected to ${brokerName} account ${accountId}`
      : `Not connected to ${brokerName}`;
      
    res.status(404).json({
      success: false,
      message
    });
  }

  /**
   * Send standardized error response for no connections found
   */
  static sendNoConnectionsError(res: Response): void {
    res.status(404).json({
      success: false,
      message: 'No connections found for user'
    });
  }

  /**
   * Send standardized error response for authentication required
   */
  static sendAuthenticationError(res: Response): void {
    res.status(401).json({
      success: false,
      message: 'User not authenticated'
    });
  }

  /**
   * Send standardized error response for missing parameters
   */
  static sendMissingParametersError(res: Response, missingParams: string[]): void {
    res.status(400).json({
      success: false,
      message: `Missing required parameters: ${missingParams.join(', ')}`
    });
  }
}

export default BrokerConnectionHelper;
