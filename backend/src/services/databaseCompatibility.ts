import { getDatabase } from './databaseFactory';
import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';

/**
 * Database Compatibility Layer
 * Provides backward compatibility for existing code while migrating to the new adapter pattern
 */
class DatabaseCompatibilityLayer {
  private database: IDatabaseAdapter | null = null;
  private dbType: string = 'mongodb'; // Always MongoDB now

  private async getDb(): Promise<IDatabaseAdapter> {
    if (!this.database) {
      this.database = await getDatabase();
      this.dbType = 'mongodb';
    }
    return this.database;
  }

  // User methods
  async createUser(userData: any) {
    const db = await this.getDb();
    return await db.createUser(userData);
  }

  async findUserById(id: number) {
    const db = await this.getDb();
    return await db.findUserById(id);
  }

  async findUserByEmail(email: string) {
    const db = await this.getDb();
    return await db.findUserByEmail(email);
  }

  async updateUser(id: number, userData: any) {
    const db = await this.getDb();
    return await db.updateUser(id, userData);
  }

  async deleteUser(id: number) {
    const db = await this.getDb();
    return await db.deleteUser(id);
  }

  async getUserCount() {
    const db = await this.getDb();
    return await db.getUserCount();
  }

  async searchUsers(query: string) {
    const db = await this.getDb();
    return await db.searchUsers(query);
  }

  // Connected Account methods
  async createConnectedAccount(accountData: any) {
    const db = await this.getDb();
    return await db.createConnectedAccount(accountData);
  }

  async getConnectedAccountsByUserId(userId: number | string) {
    const db = await this.getDb();
    return await db.getConnectedAccountsByUserId(userId);
  }

  async getConnectedAccountById(id: number | string) {
    const db = await this.getDb();
    return await db.getConnectedAccountById(id);
  }

  async updateConnectedAccount(id: number | string, accountData: any) {
    const db = await this.getDb();
    return await db.updateConnectedAccount(id, accountData);
  }

  async deleteConnectedAccount(id: number | string) {
    const db = await this.getDb();
    return await db.deleteConnectedAccount(id);
  }

  // Order History methods
  async createOrderHistory(orderData: any) {
    const db = await this.getDb();
    return await db.createOrderHistory(orderData);
  }

  async getOrderHistoryById(id: number) {
    const db = await this.getDb();
    return await db.getOrderHistoryById(id);
  }

  async getOrderHistoryByUserId(userId: number | string, limit?: number, offset?: number) {
    const db = await this.getDb();
    return await db.getOrderHistoryByUserId(userId, limit, offset);
  }

  async getOrderHistoryByUserIdWithFilters(userId: number | string, limit?: number, offset?: number, filters?: any) {
    const db = await this.getDb();
    return await db.getOrderHistoryByUserIdWithFilters(userId, limit, offset, filters);
  }

  async updateOrderStatus(id: number, status: string) {
    const db = await this.getDb();
    return await db.updateOrderStatus(id, status);
  }

  async updateOrderStatusByBrokerOrderId(brokerOrderId: string, status: string) {
    const db = await this.getDb();
    return await db.updateOrderStatusByBrokerOrderId(brokerOrderId, status);
  }

  async deleteOrderHistory(id: number) {
    const db = await this.getDb();
    return await db.deleteOrderHistory(id);
  }

  async getAllOrderHistory(limit?: number, offset?: number) {
    const db = await this.getDb();
    return await db.getAllOrderHistory(limit, offset);
  }

  async getOrderCountByUserIdWithFilters(userId: number | string, filters?: any) {
    const db = await this.getDb();
    return await db.getOrderCountByUserIdWithFilters(userId, filters);
  }

  // Notification methods
  async saveUserNotificationPreferences(preferences: any) {
    const db = await this.getDb();
    return await db.saveUserNotificationPreferences(preferences);
  }

  async getUserNotificationPreferences(userId: number) {
    const db = await this.getDb();
    return await db.getUserNotificationPreferences(userId);
  }

  // Additional methods that might be needed for compatibility
  async getAccountCredentials(accountId: number | string) {
    const db = await this.getDb();

    // Get account and decrypt credentials
    const account = await db.getConnectedAccountById(accountId);
    if (!account) return null;

    try {
      // MongoDB stores credentials in encrypted_credentials field
      if (account.encrypted_credentials) {
        const decryptedCredentials = (db as any).decryptCredentials(account.encrypted_credentials);
        return JSON.parse(decryptedCredentials);
      }
      return null;
    } catch (error) {
      console.error('🚨 Failed to decrypt account credentials:', error);
      return null;
    }
  }

  async getConnectedAccountByAccountId(accountId: string) {
    const db = await this.getDb();
    // This method doesn't exist in the interface yet, so return null for now
    console.warn('getConnectedAccountByAccountId called - needs proper implementation');
    return null;
  }

  getOrderSearchSuggestions(userId: number | string, query: string) {
    // This method needs proper implementation
    console.warn('getOrderSearchSuggestions called - needs proper implementation');
    return [];
  }

  // Push notification methods - TODO: Implement with MongoDB
  savePushSubscription(subscriptionData: any): boolean {
    console.warn('savePushSubscription called - needs MongoDB implementation');
    return false;
  }

  removePushSubscription(userId: string, endpoint: string): boolean {
    console.warn('removePushSubscription called - needs MongoDB implementation');
    return false;
  }

  getUserPushSubscriptions(userId: string): any[] {
    console.warn('getUserPushSubscriptions called - needs MongoDB implementation');
    return [];
  }

  // Close method for compatibility
  async close() {
    if (this.database) {
      await this.database.close();
      this.database = null;
    }
  }
}

// Export a singleton instance for backward compatibility
export const userDatabase = new DatabaseCompatibilityLayer();
