/**
 * Unified Trading API Library
 * Main entry point for the library
 */

// Core exports
export { UnifiedTradingAPI } from './core/UnifiedTradingAPI';
export { PluginManager } from './core/PluginManager';
export { BaseBrokerPlugin } from './core/BaseBrokerPlugin';

// Interface exports
export { IBrokerAdapter } from './interfaces/IBrokerAdapter';
export { IBrokerPlugin, IBrokerPluginFactory, IPluginRegistry } from './interfaces/IBrokerPlugin';

// Note: Adapters are now available as separate plugins:
// - @copytradepro/broker-shoonya
// - @copytradepro/broker-fyers

// Type exports
export * from './types';

// Utility exports
export { Logger } from './utils/Logger';

// Factory function for easy setup
import { UnifiedTradingAPI } from './core/UnifiedTradingAPI';
import {
  UnifiedTradingConfig,
  BrokerType,
  BrokerCredentials,
  ShoonyaCredentials,
  FyersCredentials
} from './types';

/**
 * Factory function to create a pre-configured UnifiedTradingAPI instance
 * Note: Plugins must be installed separately using api.installPlugin()
 */
export function createUnifiedTradingAPI(config?: Partial<UnifiedTradingConfig>): UnifiedTradingAPI {
  const defaultConfig: UnifiedTradingConfig = {
    brokers: [],
    enableLogging: true,
    logLevel: 'info',
    retryAttempts: 3,
    timeout: 30000
  };

  const finalConfig = { ...defaultConfig, ...config };
  const api = new UnifiedTradingAPI(finalConfig);

  // Note: Plugins are now installed separately:
  // await api.installPlugin(new ShoonyaPlugin());
  // await api.installPlugin(new FyersPlugin());

  return api;
}

/**
 * Quick setup function for common use cases
 */
export function quickSetup(options: {
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}): UnifiedTradingAPI {
  return createUnifiedTradingAPI({
    enableLogging: options.enableLogging ?? true,
    logLevel: options.logLevel ?? 'info'
  });
}

/**
 * Helper function to create broker credentials
 */
export function createShoonyaCredentials(
  userId: string,
  password: string,
  vendorCode: string,
  apiKey: string,
  imei: string,
  totpSecret?: string
): ShoonyaCredentials {
  return {
    userId,
    password,
    vendorCode,
    apiKey,
    imei,
    totpSecret
  };
}

export function createFyersCredentials(
  clientId: string,
  secretKey: string,
  redirectUri: string,
  authCode?: string
): FyersCredentials {
  return {
    clientId,
    secretKey,
    redirectUri,
    authCode
  };
}

// Version info
export const VERSION = '1.0.0';
export const LIBRARY_NAME = '@copytradepro/unified-trading-api';

/**
 * Get library information
 */
export function getLibraryInfo() {
  return {
    name: LIBRARY_NAME,
    version: VERSION,
    supportedBrokers: [
      BrokerType.SHOONYA,
      BrokerType.FYERS,
      // Add more as implemented
    ],
    features: [
      'Multi-broker support',
      'Unified API interface',
      'Real-time data streaming',
      'Order management',
      'Portfolio tracking',
      'Market data access',
      'OAuth authentication',
      'Error handling',
      'Event-driven architecture'
    ]
  };
}
