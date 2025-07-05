/**
 * Broker Plugin Interface
 * Defines the contract for broker-specific plugins
 */

import { IBrokerAdapter } from './IBrokerAdapter';
import { BrokerType, BrokerConfig } from '../types';

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage?: string;
  repository?: string;
  keywords: string[];
  brokerType: BrokerType;
  supportedFeatures: {
    authentication: string[];
    orderTypes: string[];
    exchanges: string[];
    products: string[];
    realTimeData: boolean;
    historicalData: boolean;
    optionsTrading: boolean;
    commoditiesTrading: boolean;
  };
  dependencies?: {
    [packageName: string]: string;
  };
  peerDependencies?: {
    [packageName: string]: string;
  };
}

export interface PluginStatus {
  isLoaded: boolean;
  isInitialized: boolean;
  isHealthy: boolean;
  lastHealthCheck: Date;
  errorCount: number;
  lastError?: Error;
  uptime: number;
  memoryUsage?: {
    used: number;
    total: number;
  };
}

export interface PluginConfig {
  enabled: boolean;
  autoStart: boolean;
  healthCheckInterval: number;
  maxRetries: number;
  timeout: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  customSettings?: {
    [key: string]: any;
  };
}

export interface IBrokerPlugin {
  // ============================================================================
  // PLUGIN METADATA
  // ============================================================================
  
  /**
   * Get plugin metadata
   */
  getMetadata(): PluginMetadata;
  
  /**
   * Get plugin configuration
   */
  getConfig(): PluginConfig;
  
  /**
   * Update plugin configuration
   */
  updateConfig(config: Partial<PluginConfig>): void;

  // ============================================================================
  // PLUGIN LIFECYCLE
  // ============================================================================
  
  /**
   * Initialize the plugin
   */
  initialize(brokerConfig: BrokerConfig): Promise<void>;
  
  /**
   * Start the plugin services
   */
  start(): Promise<void>;
  
  /**
   * Stop the plugin services
   */
  stop(): Promise<void>;
  
  /**
   * Destroy the plugin and cleanup resources
   */
  destroy(): Promise<void>;
  
  /**
   * Restart the plugin
   */
  restart(): Promise<void>;

  // ============================================================================
  // BROKER ADAPTER
  // ============================================================================
  
  /**
   * Get the broker adapter instance
   */
  getAdapter(): IBrokerAdapter;
  
  /**
   * Create a new adapter instance
   */
  createAdapter(): IBrokerAdapter;

  // ============================================================================
  // HEALTH & STATUS
  // ============================================================================
  
  /**
   * Check if plugin is healthy
   */
  isHealthy(): boolean;
  
  /**
   * Get detailed plugin status
   */
  getStatus(): PluginStatus;
  
  /**
   * Perform health check
   */
  performHealthCheck(): Promise<boolean>;
  
  /**
   * Get plugin metrics
   */
  getMetrics(): {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
    lastRequestTime: Date;
    uptime: number;
  };

  // ============================================================================
  // EVENT HANDLING
  // ============================================================================
  
  /**
   * Set error callback
   */
  onError(callback: (error: Error) => void): void;
  
  /**
   * Set status change callback
   */
  onStatusChange(callback: (status: PluginStatus) => void): void;
  
  /**
   * Set metrics update callback
   */
  onMetricsUpdate(callback: (metrics: any) => void): void;

  // ============================================================================
  // PLUGIN VALIDATION
  // ============================================================================
  
  /**
   * Validate plugin configuration
   */
  validateConfig(config: BrokerConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
  
  /**
   * Validate plugin dependencies
   */
  validateDependencies(): {
    isValid: boolean;
    missing: string[];
    incompatible: string[];
  };
  
  /**
   * Get plugin capabilities
   */
  getCapabilities(): {
    maxConcurrentConnections: number;
    maxOrdersPerSecond: number;
    supportedOrderTypes: string[];
    supportedExchanges: string[];
    requiresApiKey: boolean;
    requiresOAuth: boolean;
    supportsWebSocket: boolean;
    supportsHistoricalData: boolean;
  };

  // ============================================================================
  // PLUGIN UTILITIES
  // ============================================================================
  
  /**
   * Get plugin version information
   */
  getVersionInfo(): {
    pluginVersion: string;
    apiVersion: string;
    brokerApiVersion?: string;
    lastUpdated: Date;
    changelog?: string[];
  };
  
  /**
   * Export plugin configuration
   */
  exportConfig(): string;
  
  /**
   * Import plugin configuration
   */
  importConfig(configString: string): boolean;
  
  /**
   * Reset plugin to default state
   */
  reset(): Promise<void>;
}

// ============================================================================
// PLUGIN FACTORY INTERFACE
// ============================================================================

export interface IBrokerPluginFactory {
  /**
   * Create a new plugin instance
   */
  createPlugin(config?: Partial<PluginConfig>): IBrokerPlugin;
  
  /**
   * Get supported broker types
   */
  getSupportedBrokers(): BrokerType[];
  
  /**
   * Validate plugin compatibility
   */
  isCompatible(apiVersion: string): boolean;
}

// ============================================================================
// PLUGIN REGISTRY INTERFACE
// ============================================================================

export interface IPluginRegistry {
  /**
   * Register a plugin factory
   */
  register(brokerType: BrokerType, factory: IBrokerPluginFactory): void;
  
  /**
   * Unregister a plugin factory
   */
  unregister(brokerType: BrokerType): void;
  
  /**
   * Get registered plugin factory
   */
  getFactory(brokerType: BrokerType): IBrokerPluginFactory | undefined;
  
  /**
   * List all registered brokers
   */
  listRegistered(): BrokerType[];
  
  /**
   * Check if broker is registered
   */
  isRegistered(brokerType: BrokerType): boolean;
}

// ============================================================================
// PLUGIN EVENTS
// ============================================================================

export interface PluginEvents {
  'plugin:loaded': { plugin: IBrokerPlugin; metadata: PluginMetadata };
  'plugin:initialized': { plugin: IBrokerPlugin };
  'plugin:started': { plugin: IBrokerPlugin };
  'plugin:stopped': { plugin: IBrokerPlugin };
  'plugin:error': { plugin: IBrokerPlugin; error: Error };
  'plugin:health-check': { plugin: IBrokerPlugin; isHealthy: boolean };
  'plugin:metrics-update': { plugin: IBrokerPlugin; metrics: any };
}
