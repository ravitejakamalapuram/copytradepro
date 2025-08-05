// Database Adapter Interface - Provides a unified interface for different database implementations

export interface User {
  id: number | string;
  email: string;
  name: string;
  password: string;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role?: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  password?: string;
  role?: string;
}

// Account status enum for authentication flow
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH';

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
  account_status: AccountStatus; // Authentication status
  token_expiry_time: string | null; // Access token expiry (ISO string or null for infinity like Shoonya)
  refresh_token_expiry_time: string | null; // Refresh token expiry (ISO string for OAuth brokers like Fyers)
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
  account_status: AccountStatus; // Authentication status
  token_expiry_time?: string | null; // Access token expiry (ISO string or null for infinity like Shoonya)
  refresh_token_expiry_time?: string | null; // Refresh token expiry (ISO string for OAuth brokers like Fyers)
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
  status: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED' | 'FAILED';
  exchange: string;
  product_type: string;
  remarks: string;
  executed_at: string;
  created_at: string;
  // Enhanced fields for comprehensive order updates
  executed_quantity?: number | undefined;
  average_price?: number | undefined;
  rejection_reason?: string | undefined;
  last_updated?: string | undefined;
  // Enhanced fields for error handling and retry functionality
  error_message?: string | undefined;
  error_code?: string | undefined;
  error_type?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET' | undefined;
  retry_count?: number | undefined;
  max_retries?: number | undefined;
  last_retry_at?: string | undefined;
  is_retryable?: boolean | undefined;
  failure_reason?: string | undefined;
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
  status?: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED' | 'FAILED';
  exchange?: string;
  product_type?: string;
  remarks?: string;
  executed_at: string;
  // Enhanced fields for error handling and retry functionality
  error_message?: string;
  error_code?: string;
  error_type?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
  retry_count?: number;
  max_retries?: number;
  last_retry_at?: string;
  is_retryable?: boolean;
  failure_reason?: string;
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
 * Provides a unified interface for different database implementations (MongoDB, etc.)
 */
export interface IDatabaseAdapter {
  // Connection Management
  initialize(): Promise<void> | void;
  close(): Promise<void> | void;
  isConnected(): boolean;

  // User Management
  createUser(userData: CreateUserData): Promise<User> | User;
  getUserById(id: number | string): Promise<User | null> | User | null;
  findUserById(id: number | string): Promise<User | null> | User | null;
  getUserByEmail(email: string): Promise<User | null> | User | null;
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
  getAccountCredentials(id: number | string): Promise<any> | any; // Get decrypted credentials for an account

  // Order History Management
  createOrderHistory(orderData: CreateOrderHistoryData): Promise<OrderHistory> | OrderHistory;
  getOrderHistoryById(id: string): Promise<OrderHistory | null> | OrderHistory | null;
  getOrderHistoryByBrokerOrderId(brokerOrderId: string): Promise<OrderHistory | null> | OrderHistory | null;
  getOrderHistoryByUserId(userId: number | string, limit?: number, offset?: number): Promise<OrderHistory[]> | OrderHistory[];
  getOrderHistoryByUserIdWithFilters(userId: number | string, limit?: number, offset?: number, filters?: OrderFilters): Promise<OrderHistory[]> | OrderHistory[];
  updateOrderStatus(id: string, status: string): Promise<boolean> | boolean;
  updateOrderStatusByBrokerOrderId(brokerOrderId: string, status: string): Promise<boolean> | boolean;
  updateOrderWithError?(id: string, errorData: {
    status: string;
    error_message?: string;
    error_code?: string;
    error_type?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
    failure_reason?: string;
    is_retryable?: boolean;
  }): Promise<boolean> | boolean;
  updateOrderComprehensive?(id: string, updateData: {
    status?: string;
    executed_quantity?: number;
    average_price?: number;
    rejection_reason?: string;
    error_message?: string;
    error_code?: string;
    error_type?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
    failure_reason?: string;
    is_retryable?: boolean;
    last_updated?: Date;
  }): Promise<OrderHistory | null> | OrderHistory | null;
  incrementOrderRetryCount?(id: string): Promise<boolean> | boolean;
  deleteOrderHistory(id: string): Promise<boolean> | boolean;
  getAllOrderHistory(limit?: number, offset?: number): Promise<OrderHistory[]> | OrderHistory[];
  getOrderCountByUserIdWithFilters(userId: number | string, filters?: OrderFilters): Promise<number> | number;

  // Notification Preferences (if needed)
  saveUserNotificationPreferences(preferences: any): Promise<boolean> | boolean;
  getUserNotificationPreferences(userId: number | string): Promise<any> | any;

  // Health Check
  healthCheck(): Promise<boolean> | boolean;
}
