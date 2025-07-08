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



// Default export for auto-registration
export default {
  register: registerShoonyaPlugin,
  plugin: shoonyaPlugin,
  createInstance: createShoonyaInstance
};

/**
 * Auto-registration function
 */
export function registerShoonyaPlugin(registry?: BrokerRegistry): void {
  const targetRegistry = registry || BrokerRegistry.getInstance();
  targetRegistry.registerPlugin(shoonyaPlugin);
  console.log(`✅ Registered Shoonya broker plugin v${PLUGIN_INFO.version}`);
}

// Auto-register when imported (if registry is available)
try {
  registerShoonyaPlugin();
} catch (error) {
  // Registry might not be available yet, that's okay
  console.log('ℹ️ Shoonya plugin will register when broker core is initialized');
}

// Named exports for manual usage
export { ShoonyaServiceAdapter };
export * from './types';
export * from './helpers';
