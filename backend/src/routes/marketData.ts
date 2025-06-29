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
 * Get major Indian market indices
 */
router.get('/indices', authenticateToken, async (req: any, res: any) => {
  try {
    console.log('📊 Fetching live market indices...');
    
    const indices = await marketDataService.getMarketIndices();
    
    console.log(`✅ Fetched ${indices.length} market indices`);

    return res.json({
      success: true,
      data: {
        indices,
        count: indices.length,
        lastUpdated: new Date()
      }
    });
  } catch (error: any) {
    console.error('❌ Failed to fetch market indices:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch market indices',
      details: error.message
    });
  }
});

/**
 * Search for symbols (for autocomplete) using live broker APIs
 */
router.get('/search/:query', authenticateToken, async (req: any, res: any) => {
  try {
    const { query } = req.params;
    const { limit = 10, exchange = 'NSE' } = req.query;
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
      console.log(`🔍 Searching NSE symbols for query: "${query}" on ${exchange}`);

      // Search using symbol database service
      const nseResults = await symbolDatabaseService.searchSymbols(query, parseInt(limit as string));

      searchResults = nseResults.map((result: any) => ({
        symbol: result.symbol,
        name: result.name,
        exchange: result.exchange,
        isin: result.isin,
        series: result.series,
        source: 'nse_official'
      }));

      console.log(`📊 NSE search results: ${searchResults.length} symbols found`);

    } catch (error: any) {
      console.error('❌ NSE symbol search failed:', error.message);
      searchResults = [];
    }

    // Fetch live prices for search results
    const symbols = searchResults.map((r: any) => r.symbol);
    let prices = new Map();

    if (symbols.length > 0) {
      try {
        prices = await marketDataService.getPrices(symbols, exchange as string);
      } catch (error) {
        console.warn('⚠️ Failed to fetch live prices, continuing without prices');
      }
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
 * Get NSE market status
 */
router.get('/market-status', authenticateToken, async (req: any, res: any) => {
  try {
    const status = await symbolDatabaseService.getMarketStatus();

    return res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    console.error('❌ Failed to get market status:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get market status',
      details: error.message
    });
  }
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
 * Get NSE gainers
 */
router.get('/gainers', authenticateToken, async (req: any, res: any) => {
  try {
    const gainers = await symbolDatabaseService.getGainers();

    return res.json({
      success: true,
      data: gainers
    });
  } catch (error: any) {
    console.error('❌ Failed to get gainers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get gainers',
      details: error.message
    });
  }
});

/**
 * Get NSE losers
 */
router.get('/losers', authenticateToken, async (req: any, res: any) => {
  try {
    const losers = await symbolDatabaseService.getLosers();

    return res.json({
      success: true,
      data: losers
    });
  } catch (error: any) {
    console.error('❌ Failed to get losers:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get losers',
      details: error.message
    });
  }
});

/**
 * Get 52-week high stocks
 */
router.get('/52-week-high', authenticateToken, async (req: any, res: any) => {
  try {
    const stocks = await symbolDatabaseService.get52WeekHigh();

    return res.json({
      success: true,
      data: stocks
    });
  } catch (error: any) {
    console.error('❌ Failed to get 52-week high stocks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get 52-week high stocks',
      details: error.message
    });
  }
});

/**
 * Get 52-week low stocks
 */
router.get('/52-week-low', authenticateToken, async (req: any, res: any) => {
  try {
    const stocks = await symbolDatabaseService.get52WeekLow();

    return res.json({
      success: true,
      data: stocks
    });
  } catch (error: any) {
    console.error('❌ Failed to get 52-week low stocks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get 52-week low stocks',
      details: error.message
    });
  }
});

/**
 * Get top value stocks
 */
router.get('/top-value', authenticateToken, async (req: any, res: any) => {
  try {
    const stocks = await symbolDatabaseService.getTopValueStocks();

    return res.json({
      success: true,
      data: stocks
    });
  } catch (error: any) {
    console.error('❌ Failed to get top value stocks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get top value stocks',
      details: error.message
    });
  }
});

/**
 * Get top volume stocks
 */
router.get('/top-volume', authenticateToken, async (req: any, res: any) => {
  try {
    const stocks = await symbolDatabaseService.getTopVolumeStocks();

    return res.json({
      success: true,
      data: stocks
    });
  } catch (error: any) {
    console.error('❌ Failed to get top volume stocks:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get top volume stocks',
      details: error.message
    });
  }
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

export default router;
