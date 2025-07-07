/**
 * Fyers Broker Plugin
 * Plugin implementation for Fyers Securities broker
 */

import {
  PluginMetadata,
  IBrokerAdapter,
  BrokerType,
  Exchange,
  ProductType,
  OrderType,
  IBrokerPluginFactory
} from './types';
import { BaseBrokerPlugin } from './BaseBrokerPlugin';
import { FyersAdapter } from './FyersAdapter';

export class FyersPlugin extends BaseBrokerPlugin {
  
  getMetadata(): PluginMetadata {
    return {
      name: '@copytradepro/broker-fyers',
      version: '1.0.0',
      description: 'Fyers Securities broker integration plugin for Unified Trading API',
      author: 'CopyTradePro',
      license: 'Commercial',
      homepage: 'https://copytradepro.com/plugins/fyers',
      repository: 'https://github.com/ravitejakamalapuram/copytradepro',
      keywords: ['trading', 'broker', 'fyers', 'oauth', 'india'],
      brokerType: BrokerType.FYERS,
      supportedFeatures: {
        authentication: ['OAuth2', 'API_KEY'],
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
          Exchange.BFO,
          'MCX' as any
        ],
        products: [
          ProductType.DELIVERY,
          ProductType.INTRADAY,
          ProductType.MARGIN,
          ProductType.COVER_ORDER
        ],
        realTimeData: true,
        historicalData: true,
        optionsTrading: true,
        commoditiesTrading: true
      },
      dependencies: {
        'axios': '^1.6.0',
        'fyers-api-v3': '^3.0.0',
        'ws': '^8.14.0'
      },
      peerDependencies: {
        '@copytradepro/unified-trading-api': '^1.0.0'
      }
    };
  }

  createAdapter(): IBrokerAdapter {
    return new FyersAdapter();
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
      maxConcurrentConnections: 3,
      maxOrdersPerSecond: 5,
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
        'BFO',
        'MCX'
      ],
      requiresApiKey: true,
      requiresOAuth: true,
      supportsWebSocket: true,
      supportsHistoricalData: true,

      // Fyers-specific capabilities
      supportsOAuth2: true,
      supportsRefreshToken: true,
      supportsOptionsTrading: true,
      supportsFuturesTrading: true,
      supportsCommoditiesTrading: true,
      supportsIntradayTrading: true,
      supportsDeliveryTrading: true,
      supportsMarginTrading: true,
      supportsCoverOrders: true,

      // Trading limits
      maxOrderValue: 5000000, // 50 Lakh
      maxPositions: 500,
      maxOrdersPerDay: 5000,

      // Market data capabilities
      supportsLevel1Data: true,
      supportsLevel2Data: true,
      supportsTickByTick: true,
      supportsHistoricalCandles: true,

      // Account features
      supportsMultipleAccounts: false,
      supportsPortfolioTracking: true,
      supportsMarginCalculation: true,
      supportsRiskManagement: true,

      // OAuth specific
      authCodeExpiryMinutes: 10,
      accessTokenExpiryHours: 24,
      refreshTokenExpiryDays: 30
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
      require('fyers-api-v3');
    } catch {
      missing.push('fyers-api-v3');
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

      // Fyers-specific health checks
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
export class FyersPluginFactory implements IBrokerPluginFactory {
  createPlugin(config?: any): FyersPlugin {
    return new FyersPlugin(config);
  }

  getSupportedBrokers() {
    return [BrokerType.FYERS];
  }

  isCompatible(apiVersion: string): boolean {
    // Simple version compatibility check
    const [major] = apiVersion.split('.');
    return major === '1';
  }
}

// Default export
export default FyersPlugin;
