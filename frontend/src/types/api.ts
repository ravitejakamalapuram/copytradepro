/**
 * API Response Types
 * Proper TypeScript interfaces to replace 'any' types
 */

// Standardized Error Object
export interface ApiError {
  message: string;
  code: string;
  retryable: boolean;
  details?: any;
}

// Base API Response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  requestId?: string;
  timestamp?: string;
  // Legacy support
  message?: string;
}

// Error Response
export interface ErrorResponse {
  success: false;
  error: ApiError;
  requestId?: string;
  timestamp?: string;
  // Legacy support
  message?: string;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  message?: string;
}

// Broker Types
export interface BrokerCredentials {
  userId?: string;
  password?: string;
  vendorCode?: string;
  apiSecret?: string;
  imei?: string;
  totpKey?: string;
  appId?: string;
  secretId?: string;
  redirectUri?: string;
  authCode?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface ConnectedAccount {
  id: string;
  brokerName: string;
  accountId: string;
  userId: string;
  userName: string;
  email: string;
  brokerDisplayName: string;
  exchanges: string[];
  products: string[];
  isActive: boolean; // Computed field for backward compatibility
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH'; // New authentication status
  tokenExpiryTime: string | null; // ISO string or null for infinity (Shoonya)
  createdAt: Date;
  accessToken?: string;
}

export interface BrokerResponse {
  success: boolean;
  data?: ConnectedAccount;
  message?: string;
  error?: string;
}

// Order Types
export interface OrderRequest {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  price?: number;
  triggerPrice?: number;
  exchange: string;
  productType: string;
  selectedAccounts: string[];
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  message?: string;
  error?: string;
  details?: {
    symbol: string;
    quantity: number;
    price?: number;
    status: string;
  };
}

export interface Order {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: string;
  price?: number;
  triggerPrice?: number;
  status: 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED' | 'FAILED';
  exchange: string;
  productType: string;
  accountId: string;
  brokerName: string;
  createdAt: Date;
  updatedAt: Date;
  executedPrice?: number;
  executedQuantity?: number;
  errorMessage?: string;
}

// Market Data Types
export interface Quote {
  symbol: string;
  exchange: string;
  ltp: number;
  change: number;
  changePercent: number;
  volume: number;
  high: number;
  low: number;
  open: number;
  close: number;
}

export interface SearchResult {
  symbol: string;
  exchange: string;
  token: string;
  name?: string;
  instrumentType?: string;
}

// Portfolio Types
export interface Position {
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  productType: string;
}

export interface Holding {
  symbol: string;
  exchange: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  value: number;
}

// Notification Types
export interface NotificationData {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp?: Date;
  orderId?: string;
  symbol?: string;
}

export interface NotificationSettings {
  orderUpdates: boolean;
  priceAlerts: boolean;
  systemNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

// Form Event Types
export interface FormEvent extends React.FormEvent<HTMLFormElement> {
  target: HTMLFormElement;
}

export interface InputChangeEvent extends React.ChangeEvent<HTMLInputElement> {
  target: HTMLInputElement;
}

export interface SelectChangeEvent extends React.ChangeEvent<HTMLSelectElement> {
  target: HTMLSelectElement;
}

// Generic Event Handler Types
export type EventHandler<T = Element> = (event: React.SyntheticEvent<T>) => void;
export type ChangeHandler<T = HTMLInputElement> = (event: React.ChangeEvent<T>) => void;
export type ClickHandler<T = HTMLButtonElement> = (event: React.MouseEvent<T>) => void;
export type SubmitHandler = (event: React.FormEvent<HTMLFormElement>) => void;

// API Function Types
export type ApiFunction<TRequest = unknown, TResponse = unknown> = (
  data: TRequest
) => Promise<ApiResponse<TResponse>>;

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingProps extends BaseComponentProps {
  loading?: boolean;
  error?: string | null;
}
