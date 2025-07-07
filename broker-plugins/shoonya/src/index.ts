/**
 * Shoonya Broker Plugin - Main Entry Point
 * @copytradepro/broker-shoonya
 */

// Main plugin export
export { ShoonyaPlugin } from './ShoonyaPlugin';
export { ShoonyaPluginFactory } from './ShoonyaPlugin';

// Adapter export
export { ShoonyaAdapter } from './ShoonyaAdapter';

// Re-export types for convenience
export {
  BrokerType,
  ShoonyaCredentials,
  IBrokerPlugin,
  IBrokerAdapter,
  PluginMetadata,
  PluginStatus,
  PluginConfig
} from './types';

// Default export
import { ShoonyaPlugin } from './ShoonyaPlugin';
export default ShoonyaPlugin;

// Version info
export const PLUGIN_VERSION = '1.0.0';
export const PLUGIN_NAME = '@copytradepro/broker-shoonya';

/**
 * Quick setup function
 */
export function createShoonyaPlugin(config?: any) {
  return new ShoonyaPlugin(config);
}
