/**
 * Factory and type definitions for broker service instantiation.
 * Add new brokers to the BrokerKey type and brokerClassMap.
 */
import { ShoonyaService } from '../integrations/shoonya';
import { FyersService } from '../integrations/fyers';
import { IBrokerService } from '../interfaces/IBrokerService';

/**
 * Supported broker keys for the factory.
 */
export type BrokerKey = 'shoonya' | 'fyers';

/**
 * Map of broker keys to their service classes.
 */
const brokerClassMap: Record<BrokerKey, any> = {
  shoonya: ShoonyaService,
  fyers: FyersService,
};

/**
 * Returns an instance of the requested broker service.
 * @param broker - The broker key (e.g., 'shoonya', 'fyers').
 * @param config - Optional broker-specific config.
 * @returns An instance of IBrokerService.
 */
export function getBrokerService(broker: BrokerKey, config?: any): IBrokerService {
  const ServiceClass = brokerClassMap[broker];
  if (!ServiceClass) throw new Error(`Unknown broker: ${broker}`);
  return new ServiceClass(config);
} 