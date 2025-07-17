import { SQLiteUserDatabase } from './sqliteDatabase';
import {
  IDatabaseAdapter,
  User,
  CreateUserData,
  UpdateUserData,
  ConnectedAccount,
  CreateConnectedAccountData,
  OrderHistory,
  CreateOrderHistoryData,
  OrderFilters
} from '../interfaces/IDatabaseAdapter';

/**
 * SQLite Database Adapter
 * Wraps the existing SQLiteUserDatabase to implement the IDatabaseAdapter interface
 */
export class SQLiteAdapter implements IDatabaseAdapter {
  private sqliteDb: SQLiteUserDatabase;

  constructor() {
    this.sqliteDb = new SQLiteUserDatabase();
  }

  // Connection Management
  initialize(): void {
    // SQLite database is initialized in constructor
    console.log('✅ SQLite database adapter initialized');
  }

  close(): void {
    this.sqliteDb.close();
  }

  isConnected(): boolean {
    // SQLite is always "connected" if initialized
    return true;
  }

  // User Management - Convert between sync and async
  async createUser(userData: CreateUserData): Promise<User> {
    return Promise.resolve(this.sqliteDb.createUser(userData));
  }

  async findUserById(id: number | string): Promise<User | null> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return Promise.resolve(this.sqliteDb.findUserById(numericId));
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return Promise.resolve(this.sqliteDb.findUserByEmail(email));
  }

  // Alias for backward compatibility
  async getUserById(id: number | string): Promise<User | null> {
    return this.findUserById(id.toString());
  }

  // Alias for backward compatibility
  async getUserByEmail(email: string): Promise<User | null> {
    return this.findUserByEmail(email);
  }

  async updateUser(id: number | string, userData: UpdateUserData): Promise<User | null> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return Promise.resolve(this.sqliteDb.updateUser(numericId, userData));
  }

  async deleteUser(id: number | string): Promise<boolean> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return Promise.resolve(this.sqliteDb.deleteUser(numericId));
  }

  async getUserCount(): Promise<number> {
    return Promise.resolve(this.sqliteDb.getUserCount());
  }

  async searchUsers(query: string): Promise<User[]> {
    return Promise.resolve(this.sqliteDb.searchUsers(query));
  }

  // Connected Accounts Management
  async createConnectedAccount(accountData: CreateConnectedAccountData): Promise<ConnectedAccount> {
    const sqliteAccountData = {
      ...accountData,
      user_id: typeof accountData.user_id === 'string' ? parseInt(accountData.user_id) : accountData.user_id
    };
    return Promise.resolve(this.sqliteDb.createConnectedAccount(sqliteAccountData));
  }

  async getConnectedAccountsByUserId(userId: number | string): Promise<ConnectedAccount[]> {
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    return Promise.resolve(this.sqliteDb.getConnectedAccountsByUserId(numericUserId));
  }

  async getConnectedAccountById(id: number | string): Promise<ConnectedAccount | null> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return Promise.resolve(this.sqliteDb.getConnectedAccountById(numericId));
  }

  async updateConnectedAccount(id: number | string, accountData: Partial<CreateConnectedAccountData>): Promise<ConnectedAccount | null> {
    // SQLite doesn't have updateConnectedAccount method, so we'll return null for now
    // This method would need to be implemented in SQLiteUserDatabase if needed
    console.warn('updateConnectedAccount not implemented in SQLite adapter');
    return Promise.resolve(null);
  }

  async deleteConnectedAccount(id: number | string): Promise<boolean> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return Promise.resolve(this.sqliteDb.deleteConnectedAccount(numericId));
  }

  async getAccountCredentials(id: number | string): Promise<any> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return Promise.resolve(this.sqliteDb.getAccountCredentials(numericId));
  }

  // Order History Management
  async createOrderHistory(orderData: CreateOrderHistoryData): Promise<OrderHistory> {
    const sqliteOrderData = {
      ...orderData,
      user_id: typeof orderData.user_id === 'string' ? parseInt(orderData.user_id) : orderData.user_id,
      account_id: typeof orderData.account_id === 'string' ? parseInt(orderData.account_id) : orderData.account_id
    };
    return Promise.resolve(this.sqliteDb.createOrderHistory(sqliteOrderData));
  }

  async getOrderHistoryById(id: number | string): Promise<OrderHistory | null> {
    const numericId = typeof id === 'string' ? parseInt(id) : id;
    return Promise.resolve(this.sqliteDb.getOrderHistoryById(numericId));
  }

  async getOrderHistoryByUserId(userId: number | string, limit: number = 50, offset: number = 0): Promise<OrderHistory[]> {
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    return Promise.resolve(this.sqliteDb.getOrderHistoryByUserId(numericUserId, limit, offset));
  }

  async getOrderHistoryByUserIdWithFilters(
    userId: number | string,
    limit: number = 50,
    offset: number = 0,
    filters: OrderFilters = {}
  ): Promise<OrderHistory[]> {
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    return Promise.resolve(this.sqliteDb.getOrderHistoryByUserIdWithFilters(numericUserId, limit, offset, filters));
  }

  async updateOrderStatus(id: number | string, status: string): Promise<boolean> {
    // SQLite updateOrderStatus takes brokerOrderId, not id
    console.warn('updateOrderStatus by ID not implemented in SQLite adapter');
    return Promise.resolve(false);
  }

  async updateOrderStatusByBrokerOrderId(brokerOrderId: string, status: string): Promise<boolean> {
    return Promise.resolve(this.sqliteDb.updateOrderStatus(brokerOrderId, status as any));
  }

  async deleteOrderHistory(id: number | string): Promise<boolean> {
    // SQLite doesn't have deleteOrderHistory method
    console.warn('deleteOrderHistory not implemented in SQLite adapter');
    return Promise.resolve(false);
  }

  async getAllOrderHistory(limit: number = 100, offset: number = 0): Promise<OrderHistory[]> {
    // SQLite getAllOrderHistory doesn't take parameters
    return Promise.resolve(this.sqliteDb.getAllOrderHistory());
  }

  async getOrderCountByUserIdWithFilters(userId: number | string, filters: OrderFilters = {}): Promise<number> {
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    return Promise.resolve(this.sqliteDb.getOrderCountByUserIdWithFilters(numericUserId, filters));
  }

  // Notification Preferences
  async saveUserNotificationPreferences(preferences: any): Promise<boolean> {
    return Promise.resolve(this.sqliteDb.saveUserNotificationPreferences(preferences));
  }

  async getUserNotificationPreferences(userId: number | string): Promise<any> {
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    return Promise.resolve(this.sqliteDb.getUserNotificationPreferences(numericUserId.toString()));
  }

  async healthCheck(): Promise<boolean> {
    try {
      return this.sqliteDb.healthCheck();
    } catch (error) {
      console.error('🚨 SQLite health check failed:', error);
      return false;
    }
  }
}
