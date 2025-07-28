import express from 'express';
import { marketDataService } from '../services/marketDataService';
import { authenticateToken } from '../middleware/auth';
import { symbolDatabaseService } from '../services/symbolDatabaseService';

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

/**
 * Search for symbols (for autocomplete) - LEGACY ENDPOINT
 * Use /search-unified for new unified search with F&O support
 */
router.get('/search/:query', authenticateToken, async (req: any, res: any) => {
  try {
    const { query } = req.params;
    const { limit = 10, exchange = 'NSE', includePrices = 'false' } = req.query;
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

    console.log(`🔍 Symbol search request: query="${query}", limit=${limit}, exchange=${exchange}, userId=${userId}`);

    // Use NSE official symbol database for search (broker-independent)
    let searchResults: any[] = [];

    try {
      console.log(`🔍 Searching symbols for query: "${query}" on ${exchange}`);

      // Search using symbol database service with exchange filter
      const exchangeFilter = exchange === 'NSE' ? 'NSE' : exchange === 'BSE' ? 'BSE' : 'ALL';
      const unifiedResults = await symbolDatabaseService.searchSymbols(query, parseInt(limit as string), exchangeFilter);

      searchResults = unifiedResults.map((result: any) => ({
        symbol: result.tradingSymbol,  // Use trading symbol for order placement
        displaySymbol: result.symbol,  // Original symbol for display
        name: result.name,
        exchange: result.exchange,
        instrument_type: result.instrument_type,
        isin: result.isin,
        series: result.series,
        group: result.group,
        source: `${result.exchange.toLowerCase()}_official`
      }));

      console.log(`📊 Search results: ${searchResults.length} symbols found across ${exchangeFilter}`);

    } catch (error: any) {
      console.error('❌ NSE symbol search failed:', error.message);
      searchResults = [];
    }

    // Fetch live prices for search results (only if requested)
    const symbols = searchResults.map((r: any) => r.symbol);
    let prices = new Map();

    if (includePrices === 'true' && symbols.length > 0) {
      try {
        console.log(`💰 Fetching prices for ${symbols.length} symbols...`);
        prices = await marketDataService.getPrices(symbols, exchange as string);
        console.log(`💰 Fetched prices for ${prices.size} symbols`);
      } catch (error) {
        console.warn('⚠️ Failed to fetch live prices, continuing without prices');
      }
    } else {
      console.log(`⚡ Skipping price fetch for faster search response`);
    }

    const enrichedResults = searchResults.map((stock: any) => ({
      ...stock,
      price: prices.get(stock.symbol)?.price || null,
      change: prices.get(stock.symbol)?.change || null,
      changePercent: prices.get(stock.symbol)?.changePercent || null
    }));

    // Determine actual source based on what happened
    const source = 'live_broker_api';

    return res.json({
      success: true,
      data: {
        results: enrichedResults,
        count: enrichedResults.length,
        query,
        source: source,
        exchange: exchange
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to search symbols:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search symbols',
      details: error.message
    });
  }
});

/**
 * NEW: Unified search for all instruments (equity + F&O)
 */
router.get('/search-unified/:query', authenticateToken, async (req: any, res: any) => {
  try {
    const { query } = req.params;
    const { limit = 20, type = 'all', includePrices = 'false' } = req.query;
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

    console.log(`🔍 Unified search request: query="${query}", limit=${limit}, type=${type}, userId=${userId}`);

    let searchResults: any;

    if (type === 'all') {
      // Search all instrument types
      searchResults = await symbolDatabaseService.searchAllInstruments(query, parseInt(limit as string));
    } else if (type === 'equity') {
      // Search equity only
      const equity = await symbolDatabaseService.searchEquityInstruments(query, parseInt(limit as string));
      searchResults = { equity, options: [], futures: [], total: equity.length };
    } else if (type === 'options') {
      // Search options only
      const options = await symbolDatabaseService.searchOptionsInstruments(query, parseInt(limit as string));
      searchResults = { equity: [], options, futures: [], total: options.length };
    } else if (type === 'futures') {
      // Search futures only
      const futures = await symbolDatabaseService.searchFuturesInstruments(query, parseInt(limit as string));
      searchResults = { equity: [], options: [], futures, total: futures.length };
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid type. Use: all, equity, options, or futures'
      });
    }

    // Optionally fetch prices for equity instruments
    if (includePrices === 'true' && searchResults.equity.length > 0) {
      try {
        const equitySymbols = searchResults.equity.map((r: any) => r.tradingSymbol);
        console.log(`💰 Fetching prices for ${equitySymbols.length} equity symbols...`);
        const prices = await marketDataService.getPrices(equitySymbols, 'NSE');
        
        // Enrich equity results with prices
        searchResults.equity = searchResults.equity.map((stock: any) => ({
          ...stock,
          price: prices.get(stock.tradingSymbol)?.price || null,
          change: prices.get(stock.tradingSymbol)?.change || null,
          changePercent: prices.get(stock.tradingSymbol)?.changePercent || null
        }));
        
        console.log(`💰 Fetched prices for ${prices.size} equity symbols`);
      } catch (error) {
        console.warn('⚠️ Failed to fetch live prices, continuing without prices');
      }
    }

    console.log(`✅ Unified search completed: ${searchResults.total} total results`);

    return res.json({
      success: true,
      data: {
        ...searchResults,
        query,
        type,
        source: 'unified_search'
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to perform unified search:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to perform unified search',
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
 * Force update NSE CSV data
 */
router.post('/force-update-csv', authenticateToken, async (req: any, res: any) => {
  try {
    console.log('🔄 Manual NSE CSV update triggered');
    await symbolDatabaseService.forceUpdate();

    return res.json({
      success: true,
      message: 'NSE CSV data updated successfully'
    });
  } catch (error: any) {
    console.error('❌ Failed to update NSE CSV:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update NSE CSV data',
      details: error.message
    });
  }
});

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
 * Get option chain for an underlying symbol
 */
router.get('/option-chain/:underlying', authenticateToken, async (req: any, res: any) => {
  try {
    const { underlying } = req.params;
    const { expiry } = req.query;

    console.log(`📊 Fetching option chain for ${underlying}${expiry ? ` (expiry: ${expiry})` : ''}`);

    const optionChain = await symbolDatabaseService.getOptionChain(underlying, expiry as string);

    return res.json({
      success: true,
      data: {
        underlying: underlying.toUpperCase(),
        expiry: expiry || 'all',
        options: optionChain,
        count: optionChain.length
      }
    });
  } catch (error: any) {
    console.error(`❌ Failed to fetch option chain for ${req.params.underlying}:`, error);
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

/**
 * Search instruments by type (for unified trading interface)
 */
router.get('/search-instruments', authenticateToken, async (req: any, res: any) => {
  try {
    const { query, instrumentType, limit = 10 } = req.query;
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

    if (!instrumentType || !['EQUITY', 'OPTION', 'FUTURE'].includes(instrumentType)) {
      return res.status(400).json({
        success: false,
        error: 'Valid instrumentType required: EQUITY, OPTION, or FUTURE'
      });
    }

    console.log(`🔍 Instrument search: query="${query}", type=${instrumentType}, limit=${limit}, userId=${userId}`);

    let searchResults: any[] = [];

    if (instrumentType === 'EQUITY') {
      searchResults = await symbolDatabaseService.searchEquityInstruments(query, parseInt(limit as string));
    } else if (instrumentType === 'OPTION') {
      searchResults = await symbolDatabaseService.searchOptionsInstruments(query, parseInt(limit as string));
    } else if (instrumentType === 'FUTURE') {
      searchResults = await symbolDatabaseService.searchFuturesInstruments(query, parseInt(limit as string));
    }

    // Transform results to match frontend interface
    const transformedResults = searchResults.map((result: any) => ({
      symbol: result.tradingSymbol || result.symbol,
      name: result.name || result.symbol,
      exchange: result.exchange,
      token: result.token || null,
      instrumentType: instrumentType,
      optionType: result.optionType,
      strikePrice: result.strikePrice,
      expiryDate: result.expiryDate
    }));

    console.log(`✅ Found ${transformedResults.length} ${instrumentType} instruments for "${query}"`);

    return res.json({
      success: true,
      data: transformedResults
    });
  } catch (error: any) {
    console.error('❌ Failed to search instruments:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to search instruments',
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
