// Database models and interfaces

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

// Mock database operations for Order model (since we're using SQLite service)
export const Order = {
  findByPk: async (id: string | number): Promise<Order | null> => {
    // This is a placeholder - in real implementation, this would use the SQLite service
    // For now, return null to prevent build errors
    console.warn('Order.findByPk called - this should be replaced with proper database service');
    return null;
  },

  findAll: async (options?: any): Promise<Order[]> => {
    // This is a placeholder - in real implementation, this would use the SQLite service
    console.warn('Order.findAll called - this should be replaced with proper database service');
    return [];
  },

  create: async (data: Partial<Order>): Promise<Order> => {
    // This is a placeholder - in real implementation, this would use the SQLite service
    console.warn('Order.create called - this should be replaced with proper database service');
    throw new Error('Order.create not implemented - use SQLite service instead');
  },

  update: async (data: Partial<Order>, options: any): Promise<[number, Order[]]> => {
    // This is a placeholder - in real implementation, this would use the SQLite service
    console.warn('Order.update called - this should be replaced with proper database service');
    return [0, []];
  }
};

export default {
  Order
};
