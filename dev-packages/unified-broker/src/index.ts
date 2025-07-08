/**
 * @copytrade/unified-broker
 * Unified broker interface library for Indian stock market brokers
 */

// Core interfaces and types
export * from './interfaces/IBrokerService';

// Registry system for plugin management
import { BrokerRegistry, BrokerPlugin } from './registry/BrokerRegistry';
export { BrokerRegistry, BrokerPlugin };

// Factory for creating broker instances
import { BrokerFactory } from './factories/BrokerFactory';
export { BrokerFactory };

// Note: Broker plugins are now separate packages
// Import @copytrade/broker-shoonya, @copytrade/broker-fyers, etc. to register brokers

// Version information
export const VERSION = '1.1.0';

// Library metadata
export const LIBRARY_INFO = {
  name: '@copytrade/unified-broker',
  version: VERSION,
  description: 'Unified broker interface library for Indian stock market brokers',
  author: 'CopyTrade Team',
  license: 'MIT',
  repository: 'https://github.com/ravitejakamalapuram/copytradepro'
};

/**
 * Initialize the unified broker library
 */
export function initializeUnifiedBroker(): void {
  console.log(`🚀 Initializing ${LIBRARY_INFO.name} v${VERSION}`);

  const registry = BrokerRegistry.getInstance();
  const availableBrokers = registry.getAvailableBrokers();
  console.log(`✅ Unified broker library initialized with ${availableBrokers.length} broker(s):`, availableBrokers);
}

/**
 * Get library information including available brokers
 */
export function getLibraryInfo() {
  const registry = BrokerRegistry.getInstance();
  return {
    ...LIBRARY_INFO,
    availableBrokers: registry.getAvailableBrokers(),
    registeredPlugins: registry.getRegisteredPlugins()
  };
}

/**
 * Health check for the library
 */
export function healthCheck(): {
  status: 'healthy' | 'warning' | 'error';
  message: string;
  details: any;
} {
  try {
    const registry = BrokerRegistry.getInstance();
    const availableBrokers = registry.getAvailableBrokers();
    
    if (availableBrokers.length === 0) {
      return {
        status: 'warning',
        message: 'No broker plugins registered',
        details: {
          availableBrokers: [],
          suggestion: 'Make sure broker plugins are properly loaded'
        }
      };
    }
    
    return {
      status: 'healthy',
      message: `Library is healthy with ${availableBrokers.length} broker(s) available`,
      details: {
        availableBrokers,
        version: VERSION
      }
    };
  } catch (error: any) {
    return {
      status: 'error',
      message: 'Library health check failed',
      details: {
        error: error.message
      }
    };
  }
}

/**
 * Quick start helper - creates a broker instance
 */
export function createBroker(brokerName: string) {
  const factory = BrokerFactory.getInstance();
  return factory.createBroker(brokerName);
}

/**
 * Get list of all supported brokers
 */
export function getSupportedBrokers(): string[] {
  const factory = BrokerFactory.getInstance();
  return factory.getSupportedBrokers();
}

// Auto-initialize when the library is imported
initializeUnifiedBroker();
