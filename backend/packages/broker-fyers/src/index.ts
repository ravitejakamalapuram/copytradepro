/**
 * @copytrade/broker-fyers
 * Fyers broker adapter for the unified broker library
 */

import { BrokerRegistry } from '@copytrade/broker-core';
import { FyersServiceAdapter } from './FyersServiceAdapter';
import { FyersCredentials } from './types';

// Plugin metadata
export const FYERS_PLUGIN_INFO = {
  name: 'fyers',
  version: '1.0.0',
  description: 'Fyers broker integration for Indian stock markets',
  author: 'CopyTrade Team',
  website: 'https://fyers.in',
  supportedExchanges: ['NSE', 'BSE', 'NFO', 'BFO', 'MCX'],
  supportedOrderTypes: ['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET'],
  supportedProductTypes: ['CNC', 'INTRADAY', 'MARGIN', 'BO'],
  features: [
    'OAuth 2.0 authentication',
    'Real-time quotes',
    'Order placement and management',
    'Portfolio tracking',
    'Historical data',
    'WebSocket streaming'
  ]
};

// Plugin factory function
const createFyersInstance = () => {
  return new FyersServiceAdapter();
};

// Complete plugin configuration
export const fyersPlugin = {
  ...FYERS_PLUGIN_INFO,
  createInstance: createFyersInstance
};

/**
 * Auto-registration function
 * This function is called when the package is imported
 */
export function registerFyersPlugin(registry?: BrokerRegistry): void {
  const targetRegistry = registry || BrokerRegistry.getInstance();
  targetRegistry.registerPlugin(fyersPlugin);
  console.log(`✅ Registered Fyers broker plugin v${FYERS_PLUGIN_INFO.version}`);
}

/**
 * Manual registration for advanced use cases
 */
export function register(registry: BrokerRegistry): void {
  registerFyersPlugin(registry);
}

// Auto-register when imported (if registry is available)
try {
  registerFyersPlugin();
} catch (error) {
  // Registry might not be available yet, that's okay
  console.log('ℹ️ Fyers plugin will register when broker core is initialized');
}

// Default export for auto-registration
export default {
  register: registerFyersPlugin,
  plugin: fyersPlugin,
  createInstance: createFyersInstance,
  info: FYERS_PLUGIN_INFO
};

// Named exports for manual usage
export { FyersServiceAdapter };
export * from './types';
export * from './helpers';

// Utility functions specific to Fyers
export { validateFyersCredentials, generateFyersAuthUrl } from './utils';

/**
 * Create a Fyers broker instance directly
 * Useful for testing or advanced use cases
 */
export function createFyersBroker(): FyersServiceAdapter {
  return new FyersServiceAdapter();
}

/**
 * Validate Fyers credentials
 */
export function validateFyersCredentials(credentials: FyersCredentials): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!credentials.appId) errors.push('App ID is required');
  if (!credentials.clientId) errors.push('Client ID is required');
  if (!credentials.secretKey) errors.push('Secret key is required');
  if (!credentials.redirectUri) errors.push('Redirect URI is required');
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generate Fyers OAuth authorization URL
 */
export function generateFyersAuthUrl(appId: string, redirectUri: string, state?: string): string {
  const baseUrl = 'https://api.fyers.in/api/v2/generate-authcode';
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state: state || 'default_state'
  });
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Get Fyers-specific configuration
 */
export function getFyersConfig() {
  return {
    baseUrl: 'https://api.fyers.in/api/v2/',
    authUrl: 'https://api.fyers.in/api/v2/generate-authcode',
    tokenUrl: 'https://api.fyers.in/api/v2/validate-authcode',
    refreshUrl: 'https://api.fyers.in/api/v2/validate-refresh-token',
    websocketUrl: 'wss://api.fyers.in/socket/v2/',
    rateLimits: {
      ordersPerSecond: 10,
      quotesPerSecond: 100,
      authPerMinute: 1
    },
    supportedExchanges: FYERS_PLUGIN_INFO.supportedExchanges,
    supportedOrderTypes: FYERS_PLUGIN_INFO.supportedOrderTypes,
    supportedProductTypes: FYERS_PLUGIN_INFO.supportedProductTypes
  };
}

/**
 * Parse authorization code from redirect URL
 */
export function parseAuthCodeFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('auth_code');
  } catch (error) {
    return null;
  }
}

/**
 * Check if Fyers access token is expired
 */
export function isFyersTokenExpired(tokenTimestamp: number, expiryHours: number = 24): boolean {
  const now = Date.now();
  const expiryTime = tokenTimestamp + (expiryHours * 60 * 60 * 1000);
  return now >= expiryTime;
}

// Version information
export const VERSION = FYERS_PLUGIN_INFO.version;
