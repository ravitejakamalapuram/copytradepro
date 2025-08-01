// Database models and interfaces

// Export symbol models
export * from './symbolModels';

export interface User {
  id: number;
  email: string;
  name: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectedAccount {
  id: number;
  user_id: number;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string; // JSON array as string
  products: string; // JSON array as string
  encrypted_credentials: string; // Encrypted credentials JSON
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  user_id: number;
  account_id: number;
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
  remarks?: string;
  executed_at: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateOrderHistoryData {
  user_id: number;
  account_id: number;
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

// Mock database operations for Order model (using MongoDB via database adapter)
export const Order = {
  findByPk: async (id: string | number): Promise<Order | null> => {
    // This is a placeholder - use the database adapter service instead
    // Note: Order.findByPk called - this should be replaced with proper database service
    return null;
  },

  findAll: async (options?: any): Promise<Order[]> => {
    // This is a placeholder - use the database adapter service instead
    // Note: Order.findAll called - this should be replaced with proper database service
    return [];
  },

  create: async (data: Partial<Order>): Promise<Order> => {
    // This is a placeholder - use the database adapter service instead
    // Note: Order.create called - this should be replaced with proper database service
    throw new Error('Order.create not implemented - use database adapter service instead');
  },

  update: async (data: Partial<Order>, options: any): Promise<[number, Order[]]> => {
    // This is a placeholder - use the database adapter service instead
    // Note: Order.update called - this should be replaced with proper database service
    return [0, []];
  }
};

export default {
  Order
};
