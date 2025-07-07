/**
 * Shoonya Broker Plugin
 * Plugin implementation for Finvasia Shoonya broker
 */

import {
  PluginMetadata,
  IBrokerAdapter,
  BrokerType,
  Exchange,
  ProductType,
  OrderType,
  IBrokerPluginFactory,
  IBrokerPlugin,
  PluginConfig,
  PluginStatus
} from './types';
import { BaseBrokerPlugin } from './BaseBrokerPlugin';
import { ShoonyaAdapter } from './ShoonyaAdapter';

export class ShoonyaPlugin extends BaseBrokerPlugin {
  
  getMetadata(): PluginMetadata {
    return {
      name: '@copytradepro/broker-shoonya',
      version: '1.0.0',
      description: 'Finvasia Shoonya broker integration plugin for Unified Trading API',
      author: 'CopyTradePro',
      license: 'Commercial',
      homepage: 'https://copytradepro.com/plugins/shoonya',
      repository: 'https://github.com/ravitejakamalapuram/copytradepro',
      keywords: ['trading', 'broker', 'shoonya', 'finvasia', 'india'],
      brokerType: BrokerType.SHOONYA,
      supportedFeatures: {
        authentication: ['TOTP', 'API_KEY'],
        orderTypes: [
          OrderType.MARKET,
          OrderType.LIMIT,
          OrderType.STOP_LOSS,
          OrderType.STOP_LOSS_MARKET
        ],
        exchanges: [
          Exchange.NSE,
          Exchange.BSE,
          Exchange.NFO,
          Exchange.BFO
        ],
        products: [
          ProductType.DELIVERY,
          ProductType.INTRADAY,
          ProductType.MARGIN,
          ProductType.COVER_ORDER,
          ProductType.BRACKET_ORDER
        ],
        realTimeData: true,
        historicalData: true,
        optionsTrading: true,
        commoditiesTrading: false
      },
      dependencies: {
        'axios': '^1.6.0',
        'speakeasy': '^2.0.0',
        'ws': '^8.14.0'
      },
      peerDependencies: {
        '@copytradepro/unified-trading-api': '^1.0.0'
      }
    };
  }

  createAdapter(): IBrokerAdapter {
    return new ShoonyaAdapter();
  }

  getCapabilities() {
    const metadata = this.getMetadata();
    return {
      // Base capabilities from metadata
      authentication: metadata.supportedFeatures.authentication,
      orderTypes: metadata.supportedFeatures.orderTypes,
      exchanges: metadata.supportedFeatures.exchanges,
      products: metadata.supportedFeatures.products,
      realTimeData: metadata.supportedFeatures.realTimeData,
      historicalData: metadata.supportedFeatures.historicalData,
      optionsTrading: metadata.supportedFeatures.optionsTrading,
      commoditiesTrading: metadata.supportedFeatures.commoditiesTrading,

      // Standard capabilities
      maxConcurrentConnections: 5,
      maxOrdersPerSecond: 10,
      supportedOrderTypes: [
        'MARKET',
        'LIMIT',
        'STOP_LOSS',
        'STOP_LOSS_MARKET'
      ],
      supportedExchanges: [
        'NSE',
        'BSE',
        'NFO',
        'BFO'
      ],
      requiresApiKey: true,
      requiresOAuth: false,
      supportsWebSocket: true,
      supportsHistoricalData: true,

      // Shoonya-specific capabilities
      supportsTotp: true,
      supportsOptionsTrading: true,
      supportsFuturesTrading: true,
      supportsIntradayTrading: true,
      supportsDeliveryTrading: true,
      supportsMarginTrading: true,
      supportsCoverOrders: true,
      supportsBracketOrders: true,

      // Trading limits
      maxOrderValue: 10000000, // 1 Crore
      maxPositions: 1000,
      maxOrdersPerDay: 10000,

      // Market data capabilities
      supportsLevel1Data: true,
      supportsLevel2Data: true,
      supportsTickByTick: true,
      supportsHistoricalCandles: true,

      // Account features
      supportsMultipleAccounts: false,
      supportsPortfolioTracking: true,
      supportsMarginCalculation: true,
      supportsRiskManagement: true
    };
  }

  validateDependencies(): {
    isValid: boolean;
    missing: string[];
    incompatible: string[];
  } {
    const missing: string[] = [];
    const incompatible: string[] = [];

    try {
      // Check for required dependencies
      require('axios');
    } catch {
      missing.push('axios');
    }

    try {
      require('speakeasy');
    } catch {
      missing.push('speakeasy');
    }

    try {
      require('ws');
    } catch {
      missing.push('ws');
    }

    // Check for peer dependencies
    try {
      const unifiedApi = require('@copytradepro/unified-trading-api');
      // Could add version compatibility checks here
    } catch {
      missing.push('@copytradepro/unified-trading-api');
    }

    return {
      isValid: missing.length === 0 && incompatible.length === 0,
      missing,
      incompatible
    };
  }

  async performHealthCheck(): Promise<boolean> {
    try {
      // Call parent health check first
      const baseHealthy = await super.performHealthCheck();
      if (!baseHealthy) {
        return false;
      }

      // Shoonya-specific health checks
      const adapter = this.getAdapter();
      
      // Check if adapter is authenticated
      if (!adapter.isAuthenticated()) {
        return false;
      }

      // Try to get user profile as a connectivity test
      try {
        const profileResult = await adapter.getUserProfile();
        return profileResult.success;
      } catch {
        return false;
      }

    } catch {
      return false;
    }
  }

  // Use base class getVersionInfo implementation
}

// Plugin factory for easy instantiation
export class ShoonyaPluginFactory implements IBrokerPluginFactory {
  createPlugin(config?: any): ShoonyaPlugin {
    return new ShoonyaPlugin(config);
  }

  getSupportedBrokers() {
    return [BrokerType.SHOONYA];
  }

  isCompatible(apiVersion: string): boolean {
    // Simple version compatibility check
    const [major] = apiVersion.split('.');
    return major === '1';
  }
}

// Default export
export default ShoonyaPlugin;
