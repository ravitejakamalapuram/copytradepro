/**
 * Unified Broker Factory
 * Creates instances of the new unified broker services
 * Eliminates the need for broker-specific logic in the unified manager
 */

import { IUnifiedBrokerService, IBrokerModuleFactory } from '../interfaces/UnifiedBrokerResponse';
import { UnifiedShoonyaService } from '../brokers/shoonya/UnifiedShoonyaService';
import { UnifiedFyersService } from '../brokers/fyers/UnifiedFyersService';

export class UnifiedBrokerFactory implements IBrokerModuleFactory {
  private static instance: UnifiedBrokerFactory;
  private supportedBrokers: Map<string, () => IUnifiedBrokerService>;

  private constructor() {
    this.supportedBrokers = new Map();
    this.registerDefaultBrokers();
  }

  static getInstance(): UnifiedBrokerFactory {
    if (!UnifiedBrokerFactory.instance) {
      UnifiedBrokerFactory.instance = new UnifiedBrokerFactory();
    }
    return UnifiedBrokerFactory.instance;
  }

  /**
   * Register default broker implementations
   */
  private registerDefaultBrokers(): void {
    this.supportedBrokers.set('shoonya', () => new UnifiedShoonyaService());
    this.supportedBrokers.set('fyers', () => new UnifiedFyersService());
    
    console.log('✅ Unified broker factory initialized with default brokers:', Array.from(this.supportedBrokers.keys()));
  }

  /**
   * Create a unified broker service instance
   */
  createBroker(brokerName: string): IUnifiedBrokerService {
    const brokerFactory = this.supportedBrokers.get(brokerName.toLowerCase());
    
    if (!brokerFactory) {
      throw new Error(`Unsupported broker: ${brokerName}. Supported brokers: ${this.getSupportedBrokers().join(', ')}`);
    }

    console.log(`🏭 Creating unified ${brokerName} broker instance`);
    return brokerFactory();
  }

  /**
   * Get list of supported brokers
   */
  getSupportedBrokers(): string[] {
    return Array.from(this.supportedBrokers.keys());
  }

  /**
   * Check if a broker is supported
   */
  isBrokerSupported(brokerName: string): boolean {
    return this.supportedBrokers.has(brokerName.toLowerCase());
  }

  /**
   * Register a custom broker implementation
   */
  registerBroker(brokerName: string, brokerFactory: () => IUnifiedBrokerService): void {
    this.supportedBrokers.set(brokerName.toLowerCase(), brokerFactory);
    console.log(`✅ Registered custom broker: ${brokerName}`);
  }

  /**
   * Unregister a broker
   */
  unregisterBroker(brokerName: string): boolean {
    const removed = this.supportedBrokers.delete(brokerName.toLowerCase());
    if (removed) {
      console.log(`✅ Unregistered broker: ${brokerName}`);
    }
    return removed;
  }

  /**
   * Get factory information
   */
  getFactoryInfo(): {
    totalBrokers: number;
    supportedBrokers: string[];
    factoryType: string;
  } {
    return {
      totalBrokers: this.supportedBrokers.size,
      supportedBrokers: this.getSupportedBrokers(),
      factoryType: 'UnifiedBrokerFactory'
    };
  }
}

/**
 * Convenience function to create a unified broker instance
 */
export function createUnifiedBroker(brokerName: string): IUnifiedBrokerService {
  const factory = UnifiedBrokerFactory.getInstance();
  return factory.createBroker(brokerName);
}

/**
 * Convenience function to get supported brokers
 */
export function getSupportedUnifiedBrokers(): string[] {
  const factory = UnifiedBrokerFactory.getInstance();
  return factory.getSupportedBrokers();
}
