import express from 'express';
import { marketDataService } from '../services/marketDataService';
import { authenticateToken } from '../middleware/auth';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Get real-time price for a single symbol
 */
router.get('/price/:symbol', authenticateToken, async (req: any, res: any) => {
  try {
    const { symbol } = req.params;
    const { exchange = 'NSE' } = req.query;

    console.log(`📈 Fetching live price for ${symbol} on ${exchange}...`);
    
    const price = await marketDataService.getPrice(symbol, exchange as string);
    
    if (!price) {
      return res.status(404).json({
        success: false,
        error: `Price not found for symbol: ${symbol}`
      });
    }

    console.log(`✅ Live price for ${symbol}: ₹${price.price} (${price.changePercent >= 0 ? '+' : ''}${price.changePercent.toFixed(2)}%)`);

    return res.json({
      success: true,
      data: price
    });
  } catch (error: any) {
    console.error(`❌ Failed to fetch price for ${req.params.symbol}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch market price',
      details: error.message
    });
  }
});

/**
 * Get real-time prices for multiple symbols
 */
router.post('/prices', authenticateToken, async (req: any, res: any) => {
  try {
    const { symbols, exchange = 'NSE' } = req.body;

    if (!symbols || !Array.isArray(symbols)) {
      return res.status(400).json({
        success: false,
        error: 'Symbols array is required'
      });
    }

    console.log(`📈 Fetching live prices for ${symbols.length} symbols...`);
    
    const prices = await marketDataService.getPrices(symbols, exchange);
    
    // Convert Map to object for JSON response
    const pricesObject: Record<string, any> = {};
    prices.forEach((price, symbol) => {
      pricesObject[symbol] = price;
    });

    console.log(`✅ Fetched live prices for ${prices.size}/${symbols.length} symbols`);

    return res.json({
      success: true,
      data: {
        prices: pricesObject,
        count: prices.size,
        requested: symbols.length
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to fetch batch prices:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch market prices',
      details: error.message
    });
  }
});

/**
 * Get major Indian market indices - DISABLED
 * Disabled due to NSE API reliability issues causing timeouts
 */
router.get('/indices', authenticateToken, async (req: any, res: any) => {
  console.log('📊 Market indices endpoint disabled due to API reliability issues');
  
  return res.json({
    success: true,
    data: {
      indices: [],
      count: 0,
      lastUpdated: new Date(),
      message: 'Market indices functionality temporarily disabled due to API reliability issues'
    }
  });
});

// Legacy search endpoint removed - use /search-unified instead

/**
 * Unified search for all instruments using new unified service
 */
router.get('/search-unified/:query', authenticateToken, async (req: any, res: any) => {
  try {
    const { unifiedInstrumentService } = require('../services/unifiedInstrumentService');
    const { formatSearchResults, createSearchErrorResponse } = require('../utils/searchHelpers');
    
    const { query } = req.params;
    const { limit = 20, type = 'all', includePrices = 'false', fuzzy = 'true' } = req.query;
    const userId = req.user?.id;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    logger.info('Unified search request', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'SEARCH_UNIFIED',
      query: query.substring(0, 50),
      type,
      limit: parseInt(limit as string),
      fuzzy: fuzzy === 'true',
      userId
    });

    const startTime = Date.now();
    let searchResults: any;
    const enableFuzzy = fuzzy === 'true';
    const searchLimit = parseInt(limit as string);

    if (type === 'all') {
      // Search all instrument types with categorized results
      searchResults = await unifiedInstrumentService.searchAllCategorized(query, searchLimit, enableFuzzy);
    } else if (type === 'equity') {
      // Search equity only
      const equity = await unifiedInstrumentService.searchEquity(query, searchLimit, enableFuzzy);
      searchResults = { equity, options: [], futures: [], total: equity.length, searchTime: Date.now() - startTime };
    } else if (type === 'options') {
      // Search options only
      const options = await unifiedInstrumentService.searchOptions(query, searchLimit, enableFuzzy);
      searchResults = { equity: [], options, futures: [], total: options.length, searchTime: Date.now() - startTime };
    } else if (type === 'futures') {
      // Search futures only
      const futures = await unifiedInstrumentService.searchFutures(query, searchLimit, enableFuzzy);
      searchResults = { equity: [], options: [], futures, total: futures.length, searchTime: Date.now() - startTime };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Use: all, equity, options, or futures'
      });
    }

    // Optionally fetch prices for equity instruments
    if (includePrices === 'true' && searchResults.equity && searchResults.equity.length > 0) {
      try {
        const equitySymbols = searchResults.equity.map((r: any) => r.tradingSymbol);
        logger.info('Fetching prices for equity symbols', {
          component: 'MARKET_DATA_ROUTE',
          operation: 'FETCH_PRICES',
          symbolCount: equitySymbols.length
        });
        
        const prices = await marketDataService.getPrices(equitySymbols, 'NSE');
        
        // Enrich equity results with prices
        searchResults.equity = searchResults.equity.map((stock: any) => ({
          ...stock,
          price: prices.get(stock.tradingSymbol)?.price || null,
          change: prices.get(stock.tradingSymbol)?.change || null,
          changePercent: prices.get(stock.tradingSymbol)?.changePercent || null
        }));
        
        logger.info('Prices fetched successfully', {
          component: 'MARKET_DATA_ROUTE',
          operation: 'FETCH_PRICES_SUCCESS',
          priceCount: prices.size
        });
      } catch (error) {
        logger.warn('Failed to fetch live prices, continuing without prices', {
          component: 'MARKET_DATA_ROUTE',
          operation: 'FETCH_PRICES_WARNING'
        }, error);
      }
    }

    const searchTime = searchResults.searchTime || (Date.now() - startTime);
    
    logger.info('Unified search completed', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'SEARCH_UNIFIED_SUCCESS',
      totalResults: searchResults.total,
      searchTime,
      fuzzyEnabled: enableFuzzy
    });

    return res.json({
      success: true,
      data: {
        ...searchResults,
        query,
        type,
        fuzzyEnabled: enableFuzzy,
        source: 'unified_instrument_service'
      },
      meta: {
        searchTime,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    const searchTime = Date.now() - (req.startTime || Date.now());
    logger.error('Unified search failed', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'SEARCH_UNIFIED_ERROR'
    }, error);

    const { createSearchErrorResponse } = require('../utils/searchHelpers');
    const errorResponse = createSearchErrorResponse(error, searchTime);
    return res.status(500).json({
      ...errorResponse,
      details: error.message
    });
  }
});

/**
 * Check symbol database status (for debugging)
 */
router.get('/symbol-status', authenticateToken, async (req: any, res: any) => {
  try {
    const status = symbolDatabaseService.getStats();

    console.log('📊 Symbol database status check:', status);

    return res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('❌ Failed to check symbol database status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to check symbol database status',
      details: error.message
    });
  }
});

/**
 * Get cache statistics
 */
router.get('/cache/stats', authenticateToken, async (req: any, res: any) => {
  try {
    const { symbolCacheService } = await import('../services/symbolCacheService');
    const stats = symbolCacheService.getStats();
    const memoryUsage = symbolCacheService.getMemoryUsage();

    return res.json({
      success: true,
      data: {
        ...stats,
        memoryUsage
      }
    });
  } catch (error: any) {
    console.error('🚨 Cache stats failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      details: error.message
    });
  }
});

/**
 * Warm cache manually
 */
router.post('/cache/warm', authenticateToken, async (req: any, res: any) => {
  try {
    const { symbolCacheService } = await import('../services/symbolCacheService');
    
    // Start cache warming in background
    symbolCacheService.warmCache(symbolDatabaseService).catch(error => {
      console.error('🚨 Background cache warming failed:', error);
    });

    return res.json({
      success: true,
      message: 'Cache warming started in background'
    });
  } catch (error: any) {
    console.error('🚨 Cache warm failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to start cache warming',
      details: error.message
    });
  }
});

/**
 * Clear cache
 */
router.post('/cache/clear', authenticateToken, async (req: any, res: any) => {
  try {
    const { symbolCacheService } = await import('../services/symbolCacheService');
    const { type } = req.body;

    if (type === 'search') {
      symbolCacheService.clearSearchCache();
    } else if (type === 'all') {
      symbolCacheService.invalidateAll();
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid cache type. Use "search" or "all"'
      });
    }

    return res.json({
      success: true,
      message: `Cache ${type === 'all' ? 'completely' : type} cleared`
    });
  } catch (error: any) {
    console.error('🚨 Cache clear failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

/**
 * Get database performance statistics
 */
router.get('/database/stats', authenticateToken, async (req: any, res: any) => {
  try {
    const { databaseOptimizationService } = await import('../services/databaseOptimizationService');
    const stats = await databaseOptimizationService.getPerformanceStats();

    return res.json({
      success: true,
      data: {
        ...stats,
        uptime: databaseOptimizationService.getUptime()
      }
    });
  } catch (error: any) {
    console.error('🚨 Database stats failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get database statistics',
      details: error.message
    });
  }
});

/**
 * Optimize database performance
 */
router.post('/database/optimize', authenticateToken, async (req: any, res: any) => {
  try {
    const { databaseOptimizationService } = await import('../services/databaseOptimizationService');
    const result = await databaseOptimizationService.optimizeDatabase();

    return res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('🚨 Database optimization failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to optimize database',
      details: error.message
    });
  }
});

/**
 * Clear database metrics
 */
router.post('/database/clear-metrics', authenticateToken, async (req: any, res: any) => {
  try {
    const { databaseOptimizationService } = await import('../services/databaseOptimizationService');
    databaseOptimizationService.clearMetrics();

    return res.json({
      success: true,
      message: 'Database metrics cleared'
    });
  } catch (error: any) {
    console.error('🚨 Clear database metrics failed:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear database metrics',
      details: error.message
    });
  }
});

/**
 * Get NSE market status - DISABLED
 * Disabled due to NSE API reliability issues causing timeouts
 */
router.get('/market-status', authenticateToken, async (req: any, res: any) => {
  console.log('📊 Market status endpoint disabled due to API reliability issues');
  
  return res.json({
    success: true,
    data: {
      status: 'Unknown',
      isOpen: false,
      message: 'Market status functionality temporarily disabled due to API reliability issues'
    }
  });
});



/**
 * Force update F&O instruments from Upstox
 */
router.post('/force-update-fo', authenticateToken, async (req: any, res: any) => {
  try {
    console.log('🔄 Manual F&O instruments update triggered');
    const { optionsDataService } = await import('../services/optionsDataService');
    await optionsDataService.refreshInstruments();

    return res.json({
      success: true,
      message: 'F&O instruments updated successfully from Upstox'
    });
  } catch (error: any) {
    console.error('❌ Failed to update F&O instruments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update F&O instruments',
      details: error.message
    });
  }
});

// Legacy debug endpoint removed - using unified database instead

/**
 * Get NSE gainers - DISABLED
 * Disabled due to NSE API reliability issues causing timeouts
 */
router.get('/gainers', authenticateToken, async (req: any, res: any) => {
  console.log('📊 Gainers endpoint disabled due to API reliability issues');
  
  return res.json({
    success: true,
    data: [],
    message: 'Gainers functionality temporarily disabled due to API reliability issues'
  });
});

/**
 * Get NSE losers - DISABLED
 * Disabled due to NSE API reliability issues causing timeouts
 */
router.get('/losers', authenticateToken, async (req: any, res: any) => {
  console.log('📊 Losers endpoint disabled due to API reliability issues');
  
  return res.json({
    success: true,
    data: [],
    message: 'Losers functionality temporarily disabled due to API reliability issues'
  });
});

/**
 * Get 52-week high stocks - DISABLED
 * Disabled due to NSE API reliability issues causing timeouts
 */
router.get('/52-week-high', authenticateToken, async (req: any, res: any) => {
  console.log('📊 52-week high endpoint disabled due to API reliability issues');
  
  return res.json({
    success: true,
    data: [],
    message: '52-week high functionality temporarily disabled due to API reliability issues'
  });
});

/**
 * Get 52-week low stocks - DISABLED
 * Disabled due to NSE API reliability issues causing timeouts
 */
router.get('/52-week-low', authenticateToken, async (req: any, res: any) => {
  console.log('📊 52-week low endpoint disabled due to API reliability issues');
  
  return res.json({
    success: true,
    data: [],
    message: '52-week low functionality temporarily disabled due to API reliability issues'
  });
});

/**
 * Get top value stocks - DISABLED
 * Disabled due to NSE API reliability issues causing timeouts
 */
router.get('/top-value', authenticateToken, async (req: any, res: any) => {
  console.log('📊 Top value stocks endpoint disabled due to API reliability issues');
  
  return res.json({
    success: true,
    data: [],
    message: 'Top value stocks functionality temporarily disabled due to API reliability issues'
  });
});

/**
 * Get top volume stocks - DISABLED
 * Disabled due to NSE API reliability issues causing timeouts
 */
router.get('/top-volume', authenticateToken, async (req: any, res: any) => {
  console.log('📊 Top volume stocks endpoint disabled due to API reliability issues');
  
  return res.json({
    success: true,
    data: [],
    message: 'Top volume stocks functionality temporarily disabled due to API reliability issues'
  });
});

/**
 * Get cache statistics (for debugging)
 */
router.get('/cache/stats', authenticateToken, async (req: any, res: any) => {
  try {
    const stats = marketDataService.getCacheStats();
    
    return res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('❌ Failed to get cache stats:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      details: error.message
    });
  }
});

/**
 * Clear market data cache (for debugging)
 */
router.post('/cache/clear', authenticateToken, async (req: any, res: any) => {
  try {
    marketDataService.clearCache();
    
    return res.json({
      success: true,
      message: 'Market data cache cleared'
    });
  } catch (error: any) {
    console.error('❌ Failed to clear cache:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      details: error.message
    });
  }
});

/**
 * Get option chain for an underlying symbol using unified service
 */
router.get('/option-chain/:underlying', authenticateToken, async (req: any, res: any) => {
  try {
    const { unifiedInstrumentService } = require('../services/unifiedInstrumentService');
    const { underlying } = req.params;
    const { expiry } = req.query;

    logger.info('Option chain request', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'GET_OPTION_CHAIN',
      underlying,
      expiry
    });

    const optionChain = await unifiedInstrumentService.getOptionChain(underlying, expiry as string);

    logger.info('Option chain retrieved', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'GET_OPTION_CHAIN_SUCCESS',
      underlying,
      callsCount: optionChain.calls.length,
      putsCount: optionChain.puts.length,
      expiriesCount: optionChain.expiries.length
    });

    return res.json({
      success: true,
      data: {
        underlying: underlying.toUpperCase(),
        expiry: expiry || 'all',
        calls: optionChain.calls,
        puts: optionChain.puts,
        expiries: optionChain.expiries,
        totalOptions: optionChain.calls.length + optionChain.puts.length
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    logger.error('Failed to get option chain', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'GET_OPTION_CHAIN_ERROR',
      underlying: req.params.underlying
    }, error);

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch option chain',
      details: error.message
    });
  }
});

/**
 * Get expiry dates for an underlying symbol
 */
router.get('/expiry-dates/:underlying', authenticateToken, async (req: any, res: any) => {
  try {
    const { underlying } = req.params;

    console.log(`📅 Fetching expiry dates for ${underlying}`);

    const expiryDates = await symbolDatabaseService.getExpiryDates(underlying);

    return res.json({
      success: true,
      data: {
        underlying: underlying.toUpperCase(),
        expiry_dates: expiryDates,
        count: expiryDates.length
      }
    });
  } catch (error: any) {
    console.error(`❌ Failed to fetch expiry dates for ${req.params.underlying}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch expiry dates',
      details: error.message
    });
  }
});

// Search instruments endpoint removed - use /search-unified instead

/**
 * General search endpoint with unified service
 */
router.get('/search', authenticateToken, async (req: any, res: any) => {
  try {
    const { parseSearchQuery, validateSearchQuery, formatSearchResults, createSearchErrorResponse } = require('../utils/searchHelpers');
    const { unifiedInstrumentService } = require('../services/unifiedInstrumentService');

    const searchQuery = parseSearchQuery(req.query);
    const validation = validateSearchQuery(searchQuery);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid search parameters',
        details: validation.errors,
        data: []
      });
    }

    logger.info('General search request', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'GENERAL_SEARCH',
      hasQuery: !!searchQuery.text,
      instrumentType: searchQuery.instrumentType,
      limit: searchQuery.limit
    });

    const result = await unifiedInstrumentService.searchInstruments(searchQuery);
    const response = formatSearchResults(result.instruments, result.total, result.searchTime);

    logger.info('General search completed', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'GENERAL_SEARCH_SUCCESS',
      resultCount: result.instruments.length,
      searchTime: result.searchTime
    });

    return res.json(response);

  } catch (error: any) {
    const searchTime = Date.now() - (req.startTime || Date.now());
    logger.error('General search failed', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'GENERAL_SEARCH_ERROR'
    }, error);

    const { createSearchErrorResponse } = require('../utils/searchHelpers');
    const errorResponse = createSearchErrorResponse(error, searchTime);
    return res.status(500).json(errorResponse);
  }
});

// Legacy migration endpoint removed - using direct data import instead

/**
 * Get database statistics
 */
router.get('/database-stats', authenticateToken, async (req: any, res: any) => {
  try {
    const { unifiedInstrumentService } = require('../services/unifiedInstrumentService');

    const stats = await unifiedInstrumentService.getDatabaseStats();

    return res.json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Failed to get database stats', {
      component: 'MARKET_DATA_ROUTE',
      operation: 'GET_DATABASE_STATS_ERROR'
    }, error);

    return res.status(500).json({
      success: false,
      error: 'Failed to get database statistics',
      details: error.message
    });
  }
});

/**
 * Get instruments by type (for unified trading interface)
 */
router.get('/instruments', authenticateToken, async (req: any, res: any) => {
  try {
    const { instrumentType, limit = 50 } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!instrumentType || !['EQUITY', 'OPTION', 'FUTURE'].includes(instrumentType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid instrumentType required: EQUITY, OPTION, or FUTURE'
      });
    }

    console.log(`📊 Getting ${instrumentType} instruments, limit=${limit}, userId=${userId}`);

    let instruments: any[] = [];

    if (instrumentType === 'EQUITY') {
      instruments = await symbolDatabaseService.getEquityInstruments(parseInt(limit as string));
    } else if (instrumentType === 'OPTION') {
      instruments = await symbolDatabaseService.getOptionsInstruments(parseInt(limit as string));
    } else if (instrumentType === 'FUTURE') {
      instruments = await symbolDatabaseService.getFuturesInstruments(parseInt(limit as string));
    }

    // Transform results to match frontend interface
    const transformedResults = instruments.map((result: any) => ({
      symbol: result.tradingSymbol || result.symbol,
      name: result.name || result.symbol,
      exchange: result.exchange,
      token: result.token || null,
      instrumentType: instrumentType,
      optionType: result.optionType,
      strikePrice: result.strikePrice,
      expiryDate: result.expiryDate
    }));

    console.log(`✅ Retrieved ${transformedResults.length} ${instrumentType} instruments`);

    return res.json({
      success: true,
      data: transformedResults
    });
  } catch (error: any) {
    console.error('❌ Failed to get instruments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get instruments',
      details: error.message
    });
  }
});

export default router;
