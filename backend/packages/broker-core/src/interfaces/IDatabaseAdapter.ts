// Database Adapter Interface - Provides a unified interface for different database implementations

export interface User {
  id: number | string;
  email: string;
  name: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  password?: string;
}

export interface ConnectedAccount {
  id: number | string;
  user_id: number | string;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string; // JSON string
  products: string; // JSON string
  encrypted_credentials: string; // Encrypted JSON
  created_at: string;
  updated_at: string;
}

export interface CreateConnectedAccountData {
  user_id: number | string;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string[];
  products: any[];
  credentials: any; // Will be encrypted before storage
}

export interface OrderHistory {
  id: number | string;
  user_id: number | string;
  account_id: number | string;
  broker_name: string;
  broker_order_id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  status: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED';
  exchange: string;
  product_type: string;
  remarks: string;
  executed_at: string;
  created_at: string;
  account_info?: {
    account_id: string;
    user_name: string;
    email: string;
  };
}

export interface CreateOrderHistoryData {
  user_id: number | string;
  account_id: number | string;
  broker_name: string;
  broker_order_id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  status?: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED';
  exchange?: string;
  product_type?: string;
  remarks?: string;
  executed_at: string;
}

export interface OrderFilters {
  status?: string;
  symbol?: string;
  brokerName?: string;
  startDate?: string;
  endDate?: string;
  action?: 'BUY' | 'SELL';
  search?: string;
}

/**
 * Database Adapter Interface
 * Provides a unified interface for different database implementations (SQLite, MongoDB, etc.)
 */
export interface IDatabaseAdapter {
  // Connection Management
  initialize(): Promise<void> | void;
  close(): Promise<void> | void;
  isConnected(): boolean;

  // User Management
  createUser(userData: CreateUserData): Promise<User> | User;
  findUserById(id: number | string): Promise<User | null> | User | null;
  findUserByEmail(email: string): Promise<User | null> | User | null;
  updateUser(id: number | string, userData: UpdateUserData): Promise<User | null> | User | null;
  deleteUser(id: number | string): Promise<boolean> | boolean;
  getUserCount(): Promise<number> | number;
  searchUsers(query: string): Promise<User[]> | User[];

  // Connected Accounts Management
  createConnectedAccount(accountData: CreateConnectedAccountData): Promise<ConnectedAccount> | ConnectedAccount;
  getConnectedAccountsByUserId(userId: number | string): Promise<ConnectedAccount[]> | ConnectedAccount[];
  getConnectedAccountById(id: number | string): Promise<ConnectedAccount | null> | ConnectedAccount | null;
  updateConnectedAccount(id: number | string, accountData: Partial<CreateConnectedAccountData>): Promise<ConnectedAccount | null> | ConnectedAccount | null;
  deleteConnectedAccount(id: number | string): Promise<boolean> | boolean;

  // Order History Management
  createOrderHistory(orderData: CreateOrderHistoryData): Promise<OrderHistory> | OrderHistory;
  getOrderHistoryById(id: number | string): Promise<OrderHistory | null> | OrderHistory | null;
  getOrderHistoryByUserId(userId: number | string, limit?: number, offset?: number): Promise<OrderHistory[]> | OrderHistory[];
  getOrderHistoryByUserIdWithFilters(userId: number | string, limit?: number, offset?: number, filters?: OrderFilters): Promise<OrderHistory[]> | OrderHistory[];
  updateOrderStatus(id: number | string, status: string): Promise<boolean> | boolean;
  updateOrderStatusByBrokerOrderId(brokerOrderId: string, status: string): Promise<boolean> | boolean;
  deleteOrderHistory(id: number | string): Promise<boolean> | boolean;
  getAllOrderHistory(limit?: number, offset?: number): Promise<OrderHistory[]> | OrderHistory[];
  getOrderCountByUserIdWithFilters(userId: number | string, filters?: OrderFilters): Promise<number> | number;

  // Notification Preferences (if needed)
  saveUserNotificationPreferences(preferences: any): Promise<boolean> | boolean;
  getUserNotificationPreferences(userId: number | string): Promise<any> | any;
}
