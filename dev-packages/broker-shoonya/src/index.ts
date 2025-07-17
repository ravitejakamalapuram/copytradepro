/**
 * Shoonya Broker Plugin
 * Self-registering broker plugin for the unified broker library
 */

import { BrokerRegistry, BrokerPlugin } from '@copytrade/unified-broker';
import { ShoonyaServiceAdapter } from './ShoonyaServiceAdapter';

// Plugin metadata
const PLUGIN_INFO: Omit<BrokerPlugin, 'createInstance'> = {
  name: 'shoonya',
  version: '1.0.0',
  description: 'Shoonya broker integration for Indian stock markets',
  dependencies: []
};

// Plugin factory function
const createShoonyaInstance = () => {
  return new ShoonyaServiceAdapter();
};

// Complete plugin configuration
const shoonyaPlugin: BrokerPlugin = {
  ...PLUGIN_INFO,
  createInstance: createShoonyaInstance
};



/**
 * Initialize and register the Shoonya broker plugin
 * Call this method explicitly to register the broker
 */
export function initializeShoonyaBroker(registry?: BrokerRegistry): void {
  const targetRegistry = registry || BrokerRegistry.getInstance();

  try {
    targetRegistry.registerPlugin(shoonyaPlugin);
    console.log(`✅ Shoonya broker plugin v${PLUGIN_INFO.version} registered successfully`);
  } catch (error) {
    console.error(`❌ Failed to register Shoonya broker plugin:`, error);
    throw error;
  }
}

// Export plugin info for inspection
export const shoonyaBrokerInfo = PLUGIN_INFO;

// Default export for easy access
export default {
  initialize: initializeShoonyaBroker,
  plugin: shoonyaPlugin,
  createInstance: createShoonyaInstance,
  info: PLUGIN_INFO
};

// Named exports for manual usage
export { ShoonyaServiceAdapter };
export * from './types';
export * from './helpers';
