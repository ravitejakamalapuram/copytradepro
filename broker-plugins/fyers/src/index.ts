/**
 * Fyers Broker Plugin - Main Entry Point
 * @copytradepro/broker-fyers
 */

// Main plugin export
export { FyersPlugin } from './FyersPlugin';
export { FyersPluginFactory } from './FyersPlugin';

// Adapter export
export { FyersAdapter } from './FyersAdapter';

// Re-export types for convenience
export {
  BrokerType,
  FyersCredentials,
  IBrokerPlugin,
  IBrokerAdapter,
  PluginMetadata,
  PluginStatus,
  PluginConfig
} from './types';

// Default export
import { FyersPlugin } from './FyersPlugin';
export default FyersPlugin;

// Version info
export const PLUGIN_VERSION = '1.0.0';
export const PLUGIN_NAME = '@copytradepro/broker-fyers';

/**
 * Quick setup function
 */
export function createFyersPlugin(config?: any) {
  return new FyersPlugin(config);
}
