import { Response } from 'express';
import { BrokerRegistry, IBrokerService } from '@copytrade/unified-broker';
import { userBrokerConnections } from '../controllers/brokerController';

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
    const userConnections = userBrokerConnections.get(userId);
    
    if (!userConnections) {
      return {
        success: false,
        error: 'No connections found for user'
      };
    }

    // If specific accountId is provided, look for that exact connection
    if (accountId) {
      const connectionKey = `${brokerName}_${accountId}`;
      const connection = userConnections.get(connectionKey);
      
      if (!connection) {
        return {
          success: false,
          error: `Not connected to ${brokerName} account ${accountId}`
        };
      }
      
      return {
        success: true,
        connection,
        accountId
      };
    }

    // If no specific accountId, find the first available connection for this broker
    for (const [connectionKey, connection] of userConnections.entries()) {
      if (connectionKey.startsWith(`${brokerName}_`)) {
        const extractedAccountId = connectionKey.replace(`${brokerName}_`, '');
        return {
          success: true,
          connection,
          accountId: extractedAccountId
        };
      }
    }

    return {
      success: false,
      error: `Not connected to ${brokerName}`
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
    const userConnections = userBrokerConnections.get(userId);
    
    if (!userConnections) {
      return {
        success: false,
        error: 'No connections found for user'
      };
    }

    const brokerConnections: Array<{ accountId: string; connection: BrokerService }> = [];

    for (const [connectionKey, connection] of userConnections.entries()) {
      if (connectionKey.startsWith(`${brokerName}_`)) {
        const accountId = connectionKey.replace(`${brokerName}_`, '');
        brokerConnections.push({ accountId, connection });
      }
    }

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
      if (brokerName === 'shoonya') {
        return await (connection as ShoonyaService).validateSession(accountId);
      } else if (brokerName === 'fyers') {
        return await (connection as FyersService).validateSession();
      }
      return false;
    } catch (error) {
      console.error(`🚨 Connection validation failed for ${brokerName} account ${accountId}:`, error);
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
