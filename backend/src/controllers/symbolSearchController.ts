import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { symbolSearchService } from '../services/symbolSearchService';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { symbolMonitoringService } from '../services/symbolMonitoringService';
import { SearchOptions } from '../services/symbolSearchService';

/**
 * Symbol Search Controller
 * Handles all symbol search related API endpoints
 */
class SymbolSearchController {
  /**
   * Search symbols with advanced filtering and fuzzy matching
   * GET /api/symbols/search?query=...&instrumentType=...&exchange=...
   */
  async searchSymbols(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    const startTime = Date.now();
    let success = false;
    let resultCount = 0;
    let cacheHit = false;
    
    try {
      const {
        query,
        instrumentType,
        exchange,
        underlying,
        strikeMin,
        strikeMax,
        expiryStart,
        expiryEnd,
        optionType,
        isActive,
        limit,
        offset,
        sortBy,
        sortOrder
      } = req.query;

      const searchOptions: SearchOptions = {};
      
      if (query) searchOptions.query = query as string;
      if (instrumentType) searchOptions.instrumentType = instrumentType as 'EQUITY' | 'OPTION' | 'FUTURE';
      if (exchange) searchOptions.exchange = exchange as string;
      if (underlying) searchOptions.underlying = underlying as string;
      if (strikeMin) searchOptions.strikeMin = parseFloat(strikeMin as string);
      if (strikeMax) searchOptions.strikeMax = parseFloat(strikeMax as string);
      if (expiryStart) searchOptions.expiryStart = expiryStart as string;
      if (expiryEnd) searchOptions.expiryEnd = expiryEnd as string;
      if (optionType) searchOptions.optionType = optionType as 'CE' | 'PE';
      if (isActive !== undefined) searchOptions.isActive = isActive === 'true';
      if (limit) searchOptions.limit = parseInt(limit as string, 10);
      if (offset) searchOptions.offset = parseInt(offset as string, 10);
      if (sortBy) searchOptions.sortBy = sortBy as 'relevance' | 'name' | 'symbol' | 'expiry' | 'strike';
      if (sortOrder) searchOptions.sortOrder = sortOrder as 'asc' | 'desc';

      const result = await symbolSearchService.searchSymbols(searchOptions);
      
      success = true;
      resultCount = result.symbols.length;
      cacheHit = false; // Will be determined by cache service internally

      res.json({
        success: true,
        data: result,
        meta: {
          query: searchOptions,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('🚨 Symbol search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search symbols',
        message: error.message
      });
    } finally {
      // Record search metrics
      symbolMonitoringService.recordSearchMetrics({
        operation: 'search',
        query: (req.query.query as string) || 'advanced_search',
        resultCount,
        duration: Date.now() - startTime,
        cacheHit,
        success,
        ...(success ? {} : { errorMessage: 'Search operation failed' })
      });
    }
  }

  /**
   * Quick search for autocomplete/typeahead
   * GET /api/symbols/search/quick?q=...&limit=...
   */
  async quickSearch(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      const { q, limit } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json({
          success: true,
          data: [],
          message: 'Query must be at least 2 characters long'
        });
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 10;
      const results = await symbolSearchService.quickSearch(q.trim(), limitNum);

      res.json({
        success: true,
        data: results,
        meta: {
          query: q.trim(),
          limit: limitNum,
          count: results.length
        }
      });
    } catch (error: any) {
      console.error('🚨 Quick search error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to perform quick search',
        message: error.message
      });
    }
  }

  /**
   * Get search suggestions for autocomplete
   * GET /api/symbols/search/suggestions?q=...&limit=...
   */
  async getSearchSuggestions(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      const { q, limit } = req.query;

      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json({
          success: true,
          data: [],
          message: 'Query must be at least 2 characters long'
        });
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 5;
      const suggestions = await symbolSearchService.getSearchSuggestions(q.trim(), limitNum);

      res.json({
        success: true,
        data: suggestions,
        meta: {
          query: q.trim(),
          limit: limitNum,
          count: suggestions.length
        }
      });
    } catch (error: any) {
      console.error('🚨 Search suggestions error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get search suggestions',
        message: error.message
      });
    }
  }

  /**
   * Get symbol by ID
   * GET /api/symbols/:id
   */
  async getSymbolById(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    const startTime = Date.now();
    let success = false;
    let cacheHit = false;
    
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Symbol ID is required'
        });
      }

      const symbol = await symbolDatabaseService.getSymbolById(id);
      success = !!symbol;
      cacheHit = true; // getSymbolById uses cache internally

      if (!symbol) {
        return res.status(404).json({
          success: false,
          error: 'Symbol not found'
        });
      }

      res.json({
        success: true,
        data: symbol
      });
    } catch (error: any) {
      console.error('🚨 Get symbol by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get symbol',
        message: error.message
      });
    } finally {
      // Record search metrics
      symbolMonitoringService.recordSearchMetrics({
        operation: 'getById',
        query: req.params.id || 'unknown',
        resultCount: success ? 1 : 0,
        duration: Date.now() - startTime,
        cacheHit,
        success,
        ...(success ? {} : { errorMessage: 'Symbol lookup failed' })
      });
    }
  }

  /**
   * Get symbols by underlying asset
   * GET /api/symbols/underlying/:symbol?instrumentType=...&expiry=...
   */
  async getSymbolsByUnderlying(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      const { symbol } = req.params;
      const { instrumentType, expiry } = req.query;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Underlying symbol is required'
        });
      }

      const results = await symbolSearchService.searchByUnderlying(
        symbol.toUpperCase(),
        instrumentType as 'OPTION' | 'FUTURE',
        expiry as string
      );

      res.json({
        success: true,
        data: results,
        meta: {
          underlying: symbol.toUpperCase(),
          instrumentType,
          expiry,
          count: results.length
        }
      });
    } catch (error: any) {
      console.error('🚨 Get symbols by underlying error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get symbols by underlying',
        message: error.message
      });
    }
  }

  /**
   * Get option chain for underlying symbol
   * GET /api/symbols/underlying/:symbol/options?expiry=...
   */
  async getOptionChain(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      const { symbol } = req.params;
      const { expiry } = req.query;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Underlying symbol is required'
        });
      }

      const result = await symbolSearchService.getOptionChain(
        symbol.toUpperCase(),
        expiry as string
      );

      res.json({
        success: true,
        data: result,
        meta: {
          underlying: symbol.toUpperCase(),
          expiry,
          callsCount: result.calls.length,
          putsCount: result.puts.length,
          expiriesCount: result.expiries.length
        }
      });
    } catch (error: any) {
      console.error('🚨 Get option chain error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get option chain',
        message: error.message
      });
    }
  }

  /**
   * Get futures chain for underlying symbol
   * GET /api/symbols/underlying/:symbol/futures
   */
  async getFuturesChain(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      const { symbol } = req.params;

      if (!symbol) {
        return res.status(400).json({
          success: false,
          error: 'Underlying symbol is required'
        });
      }

      const result = await symbolSearchService.getFuturesChain(symbol.toUpperCase());

      res.json({
        success: true,
        data: result,
        meta: {
          underlying: symbol.toUpperCase(),
          futuresCount: result.futures.length,
          expiriesCount: result.expiries.length
        }
      });
    } catch (error: any) {
      console.error('🚨 Get futures chain error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get futures chain',
        message: error.message
      });
    }
  }

  /**
   * Advanced filtering with multiple criteria
   * POST /api/symbols/filter
   */
  async advancedFilter(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      const filters = req.body;

      const result = await symbolSearchService.advancedFilter(filters);

      res.json({
        success: true,
        data: result,
        meta: {
          filters,
          count: result.symbols.length,
          total: result.total
        }
      });
    } catch (error: any) {
      console.error('🚨 Advanced filter error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply advanced filters',
        message: error.message
      });
    }
  }

  /**
   * Get popular/trending symbols
   * GET /api/symbols/popular/:instrumentType?limit=...
   */
  async getPopularSymbols(req: AuthenticatedRequest, res: Response): Promise<Response | void> {
    try {
      const { instrumentType } = req.params;
      const { limit } = req.query;

      const limitNum = limit ? parseInt(limit as string, 10) : 10;
      const results = await symbolSearchService.getPopularSymbols(
        instrumentType as 'EQUITY' | 'OPTION' | 'FUTURE',
        limitNum
      );

      res.json({
        success: true,
        data: results,
        meta: {
          instrumentType,
          limit: limitNum,
          count: results.length
        }
      });
    } catch (error: any) {
      console.error('🚨 Get popular symbols error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get popular symbols',
        message: error.message
      });
    }
  }
}

export const symbolSearchController = new SymbolSearchController();