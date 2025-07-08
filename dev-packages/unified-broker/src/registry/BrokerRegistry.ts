/**
 * Broker Registry - Core component for dynamic broker registration
 * Enables plugin-based architecture for publishable broker library
 */

import { IBrokerService } from '../interfaces/IBrokerService';

export interface BrokerPlugin {
  name: string;
  version: string;
  description?: string;
  createInstance: () => IBrokerService;
  dependencies?: string[];
}

export interface BrokerRegistryConfig {
  autoLoad?: boolean;
  pluginPaths?: string[];
  enabledBrokers?: string[];
}

export class BrokerRegistry {
  private static instance: BrokerRegistry;
  private plugins: Map<string, BrokerPlugin> = new Map();
  private instances: Map<string, IBrokerService> = new Map();
  private config: BrokerRegistryConfig;

  private constructor(config: BrokerRegistryConfig = {}) {
    this.config = {
      autoLoad: true,
      pluginPaths: [],
      enabledBrokers: [],
      ...config
    };
  }

  public static getInstance(config?: BrokerRegistryConfig): BrokerRegistry {
    if (!BrokerRegistry.instance) {
      BrokerRegistry.instance = new BrokerRegistry(config);
    }
    return BrokerRegistry.instance;
  }

  /**
   * Register a broker plugin
   * @param plugin - Broker plugin configuration
   */
  registerPlugin(plugin: BrokerPlugin): void {
    const normalizedName = plugin.name.toLowerCase();
    
    // Validate plugin
    if (!plugin.createInstance || typeof plugin.createInstance !== 'function') {
      throw new Error(`Invalid plugin: ${plugin.name}. createInstance must be a function.`);
    }

    // Check if broker is enabled (if enabledBrokers is specified)
    if (this.config.enabledBrokers && this.config.enabledBrokers.length > 0) {
      if (!this.config.enabledBrokers.includes(normalizedName)) {
        console.log(`🚫 Broker plugin '${plugin.name}' is disabled by configuration`);
        return;
      }
    }

    this.plugins.set(normalizedName, plugin);
    console.log(`✅ Registered broker plugin: ${plugin.name} v${plugin.version}`);
  }

  /**
   * Unregister a broker plugin
   * @param brokerName - Name of the broker to unregister
   */
  unregisterPlugin(brokerName: string): void {
    const normalizedName = brokerName.toLowerCase();
    this.plugins.delete(normalizedName);
    this.instances.delete(normalizedName);
    console.log(`🗑️ Unregistered broker plugin: ${brokerName}`);
  }

  /**
   * Create a broker instance
   * @param brokerName - Name of the broker
   * @returns IBrokerService instance
   */
  createBroker(brokerName: string): IBrokerService {
    const normalizedName = brokerName.toLowerCase();
    const plugin = this.plugins.get(normalizedName);
    
    if (!plugin) {
      const availableBrokers = this.getAvailableBrokers();
      throw new Error(
        `Broker '${brokerName}' is not registered. Available brokers: ${availableBrokers.join(', ')}`
      );
    }

    try {
      const instance = plugin.createInstance();
      console.log(`🏭 Created broker instance: ${brokerName}`);
      return instance;
    } catch (error: any) {
      throw new Error(`Failed to create broker instance '${brokerName}': ${error.message}`);
    }
  }

  /**
   * Get or create a singleton broker instance
   * @param brokerName - Name of the broker
   * @returns IBrokerService instance
   */
  getBroker(brokerName: string): IBrokerService {
    const normalizedName = brokerName.toLowerCase();
    
    if (!this.instances.has(normalizedName)) {
      const instance = this.createBroker(normalizedName);
      this.instances.set(normalizedName, instance);
    }
    
    return this.instances.get(normalizedName)!;
  }

  /**
   * Get list of available broker names
   * @returns Array of broker names
   */
  getAvailableBrokers(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get list of registered plugins with metadata
   * @returns Array of plugin information
   */
  getRegisteredPlugins(): Array<{name: string, version: string, description?: string}> {
    return Array.from(this.plugins.values()).map(plugin => ({
      name: plugin.name,
      version: plugin.version,
      ...(plugin.description && { description: plugin.description })
    }));
  }

  /**
   * Check if a broker is available
   * @param brokerName - Name of the broker
   * @returns true if broker is available
   */
  isBrokerAvailable(brokerName: string): boolean {
    return this.plugins.has(brokerName.toLowerCase());
  }

  /**
   * Clear all instances (useful for testing)
   */
  clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Reset the registry (useful for testing)
   */
  reset(): void {
    this.plugins.clear();
    this.instances.clear();
  }

  /**
   * Load broker plugins from specified paths
   * @param paths - Array of paths to load plugins from
   */
  async loadPlugins(paths: string[] = []): Promise<void> {
    const pluginPaths = [...this.config.pluginPaths || [], ...paths];
    
    for (const path of pluginPaths) {
      try {
        const plugin = await import(path);
        if (plugin.default && typeof plugin.default.register === 'function') {
          plugin.default.register(this);
        }
      } catch (error: any) {
        console.warn(`⚠️ Failed to load plugin from ${path}: ${error.message}`);
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): BrokerRegistryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<BrokerRegistryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance for convenience
export const brokerRegistry = BrokerRegistry.getInstance();
