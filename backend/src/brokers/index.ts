/**
 * Broker Plugins Loader
 * Automatically registers all available broker plugins
 * This file enables the plugin architecture for the unified broker library
 */

import { BrokerRegistry, brokerRegistry } from '../registry/BrokerRegistry';

// Import broker plugins
import shoonyaPlugin from './shoonya';
import fyersPlugin from './fyers';

/**
 * Initialize and register all broker plugins
 * This function should be called once during application startup
 */
export function initializeBrokers(registry: BrokerRegistry = brokerRegistry): void {
  console.log('🚀 Initializing broker plugins...');

  try {
    // Register Shoonya broker
    shoonyaPlugin.register(registry);
    
    // Register Fyers broker
    fyersPlugin.register(registry);

    // Future brokers can be added here:
    // zerodhaPlugin.register(registry);
    // upstoxPlugin.register(registry);
    // angelOnePlugin.register(registry);

    const registeredBrokers = registry.getAvailableBrokers();
    console.log(`✅ Successfully registered ${registeredBrokers.length} broker plugins:`, registeredBrokers);

  } catch (error: any) {
    console.error('🚨 Failed to initialize broker plugins:', error.message);
    throw error;
  }
}

/**
 * Get list of all available broker plugins
 */
export function getAvailableBrokerPlugins(): Array<{name: string, version: string, description?: string}> {
  return brokerRegistry.getRegisteredPlugins();
}

/**
 * Load additional broker plugins from external modules
 * @param pluginPaths - Array of module paths to load
 */
export async function loadExternalBrokerPlugins(pluginPaths: string[]): Promise<void> {
  console.log('📦 Loading external broker plugins...');
  
  for (const pluginPath of pluginPaths) {
    try {
      const plugin = await import(pluginPath);
      if (plugin.default && typeof plugin.default.register === 'function') {
        plugin.default.register(brokerRegistry);
        console.log(`✅ Loaded external broker plugin from: ${pluginPath}`);
      } else {
        console.warn(`⚠️ Invalid plugin format at: ${pluginPath}`);
      }
    } catch (error: any) {
      console.error(`🚨 Failed to load plugin from ${pluginPath}:`, error.message);
    }
  }
}

/**
 * Configure broker registry with custom settings
 */
export function configureBrokerRegistry(config: {
  enabledBrokers?: string[];
  autoLoad?: boolean;
  pluginPaths?: string[];
}): void {
  brokerRegistry.updateConfig(config);
  console.log('⚙️ Broker registry configured:', config);
}

// Export broker plugins for direct access if needed
export { shoonyaPlugin, fyersPlugin };

// Export registry for advanced usage
export { brokerRegistry };

// Re-export types and interfaces
export * from '../registry/BrokerRegistry';
export * from '../interfaces/IBrokerService';
