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

    // Comprehensive Indian stock symbol database
    const stockSymbols = [
      // NIFTY 50 Stocks
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
      { symbol: 'LT', name: 'Larsen & Toubro Ltd', exchange: 'NSE' },
      { symbol: 'ASIANPAINT', name: 'Asian Paints Ltd', exchange: 'NSE' },
      { symbol: 'MARUTI', name: 'Maruti Suzuki India Ltd', exchange: 'NSE' },
      { symbol: 'BAJFINANCE', name: 'Bajaj Finance Ltd', exchange: 'NSE' },
      { symbol: 'HCLTECH', name: 'HCL Technologies Ltd', exchange: 'NSE' },
      { symbol: 'AXISBANK', name: 'Axis Bank Ltd', exchange: 'NSE' },
      { symbol: 'WIPRO', name: 'Wipro Ltd', exchange: 'NSE' },
      { symbol: 'ULTRACEMCO', name: 'UltraTech Cement Ltd', exchange: 'NSE' },
      { symbol: 'NESTLEIND', name: 'Nestle India Ltd', exchange: 'NSE' },
      { symbol: 'TITAN', name: 'Titan Company Ltd', exchange: 'NSE' },
      { symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical Industries Ltd', exchange: 'NSE' },
      { symbol: 'POWERGRID', name: 'Power Grid Corporation of India Ltd', exchange: 'NSE' },
      { symbol: 'NTPC', name: 'NTPC Ltd', exchange: 'NSE' },
      { symbol: 'TECHM', name: 'Tech Mahindra Ltd', exchange: 'NSE' },
      { symbol: 'ONGC', name: 'Oil & Natural Gas Corporation Ltd', exchange: 'NSE' },
      { symbol: 'TATAMOTORS', name: 'Tata Motors Ltd', exchange: 'NSE' },
      { symbol: 'TATASTEEL', name: 'Tata Steel Ltd', exchange: 'NSE' },
      { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv Ltd', exchange: 'NSE' },
      { symbol: 'JSWSTEEL', name: 'JSW Steel Ltd', exchange: 'NSE' },
      { symbol: 'INDUSINDBK', name: 'IndusInd Bank Ltd', exchange: 'NSE' },
      { symbol: 'DRREDDY', name: 'Dr Reddys Laboratories Ltd', exchange: 'NSE' },
      { symbol: 'CIPLA', name: 'Cipla Ltd', exchange: 'NSE' },
      { symbol: 'EICHERMOT', name: 'Eicher Motors Ltd', exchange: 'NSE' },
      { symbol: 'COALINDIA', name: 'Coal India Ltd', exchange: 'NSE' },
      { symbol: 'GRASIM', name: 'Grasim Industries Ltd', exchange: 'NSE' },
      { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp Ltd', exchange: 'NSE' },
      { symbol: 'BRITANNIA', name: 'Britannia Industries Ltd', exchange: 'NSE' },
      { symbol: 'DIVISLAB', name: 'Divis Laboratories Ltd', exchange: 'NSE' },
      { symbol: 'ADANIPORTS', name: 'Adani Ports and Special Economic Zone Ltd', exchange: 'NSE' },
      { symbol: 'BPCL', name: 'Bharat Petroleum Corporation Ltd', exchange: 'NSE' },
      { symbol: 'SHREECEM', name: 'Shree Cement Ltd', exchange: 'NSE' },
      { symbol: 'APOLLOHOSP', name: 'Apollo Hospitals Enterprise Ltd', exchange: 'NSE' },
      { symbol: 'HINDALCO', name: 'Hindalco Industries Ltd', exchange: 'NSE' },
      { symbol: 'TATACONSUM', name: 'Tata Consumer Products Ltd', exchange: 'NSE' },
      { symbol: 'ADANIENT', name: 'Adani Enterprises Ltd', exchange: 'NSE' },

      // Popular Mid & Small Cap Stocks
      { symbol: 'ZOMATO', name: 'Zomato Ltd', exchange: 'NSE' },
      { symbol: 'PAYTM', name: 'One 97 Communications Ltd', exchange: 'NSE' },
      { symbol: 'NYKAA', name: 'FSN E-Commerce Ventures Ltd', exchange: 'NSE' },
      { symbol: 'POLICYBZR', name: 'PB Fintech Ltd', exchange: 'NSE' },
      { symbol: 'IRCTC', name: 'Indian Railway Catering And Tourism Corporation Ltd', exchange: 'NSE' },
      { symbol: 'DMART', name: 'Avenue Supermarts Ltd', exchange: 'NSE' },
      { symbol: 'PIDILITIND', name: 'Pidilite Industries Ltd', exchange: 'NSE' },
      { symbol: 'GODREJCP', name: 'Godrej Consumer Products Ltd', exchange: 'NSE' },
      { symbol: 'MARICO', name: 'Marico Ltd', exchange: 'NSE' },
      { symbol: 'DABUR', name: 'Dabur India Ltd', exchange: 'NSE' },
      { symbol: 'BIOCON', name: 'Biocon Ltd', exchange: 'NSE' },
      { symbol: 'LUPIN', name: 'Lupin Ltd', exchange: 'NSE' },
      { symbol: 'AUBANK', name: 'AU Small Finance Bank Ltd', exchange: 'NSE' },
      { symbol: 'BANDHANBNK', name: 'Bandhan Bank Ltd', exchange: 'NSE' },
      { symbol: 'FEDERALBNK', name: 'Federal Bank Ltd', exchange: 'NSE' },
      { symbol: 'IDFCFIRSTB', name: 'IDFC First Bank Ltd', exchange: 'NSE' },
      { symbol: 'PNB', name: 'Punjab National Bank', exchange: 'NSE' },
      { symbol: 'CANBK', name: 'Canara Bank', exchange: 'NSE' },
      { symbol: 'BANKBARODA', name: 'Bank of Baroda', exchange: 'NSE' },
      { symbol: 'IOC', name: 'Indian Oil Corporation Ltd', exchange: 'NSE' },
      { symbol: 'GAIL', name: 'GAIL (India) Ltd', exchange: 'NSE' },
      { symbol: 'SAIL', name: 'Steel Authority of India Ltd', exchange: 'NSE' },
      { symbol: 'VEDL', name: 'Vedanta Ltd', exchange: 'NSE' },
      { symbol: 'NMDC', name: 'NMDC Ltd', exchange: 'NSE' },
      { symbol: 'MOTHERSON', name: 'Motherson Sumi Systems Ltd', exchange: 'NSE' },
      { symbol: 'ASHOKLEY', name: 'Ashok Leyland Ltd', exchange: 'NSE' },
      { symbol: 'M&M', name: 'Mahindra & Mahindra Ltd', exchange: 'NSE' },
      { symbol: 'BAJAJ-AUTO', name: 'Bajaj Auto Ltd', exchange: 'NSE' },
      { symbol: 'TVSMOTOR', name: 'TVS Motor Company Ltd', exchange: 'NSE' },
      { symbol: 'ESCORTS', name: 'Escorts Ltd', exchange: 'NSE' },
      { symbol: 'SIEMENS', name: 'Siemens Ltd', exchange: 'NSE' },
      { symbol: 'ABB', name: 'ABB India Ltd', exchange: 'NSE' },
      { symbol: 'HAVELLS', name: 'Havells India Ltd', exchange: 'NSE' },
      { symbol: 'VOLTAS', name: 'Voltas Ltd', exchange: 'NSE' },
      { symbol: 'WHIRLPOOL', name: 'Whirlpool of India Ltd', exchange: 'NSE' },
      { symbol: 'CROMPTON', name: 'Crompton Greaves Consumer Electricals Ltd', exchange: 'NSE' },

      // BSE Listed Stocks
      { symbol: 'RELIANCE', name: 'Reliance Industries Ltd', exchange: 'BSE' },
      { symbol: 'TCS', name: 'Tata Consultancy Services Ltd', exchange: 'BSE' },
      { symbol: 'HDFCBANK', name: 'HDFC Bank Ltd', exchange: 'BSE' },
      { symbol: 'INFY', name: 'Infosys Ltd', exchange: 'BSE' },
      { symbol: 'ICICIBANK', name: 'ICICI Bank Ltd', exchange: 'BSE' }
    ];

    const results = stockSymbols
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
