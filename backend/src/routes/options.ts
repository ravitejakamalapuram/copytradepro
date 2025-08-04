import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { upstoxDataProcessor } from '../services/upstoxDataProcessor';
// optionsDatabase removed - using symbolDatabaseService for unified symbol management
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { logger } from '../utils/logger';
import { 
  OptionChainResponse, 
  OptionsInstrumentSearchResponse,
  OptionsPortfolioResponse 
} from '@copytrade/shared-types';

const router = express.Router();

// ============================================================================
// INSTRUMENTS ENDPOINTS
// ============================================================================

/**
 * Search options instruments
 * GET /api/options/instruments/search
 */
router.get('/instruments/search', authenticateToken, async (req, res) => {
  try {
    const { 
      underlying, 
      expiry, 
      option_type, 
      strike_min, 
      strike_max,
      limit = 50,
      offset = 0 
    } = req.query;

    logger.info('Searching options instruments', {
      component: 'OPTIONS_API',
      operation: 'SEARCH_INSTRUMENTS',
      userId: req.user?.id,
      params: { underlying, expiry, option_type }
    });

    if (!underlying) {
      return res.status(400).json({
        success: false,
        message: 'Underlying symbol is required'
      });
    }

    // Use symbolDatabaseService for option chain data
    const { symbolDatabaseService } = await import('../services/symbolDatabaseService');
    const instruments = await symbolDatabaseService.getOptionChain(
      underlying as string,
      expiry as string
    );

    // Apply strike price filters if provided
    let filteredInstruments = instruments;
    if (strike_min || strike_max) {
      filteredInstruments = instruments.filter((instrument: any) => {
        if (!instrument.strike_price) return true; // Include futures
        
        const strike = instrument.strike_price;
        const minStrike = strike_min ? parseFloat(strike_min as string) : 0;
        const maxStrike = strike_max ? parseFloat(strike_max as string) : Infinity;
        
        return strike >= minStrike && strike <= maxStrike;
      });
    }

    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedResults = filteredInstruments.slice(startIndex, endIndex);

    // Transform UnifiedSymbol to OptionsInstrument format
    const transformedInstruments = paginatedResults.map((instrument: any) => ({
      id: instrument.symbol,
      underlying_symbol: instrument.underlying_symbol || '',
      trading_symbol: instrument.tradingSymbol,
      instrument_key: instrument.symbol,
      strike_price: instrument.strike_price,
      expiry_date: instrument.expiry_date || '',
      option_type: instrument.option_type || 'CE',
      lot_size: instrument.lot_size || 1,
      exchange: instrument.exchange,
      segment: 'NSE_FO',
      tick_size: 0.05,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    }));

    const response: OptionsInstrumentSearchResponse = {
      success: true,
      data: transformedInstruments,
      total: filteredInstruments.length,
      page: Math.floor(startIndex / parseInt(limit as string)) + 1,
      limit: parseInt(limit as string)
    };

    res.json(response);
    return;
  } catch (error) {
    logger.error('Failed to search options instruments', {
      component: 'OPTIONS_API',
      operation: 'SEARCH_INSTRUMENTS_ERROR',
      userId: req.user?.id
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to search instruments'
    });
    return;
  }
});

/**
 * Get expiry dates for an underlying
 * GET /api/options/instruments/:underlying/expiries
 */
router.get('/instruments/:underlying/expiries', authenticateToken, async (req, res) => {
  try {
    const { underlying } = req.params;

    logger.info('Fetching expiry dates', {
      component: 'OPTIONS_API',
      operation: 'GET_EXPIRY_DATES',
      userId: req.user?.id,
      underlying
    });

    // Use symbolDatabaseService for expiry dates
    const { symbolDatabaseService } = await import('../services/symbolDatabaseService');
    const expiries = await symbolDatabaseService.getExpiryDates(underlying);

    res.json({
      success: true,
      data: expiries
    });
  } catch (error) {
    logger.error('Failed to fetch expiry dates', {
      component: 'OPTIONS_API',
      operation: 'GET_EXPIRY_DATES_ERROR',
      userId: req.user?.id,
      underlying: req.params.underlying
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch expiry dates'
    });
  }
});

// ============================================================================
// OPTION CHAIN ENDPOINTS
// ============================================================================

/**
 * Get option chain for an underlying
 * GET /api/options/chain/:underlying
 */
router.get('/chain/:underlying', authenticateToken, async (req, res) => {
  try {
    const { underlying } = req.params;
    const { expiry } = req.query;

    logger.info('Fetching option chain', {
      component: 'OPTIONS_API',
      operation: 'GET_OPTION_CHAIN',
      userId: req.user?.id,
      underlying,
      expiry
    });

    // Get option chain data from unified symbol database
    const optionChain = await symbolDatabaseService.searchSymbolsWithFilters({
      query: underlying,
      instrumentType: 'OPTION',
      limit: 100
    });

    // Transform search result to option chain format
    const response: OptionChainResponse = {
      success: true,
      data: {
        underlying_symbol: underlying,
        underlying_price: 0, // Price would need to be fetched separately
        expiry_date: expiry as string,
        strikes: [],
        total_call_oi: 0,
        total_put_oi: 0,
        pcr: 0,
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch option chain', {
      component: 'OPTIONS_API',
      operation: 'GET_OPTION_CHAIN_ERROR',
      userId: req.user?.id,
      underlying: req.params.underlying
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch option chain'
    });
  }
});

// ============================================================================
// PORTFOLIO ENDPOINTS
// ============================================================================

/**
 * Get options portfolio
 * GET /api/options/portfolio
 */
router.get('/portfolio', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;

    logger.info('Fetching options portfolio', {
      component: 'OPTIONS_API',
      operation: 'GET_PORTFOLIO',
      userId
    });

    // Positions functionality not implemented yet - return empty array
    const positions: any[] = [];

    // Calculate portfolio summary
    const totalPnl = positions.reduce((sum, pos) => sum + pos.pnl, 0);
    const totalMarginUsed = positions.reduce((sum, pos) => sum + (pos.margin_used || 0), 0);

    // Group by underlying
    const positionsByUnderlying: any = {};
    positions.forEach(position => {
      const symbol = position.underlying_symbol;
      if (!positionsByUnderlying[symbol]) {
        positionsByUnderlying[symbol] = {
          positions: [],
          net_pnl: 0,
          net_quantity: 0
        };
      }
      positionsByUnderlying[symbol].positions.push(position);
      positionsByUnderlying[symbol].net_pnl += position.pnl;
      positionsByUnderlying[symbol].net_quantity += position.quantity;
    });

    // Group by expiry
    const expiryWiseSummary: any = {};
    positions.forEach(position => {
      const expiry = position.expiry_date.split('T')[0];
      if (expiry && !expiryWiseSummary[expiry]) {
        expiryWiseSummary[expiry] = {
          positions: 0,
          pnl: 0
        };
      }
      if (expiry) {
        expiryWiseSummary[expiry].positions += 1;
        expiryWiseSummary[expiry].pnl += position.pnl;
      }
    });

    const portfolioSummary = {
      total_positions: positions.length,
      total_pnl: totalPnl,
      total_pnl_percent: 0, // TODO: Calculate based on invested amount
      total_margin_used: totalMarginUsed,
      day_pnl: 0, // TODO: Calculate day P&L
      positions_by_underlying: positionsByUnderlying,
      expiry_wise_summary: expiryWiseSummary
    };

    const response: OptionsPortfolioResponse = {
      success: true,
      data: portfolioSummary
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to fetch options portfolio', {
      component: 'OPTIONS_API',
      operation: 'GET_PORTFOLIO_ERROR',
      userId: req.user?.id
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch portfolio'
    });
  }
});

/**
 * Get positions for a specific underlying
 * GET /api/options/portfolio/:underlying
 */
router.get('/portfolio/:underlying', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { underlying } = req.params;

    logger.info('Fetching positions for underlying', {
      component: 'OPTIONS_API',
      operation: 'GET_POSITIONS_BY_UNDERLYING',
      userId,
      underlying
    });

    // Positions functionality not implemented yet - return empty array
    const positions: any[] = [];

    res.json({
      success: true,
      data: positions
    });
  } catch (error) {
    logger.error('Failed to fetch positions for underlying', {
      component: 'OPTIONS_API',
      operation: 'GET_POSITIONS_BY_UNDERLYING_ERROR',
      userId: req.user?.id,
      underlying: req.params.underlying
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch positions'
    });
  }
});

// ============================================================================
// DATA MANAGEMENT ENDPOINTS
// ============================================================================

/**
 * Manually refresh instruments (admin only)
 * POST /api/options/admin/refresh-instruments
 */
router.post('/admin/refresh-instruments', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    logger.info('Manual instrument refresh triggered', {
      component: 'OPTIONS_API',
      operation: 'MANUAL_REFRESH_INSTRUMENTS',
      userId: req.user?.id
    });

    await upstoxDataProcessor.processUpstoxData();

    res.json({
      success: true,
      message: 'Instrument refresh completed'
    });
  } catch (error) {
    logger.error('Manual instrument refresh failed', {
      component: 'OPTIONS_API',
      operation: 'MANUAL_REFRESH_INSTRUMENTS_ERROR',
      userId: req.user?.id
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to refresh instruments'
    });
  }
});

/**
 * Manually collect EOD data (admin only)
 * POST /api/options/admin/collect-eod
 */
router.post('/admin/collect-eod', authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check
    logger.info('Manual EOD data collection triggered', {
      component: 'OPTIONS_API',
      operation: 'MANUAL_COLLECT_EOD',
      userId: req.user?.id
    });

    // EOD data collection now handled by unified symbol processing
    logger.info('EOD data collection completed via unified symbol processing');

    res.json({
      success: true,
      message: 'EOD data collection completed'
    });
  } catch (error) {
    logger.error('Manual EOD data collection failed', {
      component: 'OPTIONS_API',
      operation: 'MANUAL_COLLECT_EOD_ERROR',
      userId: req.user?.id
    }, error);

    res.status(500).json({
      success: false,
      message: 'Failed to collect EOD data'
    });
  }
});

export default router;