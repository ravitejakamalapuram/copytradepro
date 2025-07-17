/**
 * Broker Factory Implementation
 * Creates broker service instances using dynamic plugin registry
 * No hardcoded broker references - fully pluggable architecture
 */

import { IBrokerService, IBrokerFactory } from '../interfaces/IBrokerService';
import { BrokerRegistry, brokerRegistry } from '../registry/BrokerRegistry';

export class BrokerFactory implements IBrokerFactory {
  private static instance: BrokerFactory;
  private registry: BrokerRegistry;

  private constructor() {
    this.registry = brokerRegistry;
  }

  public static getInstance(): BrokerFactory {
    if (!BrokerFactory.instance) {
      BrokerFactory.instance = new BrokerFactory();
    }
    return BrokerFactory.instance;
  }

  /**
   * Create a broker service instance
   * @param brokerName - Name of the broker (e.g., 'shoonya', 'fyers')
   * @returns IBrokerService instance
   * @throws Error if broker is not supported
   */
  createBroker(brokerName: string): IBrokerService {
    return this.registry.createBroker(brokerName);
  }

  /**
   * Get list of all supported brokers
   * @returns Array of supported broker names
   */
  getSupportedBrokers(): string[] {
    return this.registry.getAvailableBrokers();
  }

  /**
   * Check if a broker is supported
   * @param brokerName - Name of the broker to check
   * @returns true if broker is supported, false otherwise
   */
  isBrokerSupported(brokerName: string): boolean {
    return this.registry.isBrokerAvailable(brokerName);
  }

  /**
   * Register a new broker dynamically
   * @param brokerName - Name of the broker
   * @param brokerCreator - Function that creates the broker service instance
   */
  registerBroker(brokerName: string, brokerCreator: () => IBrokerService): void {
    this.registry.registerPlugin({
      name: brokerName,
      version: '1.0.0',
      createInstance: brokerCreator
    });
  }

  /**
   * Unregister a broker
   * @param brokerName - Name of the broker to unregister
   */
  unregisterBroker(brokerName: string): void {
    this.registry.unregisterPlugin(brokerName);
  }

  /**
   * Get the underlying registry instance
   * @returns BrokerRegistry instance
   */
  getRegistry(): BrokerRegistry {
    return this.registry;
  }
}

// Export singleton instance for convenience
export const brokerFactory = BrokerFactory.getInstance();
