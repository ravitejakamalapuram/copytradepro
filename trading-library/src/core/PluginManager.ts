/**
 * Plugin Manager
 * Manages loading, initialization, and lifecycle of broker plugins
 */

import { EventEmitter } from 'events';
import {
  IBrokerPlugin,
  IBrokerPluginFactory,
  IPluginRegistry,
  PluginMetadata,
  PluginStatus,
  PluginConfig,
  PluginEvents
} from '../interfaces/IBrokerPlugin';
import { BrokerType, BrokerConfig } from '../types';
import { Logger } from '../utils/Logger';

export class PluginRegistry implements IPluginRegistry {
  private factories: Map<BrokerType, IBrokerPluginFactory> = new Map();

  register(brokerType: BrokerType, factory: IBrokerPluginFactory): void {
    this.factories.set(brokerType, factory);
  }

  unregister(brokerType: BrokerType): void {
    this.factories.delete(brokerType);
  }

  getFactory(brokerType: BrokerType): IBrokerPluginFactory | undefined {
    return this.factories.get(brokerType);
  }

  listRegistered(): BrokerType[] {
    return Array.from(this.factories.keys());
  }

  isRegistered(brokerType: BrokerType): boolean {
    return this.factories.has(brokerType);
  }
}

export class PluginManager extends EventEmitter {
  private plugins: Map<BrokerType, IBrokerPlugin> = new Map();
  private registry: IPluginRegistry = new PluginRegistry();
  private logger: Logger;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.startHealthCheckMonitoring();
  }

  // ============================================================================
  // PLUGIN REGISTRATION
  // ============================================================================

  /**
   * Register a plugin factory
   */
  registerPluginFactory(brokerType: BrokerType, factory: IBrokerPluginFactory): void {
    this.registry.register(brokerType, factory);
    this.logger.info(`Plugin factory registered for ${brokerType}`);
  }

  /**
   * Install a plugin instance
   */
  async installPlugin(plugin: IBrokerPlugin): Promise<void> {
    const metadata = plugin.getMetadata();
    const brokerType = metadata.brokerType;

    if (this.plugins.has(brokerType)) {
      throw new Error(`Plugin for ${brokerType} is already installed`);
    }

    try {
      // Validate plugin dependencies
      const depValidation = plugin.validateDependencies();
      if (!depValidation.isValid) {
        throw new Error(`Plugin dependencies validation failed: ${depValidation.missing.join(', ')}`);
      }

      // Store plugin
      this.plugins.set(brokerType, plugin);

      // Set up event listeners
      this.setupPluginEventListeners(plugin);

      // Emit loaded event
      this.emit('plugin:loaded', { plugin, metadata });
      this.logger.info(`Plugin installed: ${metadata.name} v${metadata.version}`);

    } catch (error) {
      this.logger.error(`Failed to install plugin for ${brokerType}:`, error);
      throw error;
    }
  }

  /**
   * Create and install plugin from factory
   */
  async createAndInstallPlugin(
    brokerType: BrokerType, 
    brokerConfig: BrokerConfig,
    pluginConfig?: Partial<PluginConfig>
  ): Promise<void> {
    const factory = this.registry.getFactory(brokerType);
    if (!factory) {
      throw new Error(`No plugin factory registered for ${brokerType}`);
    }

    const plugin = factory.createPlugin(pluginConfig);
    await this.installPlugin(plugin);
    await this.initializePlugin(brokerType, brokerConfig);
  }

  // ============================================================================
  // PLUGIN LIFECYCLE
  // ============================================================================

  /**
   * Initialize a plugin
   */
  async initializePlugin(brokerType: BrokerType, brokerConfig: BrokerConfig): Promise<void> {
    const plugin = this.getPlugin(brokerType);
    
    try {
      // Validate configuration
      const configValidation = plugin.validateConfig(brokerConfig);
      if (!configValidation.isValid) {
        throw new Error(`Configuration validation failed: ${configValidation.errors.join(', ')}`);
      }

      await plugin.initialize(brokerConfig);
      this.emit('plugin:initialized', { plugin });
      this.logger.info(`Plugin initialized: ${brokerType}`);

    } catch (error) {
      this.logger.error(`Failed to initialize plugin ${brokerType}:`, error);
      this.emit('plugin:error', { plugin, error: error as Error });
      throw error;
    }
  }

  /**
   * Start a plugin
   */
  async startPlugin(brokerType: BrokerType): Promise<void> {
    const plugin = this.getPlugin(brokerType);
    
    try {
      await plugin.start();
      this.emit('plugin:started', { plugin });
      this.logger.info(`Plugin started: ${brokerType}`);

    } catch (error) {
      this.logger.error(`Failed to start plugin ${brokerType}:`, error);
      this.emit('plugin:error', { plugin, error: error as Error });
      throw error;
    }
  }

  /**
   * Stop a plugin
   */
  async stopPlugin(brokerType: BrokerType): Promise<void> {
    const plugin = this.getPlugin(brokerType);
    
    try {
      await plugin.stop();
      this.emit('plugin:stopped', { plugin });
      this.logger.info(`Plugin stopped: ${brokerType}`);

    } catch (error) {
      this.logger.error(`Failed to stop plugin ${brokerType}:`, error);
      this.emit('plugin:error', { plugin, error: error as Error });
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(brokerType: BrokerType): Promise<void> {
    const plugin = this.getPlugin(brokerType);
    
    try {
      await plugin.destroy();
      this.plugins.delete(brokerType);
      this.logger.info(`Plugin uninstalled: ${brokerType}`);

    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${brokerType}:`, error);
      throw error;
    }
  }

  // ============================================================================
  // PLUGIN ACCESS
  // ============================================================================

  /**
   * Get a plugin instance
   */
  getPlugin(brokerType: BrokerType): IBrokerPlugin {
    const plugin = this.plugins.get(brokerType);
    if (!plugin) {
      throw new Error(`Plugin for ${brokerType} is not installed`);
    }
    return plugin;
  }

  /**
   * Check if plugin is installed
   */
  hasPlugin(brokerType: BrokerType): boolean {
    return this.plugins.has(brokerType);
  }

  /**
   * Get all installed plugins
   */
  getInstalledPlugins(): BrokerType[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Get plugin metadata
   */
  getPluginMetadata(brokerType: BrokerType): PluginMetadata {
    const plugin = this.getPlugin(brokerType);
    return plugin.getMetadata();
  }

  /**
   * Get plugin status
   */
  getPluginStatus(brokerType: BrokerType): PluginStatus {
    const plugin = this.getPlugin(brokerType);
    return plugin.getStatus();
  }

  // ============================================================================
  // HEALTH MONITORING
  // ============================================================================

  /**
   * Start health check monitoring for all plugins
   */
  private startHealthCheckMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      for (const [brokerType, plugin] of this.plugins) {
        try {
          const isHealthy = await plugin.performHealthCheck();
          this.emit('plugin:health-check', { plugin, isHealthy });
          
          if (!isHealthy) {
            this.logger.warn(`Plugin health check failed: ${brokerType}`);
          }
        } catch (error) {
          this.logger.error(`Health check error for ${brokerType}:`, error);
          this.emit('plugin:error', { plugin, error: error as Error });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheckMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ============================================================================
  // PLUGIN EVENT HANDLING
  // ============================================================================

  /**
   * Set up event listeners for a plugin
   */
  private setupPluginEventListeners(plugin: IBrokerPlugin): void {
    plugin.onError((error) => {
      this.emit('plugin:error', { plugin, error });
    });

    plugin.onStatusChange((status) => {
      // Forward status changes
    });

    plugin.onMetricsUpdate((metrics) => {
      this.emit('plugin:metrics-update', { plugin, metrics });
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get plugin manager statistics
   */
  getStatistics(): {
    totalPlugins: number;
    healthyPlugins: number;
    unhealthyPlugins: number;
    pluginsByStatus: Record<string, number>;
  } {
    const total = this.plugins.size;
    let healthy = 0;
    let unhealthy = 0;
    const statusCounts: Record<string, number> = {};

    for (const plugin of this.plugins.values()) {
      const status = plugin.getStatus();
      if (status.isHealthy) {
        healthy++;
      } else {
        unhealthy++;
      }

      const statusKey = `${status.isLoaded ? 'loaded' : 'unloaded'}-${status.isInitialized ? 'initialized' : 'uninitialized'}`;
      statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
    }

    return {
      totalPlugins: total,
      healthyPlugins: healthy,
      unhealthyPlugins: unhealthy,
      pluginsByStatus: statusCounts
    };
  }

  /**
   * Restart all plugins
   */
  async restartAllPlugins(): Promise<void> {
    for (const brokerType of this.plugins.keys()) {
      try {
        const plugin = this.getPlugin(brokerType);
        await plugin.restart();
        this.logger.info(`Plugin restarted: ${brokerType}`);
      } catch (error) {
        this.logger.error(`Failed to restart plugin ${brokerType}:`, error);
      }
    }
  }

  /**
   * Get plugin capabilities
   */
  getPluginCapabilities(brokerType: BrokerType) {
    const plugin = this.getPlugin(brokerType);
    return plugin.getCapabilities();
  }

  /**
   * Cleanup and destroy plugin manager
   */
  async destroy(): Promise<void> {
    this.stopHealthCheckMonitoring();

    // Uninstall all plugins
    const uninstallPromises = Array.from(this.plugins.keys()).map(
      brokerType => this.uninstallPlugin(brokerType)
    );

    await Promise.allSettled(uninstallPromises);
    this.plugins.clear();
    this.removeAllListeners();
  }
}
