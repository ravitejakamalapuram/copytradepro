/**
 * Tracked Database Compatibility Layer
 * Enhanced version with comprehensive error logging and monitoring
 */

import { getDatabase } from './databaseFactory';
import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import { databaseErrorLoggingService, DatabaseOperationContext } from './databaseErrorLoggingService';
import { traceIdService } from './traceIdService';
import TraceContext from '../utils/traceContext';
import { logger } from '../utils/logger';

class TrackedDatabaseCompatibilityLayer {
  private database: IDatabaseAdapter | null = null;

  private async getDb(): Promise<IDatabaseAdapter> {
    if (!this.database) {
      this.database = await getDatabase();
    }
    return this.database;
  }

  /**
   * Execute database operation with comprehensive error logging and monitoring
   */
  private async executeWithLogging<T>(
    operation: string,
    collection: string,
    operationFn: () => Promise<T>,
    context?: Partial<DatabaseOperationContext>
  ): Promise<T> {
    const startTime = performance.now();
    const traceId = TraceContext.getTraceId() || traceIdService.generateTraceId();
    
    const dbContext: DatabaseOperationContext = {
      operation,
      collection,
      traceId,
      connectionState: {
        isConnected: !!this.database,
        poolSize: 10, // Default pool size
        activeConnections: 1
      },
      ...context
    };

    try {
      // Add trace operation
      await traceIdService.addOperation(traceId, operation, 'DATABASE_SERVICE');

      logger.debug(`Executing database operation: ${operation}`, {
        component: 'TRACKED_DATABASE_COMPATIBILITY',
        operation,
        collection,
        traceId
      });

      const result = await operationFn();
      const duration = performance.now() - startTime;

      // Log successful operation
      await databaseErrorLoggingService.logDatabaseSuccess(
        `${operation} completed successfully`,
        {
          ...dbContext,
          queryDetails: {
            executionTime: duration,
            affectedRows: Array.isArray(result) ? result.length : (result ? 1 : 0)
          }
        }
      );

      // Complete trace operation
      await traceIdService.completeOperation(
        traceId,
        operation,
        'SUCCESS',
        { 
          collection,
          duration,
          resultCount: Array.isArray(result) ? result.length : (result ? 1 : 0)
        }
      );

      // Log slow queries as warnings
      if (duration > 1000) { // More than 1 second
        await databaseErrorLoggingService.logDatabaseWarning(
          `Slow query detected: ${operation} took ${duration.toFixed(2)}ms`,
          {
            ...dbContext,
            queryDetails: {
              executionTime: duration
            }
          }
        );
      }

      return result;
    } catch (error: any) {
      const duration = performance.now() - startTime;

      // Log database error
      await databaseErrorLoggingService.logDatabaseError(
        `${operation} failed: ${error.message}`,
        error,
        {
          ...dbContext,
          queryDetails: {
            executionTime: duration
          }
        }
      );

      // Complete trace operation with error
      await traceIdService.completeOperation(
        traceId,
        operation,
        'ERROR',
        { 
          collection,
          error: error.message,
          duration 
        }
      );

      throw error;
    }
  }

  // User methods with error logging
  async createUser(userData: any) {
    return this.executeWithLogging(
      'CREATE_USER',
      'users',
      async () => {
        const db = await this.getDb();
        return await db.createUser(userData);
      },
      {
        data: { email: userData.email, username: userData.username }
      }
    );
  }

  async findUserById(id: number) {
    return this.executeWithLogging(
      'FIND_USER_BY_ID',
      'users',
      async () => {
        const db = await this.getDb();
        return await db.findUserById(id);
      },
      {
        query: { id }
      }
    );
  }

  async findUserByEmail(email: string) {
    return this.executeWithLogging(
      'FIND_USER_BY_EMAIL',
      'users',
      async () => {
        const db = await this.getDb();
        return await db.findUserByEmail(email);
      },
      {
        query: { email }
      }
    );
  }

  async updateUser(id: number, userData: any) {
    return this.executeWithLogging(
      'UPDATE_USER',
      'users',
      async () => {
        const db = await this.getDb();
        return await db.updateUser(id, userData);
      },
      {
        query: { id },
        data: { ...userData, password: userData.password ? '[REDACTED]' : undefined }
      }
    );
  }

  async deleteUser(id: number) {
    return this.executeWithLogging(
      'DELETE_USER',
      'users',
      async () => {
        const db = await this.getDb();
        return await db.deleteUser(id);
      },
      {
        query: { id }
      }
    );
  }

  async getUserCount() {
    return this.executeWithLogging(
      'GET_USER_COUNT',
      'users',
      async () => {
        const db = await this.getDb();
        return await db.getUserCount();
      }
    );
  }

  async searchUsers(query: string) {
    return this.executeWithLogging(
      'SEARCH_USERS',
      'users',
      async () => {
        const db = await this.getDb();
        return await db.searchUsers(query);
      },
      {
        query: { search: query }
      }
    );
  }

  // Connected Account methods with error logging
  async createConnectedAccount(accountData: any) {
    return this.executeWithLogging(
      'CREATE_CONNECTED_ACCOUNT',
      'connected_accounts',
      async () => {
        const db = await this.getDb();
        return await db.createConnectedAccount(accountData);
      },
      {
        userId: accountData.user_id?.toString(),
        data: {
          broker_name: accountData.broker_name,
          account_id: accountData.account_id,
          user_name: accountData.user_name
        }
      }
    );
  }

  async getConnectedAccountsByUserId(userId: number | string) {
    return this.executeWithLogging(
      'GET_CONNECTED_ACCOUNTS_BY_USER_ID',
      'connected_accounts',
      async () => {
        const db = await this.getDb();
        return await db.getConnectedAccountsByUserId(userId);
      },
      {
        userId: userId.toString(),
        query: { user_id: userId }
      }
    );
  }

  async getConnectedAccountById(id: number | string) {
    return this.executeWithLogging(
      'GET_CONNECTED_ACCOUNT_BY_ID',
      'connected_accounts',
      async () => {
        const db = await this.getDb();
        return await db.getConnectedAccountById(id);
      },
      {
        query: { id }
      }
    );
  }

  async updateConnectedAccount(id: number | string, accountData: any) {
    return this.executeWithLogging(
      'UPDATE_CONNECTED_ACCOUNT',
      'connected_accounts',
      async () => {
        const db = await this.getDb();
        return await db.updateConnectedAccount(id, accountData);
      },
      {
        query: { id },
        data: {
          broker_name: accountData.broker_name,
          account_status: accountData.account_status,
          credentials: accountData.credentials ? '[REDACTED]' : undefined
        }
      }
    );
  }

  async deleteConnectedAccount(id: number | string) {
    return this.executeWithLogging(
      'DELETE_CONNECTED_ACCOUNT',
      'connected_accounts',
      async () => {
        const db = await this.getDb();
        return await db.deleteConnectedAccount(id);
      },
      {
        query: { id }
      }
    );
  }

  async getAccountCredentials(id: number | string) {
    return this.executeWithLogging(
      'GET_ACCOUNT_CREDENTIALS',
      'connected_accounts',
      async () => {
        const db = await this.getDb();
        return await db.getAccountCredentials(id);
      },
      {
        query: { id }
      }
    );
  }

  // Order History methods with error logging
  async createOrderHistory(orderData: any) {
    return this.executeWithLogging(
      'CREATE_ORDER_HISTORY',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.createOrderHistory(orderData);
      },
      {
        userId: orderData.user_id?.toString(),
        data: {
          symbol: orderData.symbol,
          side: orderData.side,
          quantity: orderData.quantity,
          price: orderData.price,
          order_type: orderData.order_type,
          broker_name: orderData.broker_name
        }
      }
    );
  }

  async getOrderHistoryById(id: string) {
    return this.executeWithLogging(
      'GET_ORDER_HISTORY_BY_ID',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.getOrderHistoryById(id);
      },
      {
        query: { id }
      }
    );
  }

  async getOrderHistoryByBrokerOrderId(brokerOrderId: string) {
    return this.executeWithLogging(
      'GET_ORDER_HISTORY_BY_BROKER_ORDER_ID',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.getOrderHistoryByBrokerOrderId(brokerOrderId);
      },
      {
        query: { broker_order_id: brokerOrderId }
      }
    );
  }

  async getOrderHistoryByUserId(userId: number | string, limit?: number, offset?: number) {
    return this.executeWithLogging(
      'GET_ORDER_HISTORY_BY_USER_ID',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.getOrderHistoryByUserId(userId, limit, offset);
      },
      {
        userId: userId.toString(),
        query: { user_id: userId, limit, offset }
      }
    );
  }

  async updateOrderHistory(id: string, orderData: any) {
    return this.executeWithLogging(
      'UPDATE_ORDER_HISTORY',
      'order_history',
      async () => {
        const db = await this.getDb();
        // return await db.updateOrderHistory(id, orderData); // Method doesn't exist
        throw new Error('updateOrderHistory not implemented in IDatabaseAdapter');
      },
      {
        query: { id },
        data: {
          status: orderData.status,
          executed_price: orderData.executed_price,
          executed_quantity: orderData.executed_quantity,
          broker_order_id: orderData.broker_order_id
        }
      }
    );
  }

  async updateOrderStatus(id: string, status: string) {
    return this.executeWithLogging(
      'UPDATE_ORDER_STATUS',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.updateOrderStatus(id, status);
      },
      {
        query: { id },
        data: { status }
      }
    );
  }

  async updateOrderWithError(id: string, errorData: any) {
    return this.executeWithLogging(
      'UPDATE_ORDER_WITH_ERROR',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.updateOrderWithError!(id, errorData);
      },
      {
        query: { id },
        data: {
          status: errorData.status,
          error_message: errorData.error_message,
          failure_reason: errorData.failure_reason
        }
      }
    );
  }

  async updateOrderComprehensive(id: string, updateData: any) {
    return this.executeWithLogging(
      'UPDATE_ORDER_COMPREHENSIVE',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.updateOrderComprehensive!(id, updateData);
      },
      {
        query: { id },
        data: {
          status: updateData.status,
          executed_price: updateData.executed_price,
          executed_quantity: updateData.executed_quantity
        }
      }
    );
  }

  async incrementOrderRetryCount(id: string) {
    return this.executeWithLogging(
      'INCREMENT_ORDER_RETRY_COUNT',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.incrementOrderRetryCount!(id);
      },
      {
        query: { id }
      }
    );
  }

  async deleteOrderHistory(id: string) {
    return this.executeWithLogging(
      'DELETE_ORDER_HISTORY',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.deleteOrderHistory(id);
      },
      {
        query: { id }
      }
    );
  }

  async getAllOrderHistory() {
    return this.executeWithLogging(
      'GET_ALL_ORDER_HISTORY',
      'order_history',
      async () => {
        const db = await this.getDb();
        return await db.getAllOrderHistory();
      }
    );
  }

  async searchOrderHistory(userId: number | string, filters: any) {
    return this.executeWithLogging(
      'SEARCH_ORDER_HISTORY',
      'order_history',
      async () => {
        const db = await this.getDb();
        // return await db.searchOrderHistory(userId, filters); // Method doesn't exist
        throw new Error('searchOrderHistory not implemented in IDatabaseAdapter');
      },
      {
        userId: userId.toString(),
        query: { user_id: userId, ...filters }
      }
    );
  }

  async getOrderHistoryStats(userId: number | string) {
    return this.executeWithLogging(
      'GET_ORDER_HISTORY_STATS',
      'order_history',
      async () => {
        const db = await this.getDb();
        // return await db.getOrderHistoryStats(userId); // Method doesn't exist
        throw new Error('getOrderHistoryStats not implemented in IDatabaseAdapter');
      },
      {
        userId: userId.toString(),
        query: { user_id: userId }
      }
    );
  }

  // Delegate method for getting database instance
  async getInstance(): Promise<IDatabaseAdapter> {
    return await this.getDb();
  }
}

// Export a singleton instance for backward compatibility
export const trackedUserDatabase = new TrackedDatabaseCompatibilityLayer();