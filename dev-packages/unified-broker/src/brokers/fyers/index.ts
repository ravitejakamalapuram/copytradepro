/**
 * Fyers Broker Plugin
 * Self-registering broker plugin for the unified broker library
 */

import { BrokerRegistry, BrokerPlugin } from '../../registry/BrokerRegistry';
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

// Auto-registration function
export function registerFyersPlugin(registry: BrokerRegistry): void {
  registry.registerPlugin(fyersPlugin);
}

// Default export for auto-registration
export default {
  register: registerFyersPlugin,
  plugin: fyersPlugin,
  createInstance: createFyersInstance
};

// Named exports for manual usage
export { FyersServiceAdapter };
export { UnifiedFyersService, FyersDerivativesService } from './UnifiedFyersService';
export * from './types';
export * from './helpers';
