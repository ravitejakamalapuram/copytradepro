/**
 * @copytrade/broker-core
 * Unified broker interface library - Core package
 * 
 * This is the main entry point for the core broker library.
 * It exports all the essential interfaces, factories, and utilities
 * needed to work with broker plugins.
 */

// Core interfaces and types
export * from './interfaces/IBrokerService';

// Registry system for plugin management
export * from './registry/BrokerRegistry';
import { BrokerRegistry } from './registry/BrokerRegistry';
export { BrokerRegistry };

// Factory for creating broker instances
export * from './factories/BrokerFactory';
export { BrokerFactory } from './factories/BrokerFactory';

// Note: BrokerManager is part of the application, not the core library
// Applications using this library should implement their own connection management

// Utility functions
export * from './utils/brokerUtils';

// Version information
export const VERSION = '1.0.0';

// Library metadata
export const LIBRARY_INFO = {
  name: '@copytrade/broker-core',
  version: VERSION,
  description: 'Unified broker interface library for Indian stock market brokers',
  author: 'CopyTrade Team',
  license: 'MIT',
  repository: 'https://github.com/ravitejakamalapuram/copytradepro'
};

/**
 * Initialize the broker core library
 * This function sets up the registry and prepares the library for use
 */
export function initializeBrokerCore(config?: {
  enabledBrokers?: string[];
  autoLoad?: boolean;
  pluginPaths?: string[];
}): void {
  console.log(`🚀 Initializing ${LIBRARY_INFO.name} v${VERSION}`);

  if (config) {
    const registry = BrokerRegistry.getInstance();
    registry.updateConfig(config);
    console.log('⚙️ Applied configuration:', config);
  }

  console.log('✅ Broker core library initialized');
}

/**
 * Get library information
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
          suggestion: 'Install and import broker plugins like @copytrade/broker-shoonya'
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
