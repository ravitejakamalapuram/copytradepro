/**
 * Fyers Broker Plugin
 * Self-registering broker plugin for the unified broker library
 */

import { BrokerRegistry, BrokerPlugin } from '@copytrade/unified-broker';
import { FyersServiceAdapter } from './FyersServiceAdapter';

// Plugin metadata
const PLUGIN_INFO: Omit<BrokerPlugin, 'createInstance'> = {
  name: 'fyers',
  version: '1.0.0',
  description: 'Fyers broker integration for Indian stock markets',
  dependencies: []
};

// Plugin factory function
const createFyersInstance = () => {
  return new FyersServiceAdapter();
};

// Complete plugin configuration
const fyersPlugin: BrokerPlugin = {
  ...PLUGIN_INFO,
  createInstance: createFyersInstance
};



/**
 * Initialize and register the Fyers broker plugin
 * Call this method explicitly to register the broker
 */
export function initializeFyersBroker(registry?: BrokerRegistry): void {
  const targetRegistry = registry || BrokerRegistry.getInstance();

  try {
    targetRegistry.registerPlugin(fyersPlugin);
    console.log(`✅ Fyers broker plugin v${PLUGIN_INFO.version} registered successfully`);
  } catch (error) {
    console.error(`❌ Failed to register Fyers broker plugin:`, error);
    throw error;
  }
}

// Export plugin info for inspection
export const fyersBrokerInfo = PLUGIN_INFO;

// Default export for easy access
export default {
  initialize: initializeFyersBroker,
  plugin: fyersPlugin,
  createInstance: createFyersInstance,
  info: PLUGIN_INFO
};

// Named exports for manual usage
export { FyersServiceAdapter };
export { FyersSymbolFormatter } from './symbolFormatter';
export * from './types';
export * from './helpers';
