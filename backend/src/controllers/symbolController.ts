/**
 * Symbol Controller
 * Handles symbol validation, search, and information endpoints
 */

import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { symbolValidationService } from '../services/symbolValidationService';
import { symbolSearchService } from '../services/symbolSearchService';
import { symbolDatabaseService } from '../services/symbolDatabaseService';
import { upstoxDataProcessor } from '../services/upstoxDataProcessor';
import { startupSymbolInitializationService } from '../services/startupStatusService';

/**
 * Helper function to check if symbol data is ready
 */
async function checkSymbolDataReady(res: Response): Promise<boolean> {
  const isReady = await startupSymbolInitializationService.isSymbolDataReady();
  
  if (!isReady) {
    const status = startupSymbolInitializationService.getStatus();
    res.status(503).json({
      success: false,
      message: 'Symbol data is not ready yet',
      data: {
        initializationStatus: status.status,
        progress: status.progress,
        currentStep: status.currentStep,
        suggestion: 'Please wait for symbol data initialization to complete or check /api/symbol-initialization/status'
      }
    });
    return false;
  }
  
  return true;
}

/**
 * Validate symbol for order placement
 */
export const validateSymbol = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors.array(),
      });
      return;
    }

    const { symbol, exchange, brokerName } = req.body;

    if (!symbol) {
      res.status(400).json({
        success: false,
        message: 'Symbol is required',
      });
      return;
    }

    // Validate symbol
    const validation = brokerName 
      ? await symbolValidationService.validateSymbolForBroker(symbol, brokerName, exchange)
      : await symbolValidationService.validateAndResolveSymbol(symbol, exchange);

    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: validation.error,
        data: {
          symbol,
          exchange,
          brokerName
        }
      });
      return;
    }

    // Get comprehensive symbol information
    const symbolInfo = await symbolValidationService.getOrderSymbolInfo(symbol, exchange);

    res.json({
      success: true,
      message: 'Symbol validation successful',
      data: {
        isValid: true,
        symbol: validation.symbol,
        symbolInfo,
        displayInfo: validation.symbol ? symbolValidationService.getSymbolDisplayInfo(validation.symbol) : null
      }
    });

  } catch (error: any) {
    console.error('Symbol validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Symbol validation failed',
      error: error.message
    });
  }
};

/**
 * Search symbols with filters
 */
export const searchSymbols = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    // Check if symbol data is ready
    if (!(await checkSymbolDataReady(res))) {
      return;
    }
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
      limit = 20,
      offset = 0,
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = req.query;

    const searchOptions = {
      query: query as string,
      instrumentType: instrumentType as 'EQUITY' | 'OPTION' | 'FUTURE',
      exchange: exchange as string,
      underlying: underlying as string,
      ...(strikeMin ? { strikeMin: parseFloat(strikeMin as string) } : {}),
      ...(strikeMax ? { strikeMax: parseFloat(strikeMax as string) } : {}),
      expiryStart: expiryStart as string,
      expiryEnd: expiryEnd as string,
      optionType: optionType as 'CE' | 'PE',
      limit: Math.min(parseInt(limit as string) || 20, 100),
      offset: parseInt(offset as string) || 0,
      sortBy: sortBy as 'relevance' | 'name' | 'symbol' | 'expiry' | 'strike',
      sortOrder: sortOrder as 'asc' | 'desc'
    };

    const searchResult = await symbolSearchService.searchSymbols(searchOptions);

    res.json({
      success: true,
      message: 'Symbol search completed',
      data: searchResult
    });

  } catch (error: any) {
    console.error('Symbol search error:', error);
    res.status(500).json({
      success: false,
      message: 'Symbol search failed',
      error: error.message
    });
  }
};

/**
 * Quick search for autocomplete
 */
export const quickSearch = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    // Check if symbol data is ready
    if (!(await checkSymbolDataReady(res))) {
      return;
    }
    const { q: query, limit = 10 } = req.query;

    if (!query || (query as string).trim().length < 2) {
      res.json({
        success: true,
        message: 'Query too short',
        data: []
      });
      return;
    }

    const results = await symbolSearchService.quickSearch(
      query as string,
      Math.min(parseInt(limit as string) || 10, 20)
    );

    res.json({
      success: true,
      message: 'Quick search completed',
      data: results
    });

  } catch (error: any) {
    console.error('Quick search error:', error);
    res.status(500).json({
      success: false,
      message: 'Quick search failed',
      error: error.message
    });
  }
};

/**
 * Get symbol suggestions
 */
export const getSymbolSuggestions = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { input, exchange, instrumentType, underlying } = req.query;

    if (!input) {
      res.status(400).json({
        success: false,
        message: 'Input is required'
      });
      return;
    }

    const suggestions = await symbolValidationService.getSymbolSuggestions(
      input as string,
      {
        exchange: exchange as string,
        instrumentType: instrumentType as 'EQUITY' | 'OPTION' | 'FUTURE',
        underlying: underlying as string
      }
    );

    res.json({
      success: true,
      message: 'Symbol suggestions retrieved',
      data: suggestions
    });

  } catch (error: any) {
    console.error('Symbol suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get symbol suggestions',
      error: error.message
    });
  }
};

/**
 * Get option chain
 */
export const getOptionChain = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { underlying, expiry } = req.query;

    if (!underlying) {
      res.status(400).json({
        success: false,
        message: 'Underlying symbol is required'
      });
      return;
    }

    const optionChain = await symbolSearchService.getOptionChain(
      underlying as string,
      expiry as string
    );

    res.json({
      success: true,
      message: 'Option chain retrieved',
      data: optionChain
    });

  } catch (error: any) {
    console.error('Option chain error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get option chain',
      error: error.message
    });
  }
};

/**
 * Get futures chain
 */
export const getFuturesChain = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { underlying } = req.query;

    if (!underlying) {
      res.status(400).json({
        success: false,
        message: 'Underlying symbol is required'
      });
      return;
    }

    const futuresChain = await symbolSearchService.getFuturesChain(underlying as string);

    res.json({
      success: true,
      message: 'Futures chain retrieved',
      data: futuresChain
    });

  } catch (error: any) {
    console.error('Futures chain error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get futures chain',
      error: error.message
    });
  }
};

/**
 * Get symbol by ID
 */
export const getSymbolById = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Symbol ID is required'
      });
      return;
    }

    const symbol = await symbolDatabaseService.getSymbolById(id);

    if (!symbol) {
      res.status(404).json({
        success: false,
        message: 'Symbol not found'
      });
      return;
    }

    const displayInfo = symbolValidationService.getSymbolDisplayInfo(symbol);

    res.json({
      success: true,
      message: 'Symbol retrieved',
      data: {
        symbol,
        displayInfo
      }
    });

  } catch (error: any) {
    console.error('Get symbol by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get symbol',
      error: error.message
    });
  }
};

/**
 * Batch validate symbols
 */
export const batchValidateSymbols = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors.array(),
      });
      return;
    }

    const { symbols } = req.body;

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Symbols array is required'
      });
      return;
    }

    if (symbols.length > 50) {
      res.status(400).json({
        success: false,
        message: 'Maximum 50 symbols allowed per batch'
      });
      return;
    }

    const validationResults = await symbolValidationService.validateSymbols(symbols);

    const validSymbols = validationResults.filter(result => result.isValid);
    const invalidSymbols = validationResults.filter(result => !result.isValid);

    res.json({
      success: true,
      message: 'Batch validation completed',
      data: {
        total: symbols.length,
        valid: validSymbols.length,
        invalid: invalidSymbols.length,
        results: validationResults
      }
    });

  } catch (error: any) {
    console.error('Batch validate symbols error:', error);
    res.status(500).json({
      success: false,
      message: 'Batch validation failed',
      error: error.message
    });
  }
};

/**
 * Get popular symbols
 */
export const getPopularSymbols = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { instrumentType, limit = 10 } = req.query;

    const symbols = await symbolSearchService.getPopularSymbols(
      instrumentType as 'EQUITY' | 'OPTION' | 'FUTURE',
      Math.min(parseInt(limit as string) || 10, 50)
    );

    res.json({
      success: true,
      message: 'Popular symbols retrieved',
      data: symbols
    });

  } catch (error: any) {
    console.error('Get popular symbols error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get popular symbols',
      error: error.message
    });
  }
};