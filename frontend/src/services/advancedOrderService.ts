import { authService } from './authService';

export interface OrderTemplate {
  id?: number;
  user_id: number;
  name: string;
  description?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET' | 'BRACKET' | 'COVER' | 'ICEBERG' | 'TRAILING_SL';
  price?: number;
  trigger_price?: number;
  stop_loss?: number;
  take_profit?: number;
  exchange: string;
  product_type: string;
  validity: 'DAY' | 'IOC' | 'GTD';
  iceberg_quantity?: number;
  trail_amount?: number;
  trail_percent?: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AdvancedOrder {
  id?: number;
  user_id: number;
  parent_order_id?: number;
  order_group_id?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET' | 'BRACKET' | 'COVER' | 'ICEBERG' | 'TRAILING_SL';
  price?: number;
  trigger_price?: number;
  stop_loss?: number;
  take_profit?: number;
  status: 'PENDING' | 'ACTIVE' | 'TRIGGERED' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED';
  exchange: string;
  product_type: string;
  validity: 'DAY' | 'IOC' | 'GTD';
  expiry_date?: string;
  iceberg_quantity?: number;
  iceberg_executed: number;
  trail_amount?: number;
  trail_percent?: number;
  trail_trigger_price?: number;
  condition_type?: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'TIME_BASED' | 'VOLUME_BASED';
  condition_value?: number;
  is_bracket_order: boolean;
  bracket_stop_loss?: number;
  bracket_take_profit?: number;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
  executed_at?: string;
}

export interface OrderModification {
  id?: number;
  user_id: number;
  order_id: number;
  broker_order_id: string;
  modification_type: 'PRICE' | 'QUANTITY' | 'TRIGGER_PRICE' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'CANCEL';
  old_value?: number;
  new_value?: number;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  error_message?: string;
  created_at?: string;
}

export interface BracketOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stop_loss: number;
  take_profit: number;
  exchange?: string;
  product_type?: string;
  validity?: 'DAY' | 'IOC' | 'GTD';
}

export interface IcebergOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  iceberg_quantity: number;
  exchange?: string;
  product_type?: string;
  validity?: 'DAY' | 'IOC' | 'GTD';
}

export interface TrailingStopOrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  trigger_price: number;
  trail_amount?: number;
  trail_percent?: number;
  exchange?: string;
  product_type?: string;
  validity?: 'DAY' | 'IOC' | 'GTD';
}

export interface BulkOrderRequest {
  orders: Array<{
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
    price?: number;
    trigger_price?: number;
    exchange?: string;
    product_type?: string;
  }>;
  execution_type: 'PARALLEL' | 'SEQUENTIAL';
  stop_on_error: boolean;
}

class AdvancedOrderService {
  private baseURL = '/api/advanced-orders';

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }

    return data.data;
  }

  /**
   * Order Templates
   */
  async createOrderTemplate(templateData: Omit<OrderTemplate, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<OrderTemplate> {
    return this.makeRequest('/templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  async getOrderTemplates(activeOnly: boolean = false): Promise<{ templates: OrderTemplate[]; count: number }> {
    const params = activeOnly ? '?active_only=true' : '';
    return this.makeRequest(`/templates${params}`);
  }

  async getOrderTemplate(templateId: number): Promise<OrderTemplate> {
    return this.makeRequest(`/templates/${templateId}`);
  }

  async updateOrderTemplate(templateId: number, updates: Partial<OrderTemplate>): Promise<OrderTemplate> {
    return this.makeRequest(`/templates/${templateId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteOrderTemplate(templateId: number): Promise<{ message: string }> {
    return this.makeRequest(`/templates/${templateId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Advanced Orders
   */
  async createBracketOrder(orderData: BracketOrderRequest): Promise<{ order_group_id: string; orders: AdvancedOrder[]; message: string }> {
    return this.makeRequest('/bracket', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async createIcebergOrder(orderData: IcebergOrderRequest): Promise<{ order: AdvancedOrder; message: string }> {
    return this.makeRequest('/iceberg', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async createTrailingStopOrder(orderData: TrailingStopOrderRequest): Promise<{ order: AdvancedOrder; message: string }> {
    return this.makeRequest('/trailing-stop', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  }

  async getAdvancedOrders(status?: string): Promise<{ orders: AdvancedOrder[]; count: number }> {
    const params = status ? `?status=${status}` : '';
    return this.makeRequest(`/orders${params}`);
  }

  async getAdvancedOrder(orderId: number): Promise<{ order: AdvancedOrder; modifications: OrderModification[] }> {
    return this.makeRequest(`/orders/${orderId}`);
  }

  async cancelAdvancedOrder(orderId: number): Promise<{ message: string }> {
    return this.makeRequest(`/orders/${orderId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * Utility methods
   */
  getOrderTypeDisplayName(orderType: string): string {
    const displayNames: Record<string, string> = {
      'MARKET': 'Market Order',
      'LIMIT': 'Limit Order',
      'SL-LIMIT': 'Stop Loss Limit',
      'SL-MARKET': 'Stop Loss Market',
      'BRACKET': 'Bracket Order',
      'COVER': 'Cover Order',
      'ICEBERG': 'Iceberg Order',
      'TRAILING_SL': 'Trailing Stop Loss'
    };
    return displayNames[orderType] || orderType;
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'PENDING': 'var(--color-warning-500)',
      'ACTIVE': 'var(--interactive-primary)',
      'TRIGGERED': 'var(--color-accent)',
      'EXECUTED': 'var(--color-profit)',
      'CANCELLED': 'var(--color-neutral)',
      'EXPIRED': 'var(--color-loss)'
    };
    return colors[status] || 'var(--color-neutral)';
  }

  getStatusDisplayName(status: string): string {
    const displayNames: Record<string, string> = {
      'PENDING': 'Pending',
      'ACTIVE': 'Active',
      'TRIGGERED': 'Triggered',
      'EXECUTED': 'Executed',
      'CANCELLED': 'Cancelled',
      'EXPIRED': 'Expired'
    };
    return displayNames[status] || status;
  }

  formatPrice(price: number | undefined, currency: string = '₹'): string {
    if (price === undefined || price === null) return '-';
    return `${currency}${price.toFixed(2)}`;
  }

  validateBracketOrder(orderData: BracketOrderRequest): string[] {
    const errors: string[] = [];

    if (!orderData.symbol) errors.push('Symbol is required');
    if (!orderData.action) errors.push('Action is required');
    if (!orderData.quantity || orderData.quantity <= 0) errors.push('Quantity must be positive');
    if (!orderData.price || orderData.price <= 0) errors.push('Price must be positive');
    if (!orderData.stop_loss || orderData.stop_loss <= 0) errors.push('Stop loss must be positive');
    if (!orderData.take_profit || orderData.take_profit <= 0) errors.push('Take profit must be positive');

    if (orderData.action === 'BUY') {
      if (orderData.stop_loss >= orderData.price) {
        errors.push('Stop loss must be below entry price for BUY orders');
      }
      if (orderData.take_profit <= orderData.price) {
        errors.push('Take profit must be above entry price for BUY orders');
      }
    } else if (orderData.action === 'SELL') {
      if (orderData.stop_loss <= orderData.price) {
        errors.push('Stop loss must be above entry price for SELL orders');
      }
      if (orderData.take_profit >= orderData.price) {
        errors.push('Take profit must be below entry price for SELL orders');
      }
    }

    return errors;
  }

  validateIcebergOrder(orderData: IcebergOrderRequest): string[] {
    const errors: string[] = [];

    if (!orderData.symbol) errors.push('Symbol is required');
    if (!orderData.action) errors.push('Action is required');
    if (!orderData.quantity || orderData.quantity <= 0) errors.push('Quantity must be positive');
    if (!orderData.price || orderData.price <= 0) errors.push('Price must be positive');
    if (!orderData.iceberg_quantity || orderData.iceberg_quantity <= 0) errors.push('Iceberg quantity must be positive');

    if (orderData.iceberg_quantity >= orderData.quantity) {
      errors.push('Iceberg quantity must be less than total quantity');
    }

    return errors;
  }

  validateTrailingStopOrder(orderData: TrailingStopOrderRequest): string[] {
    const errors: string[] = [];

    if (!orderData.symbol) errors.push('Symbol is required');
    if (!orderData.action) errors.push('Action is required');
    if (!orderData.quantity || orderData.quantity <= 0) errors.push('Quantity must be positive');
    if (!orderData.trigger_price || orderData.trigger_price <= 0) errors.push('Trigger price must be positive');

    if (!orderData.trail_amount && !orderData.trail_percent) {
      errors.push('Either trail amount or trail percent must be provided');
    }

    if (orderData.trail_percent && (orderData.trail_percent <= 0 || orderData.trail_percent > 100)) {
      errors.push('Trail percent must be between 0 and 100');
    }

    return errors;
  }
}

export const advancedOrderService = new AdvancedOrderService();
