/**
 * Shoonya Broker Plugin
 * Self-registering broker plugin for the unified broker library
 */

import { BrokerRegistry, BrokerPlugin } from '../broker-core/src/registry/BrokerRegistry';
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

// Auto-registration function
export function registerShoonyaPlugin(registry: BrokerRegistry): void {
  registry.registerPlugin(shoonyaPlugin);
}

// Default export for auto-registration
export default {
  register: registerShoonyaPlugin,
  plugin: shoonyaPlugin,
  createInstance: createShoonyaInstance
};

// Named exports for manual usage
export { ShoonyaServiceAdapter };
export * from './types';
export * from './helpers';
