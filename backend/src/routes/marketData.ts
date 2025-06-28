import express from 'express';
import { marketDataService } from '../services/marketDataService';
import { authenticateToken } from '../middleware/auth';

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
 * Search for symbols (for autocomplete)
 */
router.get('/search/:query', authenticateToken, async (req: any, res: any) => {
  try {
    const { query } = req.params;
    const { limit = 10 } = req.query;

    if (!query || query.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Query must be at least 2 characters long'
      });
    }

    // Mock search results for now - in production, you'd have a symbol database
    const mockSymbols = [
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE' },
      { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'NSE' },
      { symbol: 'HDFC', name: 'HDFC Bank Ltd', exchange: 'NSE' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'NSE' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE' },
      { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', exchange: 'NSE' },
      { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', exchange: 'NSE' },
      { symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE' },
      { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
      { symbol: 'LT', name: 'Larsen & Toubro Ltd', exchange: 'NSE' },
      { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', exchange: 'NSE' },
      { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', exchange: 'NSE' },
      { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', exchange: 'NSE' },
      { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', exchange: 'NSE' }
    ];

    const results = mockSymbols
      .filter(stock => 
        stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
        stock.name.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, parseInt(limit as string));

    // Fetch live prices for search results
    const symbols = results.map(r => r.symbol);
    const prices = await marketDataService.getPrices(symbols);

    const enrichedResults = results.map(stock => ({
      ...stock,
      price: prices.get(stock.symbol)?.price || null,
      change: prices.get(stock.symbol)?.change || null,
      changePercent: prices.get(stock.symbol)?.changePercent || null
    }));

    return res.json({
      success: true,
      data: {
        results: enrichedResults,
        count: enrichedResults.length,
        query
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
