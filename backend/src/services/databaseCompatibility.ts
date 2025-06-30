import { getDatabase } from './databaseFactory';
import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';

/**
 * Database Compatibility Layer
 * Provides backward compatibility for existing code while migrating to the new adapter pattern
 */
class DatabaseCompatibilityLayer {
  private database: IDatabaseAdapter | null = null;

  private async getDb(): Promise<IDatabaseAdapter> {
    if (!this.database) {
      this.database = await getDatabase();
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

  async getConnectedAccountsByUserId(userId: number) {
    const db = await this.getDb();
    return await db.getConnectedAccountsByUserId(userId);
  }

  async getConnectedAccountById(id: number) {
    const db = await this.getDb();
    return await db.getConnectedAccountById(id);
  }

  async updateConnectedAccount(id: number, accountData: any) {
    const db = await this.getDb();
    return await db.updateConnectedAccount(id, accountData);
  }

  async deleteConnectedAccount(id: number) {
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

  async getOrderHistoryByUserId(userId: number, limit?: number, offset?: number) {
    const db = await this.getDb();
    return await db.getOrderHistoryByUserId(userId, limit, offset);
  }

  async getOrderHistoryByUserIdWithFilters(userId: number, limit?: number, offset?: number, filters?: any) {
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

  async getOrderCountByUserIdWithFilters(userId: number, filters?: any) {
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
  async getAccountCredentials(accountId: number) {
    const db = await this.getDb();
    const account = await db.getConnectedAccountById(accountId);
    if (!account) return null;
    
    // For now, return a placeholder - this method needs to be implemented properly
    // based on how credentials are stored and decrypted
    console.warn('getAccountCredentials called - needs proper implementation');
    return null;
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
