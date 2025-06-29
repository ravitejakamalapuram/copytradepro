import express from 'express';
import { marketDataService } from '../services/marketDataService';
import { authenticateToken } from '../middleware/auth';
import { userBrokerConnections } from '../controllers/brokerController';

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

    // Try to get live search results from connected brokers
    let brokerResults: any[] = [];
    let fallbackUsed = false;

    // Get user's broker connections
    const userConnections = userBrokerConnections.get(userId);

    if (userConnections && userConnections.size > 0) {
      // Try each connected broker for symbol search
      for (const [brokerName, brokerService] of userConnections) {
        try {
          console.log(`🔍 Searching symbols via ${brokerName} for query: ${query}`);
          const searchResults = await brokerService.searchScrip(exchange as string, query);

          if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
            // Transform broker results to standard format
            const transformedResults = searchResults.slice(0, parseInt(limit as string)).map((result: any) => {
              // Handle different broker response formats
              if (brokerName === 'shoonya') {
                return {
                  symbol: result.tsym || result.symbol,
                  name: result.cname || result.name || result.tsym,
                  exchange: result.exch || exchange,
                  token: result.token,
                  brokerData: result
                };
              } else if (brokerName === 'fyers') {
                return {
                  symbol: result.symbol?.split(':')[1] || result.symbol,
                  name: result.description || result.name || result.symbol,
                  exchange: result.symbol?.split(':')[0] || exchange,
                  token: result.fyToken,
                  brokerData: result
                };
              }
              return result;
            });

            brokerResults = transformedResults;
            console.log(`✅ Found ${brokerResults.length} results from ${brokerName}`);
            break; // Use first successful broker
          }
        } catch (error: any) {
          console.warn(`⚠️ ${brokerName} search failed:`, error.message);
          continue; // Try next broker
        }
      }
    }

    // Fallback to static database if no broker results
    if (brokerResults.length === 0) {
      console.log('📋 Using fallback static symbol database');
      fallbackUsed = true;

      const fallbackSymbols = [
        { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'NSE' },
        { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE' },
        { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'NSE' },
        { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'NSE' },
        { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'NSE' },
        { symbol: 'HINDUNILVR', name: 'Hindustan Unilever Ltd', exchange: 'NSE' },
        { symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE' },
        { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
        { symbol: 'BHARTIARTL', name: 'Bharti Airtel Ltd', exchange: 'NSE' },
        { symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank Ltd', exchange: 'NSE' },
        { symbol: 'ZOMATO', name: 'Zomato Ltd', exchange: 'NSE' },
        { symbol: 'PAYTM', name: 'One 97 Communications Ltd', exchange: 'NSE' },
        { symbol: 'NYKAA', name: 'FSN E-Commerce Ventures Ltd', exchange: 'NSE' }
      ];

      brokerResults = fallbackSymbols
        .filter(stock =>
          stock.symbol.toLowerCase().includes(query.toLowerCase()) ||
          stock.name.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, parseInt(limit as string));
    }

    // Fetch live prices for search results
    const symbols = brokerResults.map(r => r.symbol);
    let prices = new Map();

    if (symbols.length > 0) {
      try {
        prices = await marketDataService.getPrices(symbols, exchange as string);
      } catch (error) {
        console.warn('⚠️ Failed to fetch live prices, continuing without prices');
      }
    }

    const enrichedResults = brokerResults.map(stock => ({
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
        query,
        source: fallbackUsed ? 'fallback' : 'broker_api',
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
