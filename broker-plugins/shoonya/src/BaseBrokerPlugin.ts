import { EventEmitter } from 'events';
import {
  IBrokerPlugin,
  PluginMetadata,
  PluginStatus,
  PluginConfig,
  IBrokerAdapter
} from './types';

export abstract class BaseBrokerPlugin extends EventEmitter implements IBrokerPlugin {
  protected config: PluginConfig;
  protected adapter?: IBrokerAdapter;
  protected status: PluginStatus;
  protected metrics: {
    requestCount: number;
    errorCount: number;
    totalResponseTime: number;
    lastRequestTime: Date;
    startTime: Date;
  };

  constructor(config: Partial<PluginConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      autoStart: true,
      healthCheckInterval: 30000,
      maxRetries: 3,
      timeout: 30000,
      logLevel: 'info',
      ...config
    };

    this.status = {
      isLoaded: true,
      isInitialized: false,
      isHealthy: false,
      lastHealthCheck: new Date(),
      errorCount: 0,
      uptime: 0
    };

    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      lastRequestTime: new Date(),
      startTime: new Date()
    };
  }

  // Abstract methods that must be implemented by subclasses
  abstract getMetadata(): PluginMetadata;
  abstract createAdapter(): IBrokerAdapter;

  // Plugin lifecycle
  async initialize(brokerConfig: any): Promise<void> {
    try {
      const validation = this.validateConfig(brokerConfig);
      if (!validation.isValid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }

      this.adapter = this.createAdapter();
      this.status.isInitialized = true;
      this.status.isHealthy = true;
      this.emit('statusChange', this.status);
    } catch (error) {
      this.status.errorCount++;
      this.status.lastError = error as Error;
      this.status.isHealthy = false;
      this.emit('error', error);
      throw error;
    }
  }

  async start(): Promise<void> {
    if (!this.status.isInitialized) {
      throw new Error('Plugin must be initialized before starting');
    }
    this.metrics.startTime = new Date();
    this.status.isHealthy = true;
  }

  async stop(): Promise<void> {
    this.status.isHealthy = false;
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.adapter = undefined;
    this.status.isInitialized = false;
    this.status.isLoaded = false;
    this.removeAllListeners();
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  // Adapter access
  getAdapter(): IBrokerAdapter {
    if (!this.adapter) {
      throw new Error('Plugin adapter is not initialized');
    }
    return this.adapter;
  }

  // Configuration
  getConfig(): PluginConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<PluginConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Status & health
  isHealthy(): boolean {
    return this.status.isHealthy && this.status.isInitialized;
  }

  getStatus(): PluginStatus {
    this.status.uptime = Date.now() - this.metrics.startTime.getTime();
    this.status.lastHealthCheck = new Date();
    return { ...this.status };
  }

  async performHealthCheck(): Promise<boolean> {
    try {
      if (!this.status.isInitialized || !this.adapter) {
        return false;
      }

      this.status.isHealthy = true;
      this.status.lastHealthCheck = new Date();
      return true;
    } catch (error) {
      this.status.isHealthy = false;
      this.status.errorCount++;
      this.status.lastError = error as Error;
      this.emit('error', error);
      return false;
    }
  }

  getMetrics() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime.getTime();
    const averageResponseTime = this.metrics.requestCount > 0 
      ? this.metrics.totalResponseTime / this.metrics.requestCount 
      : 0;

    return {
      requestCount: this.metrics.requestCount,
      errorCount: this.metrics.errorCount,
      averageResponseTime,
      lastRequestTime: this.metrics.lastRequestTime,
      uptime
    };
  }

  // Validation
  validateConfig(config: any): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config) {
      errors.push('Configuration is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateDependencies(): { isValid: boolean; missing: string[]; incompatible: string[] } {
    return {
      isValid: true,
      missing: [],
      incompatible: []
    };
  }

  getCapabilities() {
    const metadata = this.getMetadata();
    return {
      maxConcurrentConnections: 10,
      maxOrdersPerSecond: 5,
      supportedOrderTypes: ['MARKET', 'LIMIT', 'STOP_LOSS'],
      supportedExchanges: ['NSE', 'BSE'],
      requiresApiKey: true,
      requiresOAuth: false,
      supportsWebSocket: metadata.supportedFeatures.realTimeData,
      supportsHistoricalData: metadata.supportedFeatures.historicalData,
      ...metadata.supportedFeatures
    };
  }

  // Event handling
  onError(callback: (error: Error) => void): void {
    this.on('error', callback);
  }

  onStatusChange(callback: (status: PluginStatus) => void): void {
    this.on('statusChange', callback);
  }

  onMetricsUpdate(callback: (metrics: any) => void): void {
    this.on('metricsUpdate', callback);
  }

  // Utility methods
  getVersionInfo() {
    const metadata = this.getMetadata();
    return {
      pluginVersion: metadata.version,
      apiVersion: '1.0.0',
      brokerApiVersion: undefined,
      lastUpdated: new Date(),
      changelog: []
    };
  }

  exportConfig(): string {
    return JSON.stringify({
      config: this.config,
      metadata: this.getMetadata()
    }, null, 2);
  }

  importConfig(configString: string): boolean {
    try {
      const imported = JSON.parse(configString);
      if (imported.config) {
        this.updateConfig(imported.config);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async reset(): Promise<void> {
    await this.stop();
    
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      lastRequestTime: new Date(),
      startTime: new Date()
    };

    this.status.errorCount = 0;
    this.status.lastError = undefined;

    if (this.config.autoStart) {
      await this.start();
    }
  }

  // Protected helper methods
  protected recordRequest(responseTime: number): void {
    this.metrics.requestCount++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.lastRequestTime = new Date();
    this.emit('metricsUpdate', this.getMetrics());
  }

  protected recordError(error: Error): void {
    this.metrics.errorCount++;
    this.status.errorCount++;
    this.status.lastError = error;
    this.emit('error', error);
  }
}
