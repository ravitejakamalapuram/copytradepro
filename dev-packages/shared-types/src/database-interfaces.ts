/**
 * Standardized Database Interfaces
 * 
 * These interfaces are used across:
 * - MongoDB adapter
  
 * - Backend services
 * - API responses
 */

import { 
  AccountStatus, 
  BrokerName, 
  Exchange, 
  OrderAction, 
  OrderType, 
  ProductType, 
  OrderStatus 
} from './constants';

// ============================================================================
// USER INTERFACES
// ============================================================================

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

// ============================================================================
// CONNECTED ACCOUNT INTERFACES
// ============================================================================

/**
 * Connected Account - Database representation
 * Used by MongoDB adapters
 */
export interface ConnectedAccount {
  id: number | string;
  user_id: number | string;
  broker_name: BrokerName;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string; // JSON string of Exchange[]
  products: string; // JSON string of ProductType[]
  encrypted_credentials: string; // Encrypted JSON
  account_status: AccountStatus;
  token_expiry_time: string | null; // Access token expiry (ISO string or null for infinity like Shoonya)
  refresh_token_expiry_time: string | null; // Refresh token expiry (ISO string for OAuth brokers like Fyers)
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating a new connected account
 */
export interface CreateConnectedAccountData {
  user_id: number | string;
  broker_name: BrokerName;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: Exchange[];
  products: ProductType[];
  credentials: any; // Will be encrypted before storage
  account_status: AccountStatus;
  token_expiry_time?: string | null; // Access token expiry (ISO string or null for infinity like Shoonya)
  refresh_token_expiry_time?: string | null; // Refresh token expiry (ISO string for OAuth brokers like Fyers)
}

/**
 * Connected Account for API responses
 * Used in frontend and API responses
 */
export interface ConnectedAccountResponse {
  id: string;
  brokerName: BrokerName;
  accountId: string;
  userId: string;
  userName: string;
  email: string;
  brokerDisplayName: string;
  exchanges: Exchange[];
  products: ProductType[];
  isActive: boolean; // Computed field for backward compatibility
  accountStatus: AccountStatus;
  tokenExpiryTime: string | null;
  isTokenExpired: boolean; // Computed field
  shouldShowActivateButton: boolean; // Computed field for UI
  shouldShowDeactivateButton: boolean; // Computed field for UI
  createdAt: string;
  // Optional fields for specific brokers
  authUrl?: string; // For OAuth brokers like Fyers
  requiresAuthCode?: boolean; // For OAuth brokers
  accessToken?: string; // For temporary storage during auth
}

// ============================================================================
// ORDER HISTORY INTERFACES
// ============================================================================

/**
 * Order History - Database representation (supports both equity and F&O)
 */
export interface OrderHistory {
  id: number | string;
  user_id: number | string;
  account_id: number | string;
  broker_name?: string; // For backward compatibility
  broker_order_id: string;
  symbol: string;
  exchange: Exchange | string; // Allow string for backward compatibility
  action: OrderAction | 'BUY' | 'SELL'; // Allow string for backward compatibility
  quantity: number;
  order_type: OrderType | string; // Allow string for backward compatibility
  product_type: ProductType | string; // Allow string for backward compatibility
  price: number;
  trigger_price?: number;
  order_status?: OrderStatus; // New standardized field
  status?: string; // Legacy field for backward compatibility
  executed_quantity?: number;
  executed_price?: number;
  order_time?: string; // ISO string
  execution_time?: string; // ISO string
  executed_at?: string; // Legacy field for backward compatibility
  error_message?: string;
  remarks?: string; // Legacy field for backward compatibility
  created_at: string;
  updated_at?: string;
  account_info?: {
    account_id: string;
    user_name: string;
    email: string;
  };
  
  // NEW: F&O specific fields
  instrument_type?: 'EQUITY' | 'OPTION' | 'FUTURE';
  underlying_symbol?: string;
  strike_price?: number | undefined;
  expiry_date?: string;
  option_type?: 'CE' | 'PE';
  lot_size?: number;
}

/**
 * Data for creating order history (supports both equity and F&O)
 */
export interface CreateOrderHistoryData {
  user_id: number | string;
  account_id: number | string;
  broker_name?: string; // For backward compatibility
  broker_order_id: string;
  symbol: string;
  exchange?: Exchange | string; // Allow string for backward compatibility
  action: OrderAction | 'BUY' | 'SELL'; // Allow string for backward compatibility
  quantity: number;
  order_type: OrderType | string; // Allow string for backward compatibility
  product_type?: ProductType | string; // Allow string for backward compatibility
  price: number;
  trigger_price?: number;
  order_status?: OrderStatus; // New standardized field
  status?: string; // Legacy field for backward compatibility
  executed_quantity?: number;
  executed_price?: number;
  order_time?: string; // ISO string
  execution_time?: string; // ISO string
  executed_at?: string; // Legacy field for backward compatibility
  error_message?: string;
  remarks?: string; // Legacy field for backward compatibility
  
  // NEW: F&O specific fields
  instrument_type?: 'EQUITY' | 'OPTION' | 'FUTURE';
  underlying_symbol?: string;
  strike_price?: number | undefined;
  expiry_date?: string;
  option_type?: 'CE' | 'PE';
  lot_size?: number;
}

/**
 * Order filters for querying
 */
export interface OrderFilters {
  user_id?: number | string;
  account_id?: number | string;
  broker_name?: BrokerName;
  symbol?: string;
  exchange?: Exchange;
  action?: OrderAction;
  order_status?: OrderStatus;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// BROKER CREDENTIALS INTERFACES
// ============================================================================

/**
 * Generic broker credentials interface
 * Extended by specific broker credential types
 */
export interface BaseBrokerCredentials {
  brokerName: BrokerName;
}

/**
 * Shoonya specific credentials
 */
export interface ShoonyaCredentials extends BaseBrokerCredentials {
  brokerName: typeof import('./constants').BROKER_NAMES.SHOONYA;
  userId: string;
  password: string;
  totpKey: string;
  vendorCode: string;
  apiSecret: string;
  imei: string;
}

/**
 * Fyers specific credentials
 */
export interface FyersCredentials extends BaseBrokerCredentials {
  brokerName: typeof import('./constants').BROKER_NAMES.FYERS;
  clientId: string;
  secretKey: string;
  redirectUri: string;
  authCode?: string; // For OAuth completion
  accessToken?: string; // After successful auth
  refreshToken?: string; // For token refresh
}

/**
 * Union type for all broker credentials
 */
export type BrokerCredentials = ShoonyaCredentials | FyersCredentials;

// ============================================================================
// DATABASE ADAPTER INTERFACE
// ============================================================================

/**
 * Unified database adapter interface
 * Implemented by MongoDB adapters
 */
export interface IDatabaseAdapter {
  // Connection Management
  initialize?(): Promise<void> | void;
  close(): Promise<void> | void;
  isConnected?(): boolean;

  // User Management
  createUser(userData: CreateUserData): Promise<User> | User;
  getUserById?(id: number | string): Promise<User | null> | User | null;
  findUserById?(id: number | string): Promise<User | null> | User | null;
  getUserByEmail?(email: string): Promise<User | null> | User | null;
  findUserByEmail?(email: string): Promise<User | null> | User | null;
  updateUser(id: number | string, userData: Partial<UpdateUserData>): Promise<User | null> | User | null;
  deleteUser(id: number | string): Promise<boolean> | boolean;
  getUserCount?(): Promise<number> | number;
  searchUsers?(query: string): Promise<User[]> | User[];

  // Connected Accounts Management
  createConnectedAccount(accountData: CreateConnectedAccountData): Promise<ConnectedAccount> | ConnectedAccount;
  getConnectedAccountsByUserId(userId: number | string): Promise<ConnectedAccount[]> | ConnectedAccount[];
  getConnectedAccountById(id: number | string): Promise<ConnectedAccount | null> | ConnectedAccount | null;
  updateConnectedAccount(id: number | string, accountData: Partial<CreateConnectedAccountData>): Promise<ConnectedAccount | null> | ConnectedAccount | null;
  deleteConnectedAccount(id: number | string): Promise<boolean> | boolean;
  getAccountCredentials(id: number | string): Promise<any> | any; // Get decrypted credentials for an account

  // Order History Management
  createOrderHistory(orderData: CreateOrderHistoryData): Promise<OrderHistory> | OrderHistory;
  getOrderHistoryById(id: number | string): Promise<OrderHistory | null> | OrderHistory | null;
  getOrderHistoryByUserId(userId: number | string, limit?: number, offset?: number): Promise<OrderHistory[]> | OrderHistory[];
  getOrderHistoryByAccountId?(accountId: number | string, limit?: number, offset?: number): Promise<OrderHistory[]> | OrderHistory[];
  getOrderHistoryByUserIdWithFilters?(userId: number | string, limit?: number, offset?: number, filters?: OrderFilters): Promise<OrderHistory[]> | OrderHistory[];
  getOrderHistoryByFilters?(filters: OrderFilters): Promise<OrderHistory[]> | OrderHistory[];
  updateOrderHistory?(id: number | string, orderData: Partial<CreateOrderHistoryData>): Promise<OrderHistory | null> | OrderHistory | null;
  updateOrderStatus?(id: number | string, status: string): Promise<boolean> | boolean;
  updateOrderStatusByBrokerOrderId?(brokerOrderId: string, status: string): Promise<boolean> | boolean;
  deleteOrderHistory(id: number | string): Promise<boolean> | boolean;
  getAllOrderHistory?(limit?: number, offset?: number): Promise<OrderHistory[]> | OrderHistory[];
  getOrderCountByUserIdWithFilters?(userId: number | string, filters?: OrderFilters): Promise<number> | number;

  // Notification Preferences (optional)
  saveUserNotificationPreferences?(preferences: any): Promise<boolean> | boolean;
  getUserNotificationPreferences?(userId: number | string): Promise<any> | any;

  // Utility Methods
  healthCheck(): Promise<boolean> | boolean;
}
