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



// Default export for auto-registration
export default {
  register: registerFyersPlugin,
  plugin: fyersPlugin,
  createInstance: createFyersInstance
};

/**
 * Auto-registration function
 */
export function registerFyersPlugin(registry?: BrokerRegistry): void {
  const targetRegistry = registry || BrokerRegistry.getInstance();
  targetRegistry.registerPlugin(fyersPlugin);
  console.log(`✅ Registered Fyers broker plugin v${PLUGIN_INFO.version}`);
}

// Auto-register when imported (if registry is available)
try {
  registerFyersPlugin();
} catch (error) {
  // Registry might not be available yet, that's okay
  console.log('ℹ️ Fyers plugin will register when broker core is initialized');
}

// Named exports for manual usage
export { FyersServiceAdapter };
export * from './types';
export * from './helpers';
