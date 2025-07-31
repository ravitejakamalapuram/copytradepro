import express from 'express';
import { body } from 'express-validator';
import { authenticateToken } from '../middleware/auth';
import { symbolSearchController } from '../controllers/symbolSearchController';
import { validateSymbol, batchValidateSymbols } from '../controllers/symbolController';

const router = express.Router();

// Symbol validation endpoints
router.post('/validate',
  authenticateToken,
  [
    body('symbol')
      .notEmpty()
      .withMessage('Symbol is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('Symbol must be between 1 and 50 characters'),
    body('exchange')
      .optional()
      .isIn(['NSE', 'BSE', 'NFO', 'BFO', 'MCX'])
      .withMessage('Invalid exchange'),
    body('brokerName')
      .optional()
      .isIn(['fyers', 'shoonya', 'zerodha', 'upstox', 'angelone'])
      .withMessage('Invalid broker name')
  ],
  validateSymbol
);

router.post('/batch-validate',
  authenticateToken,
  [
    body('symbols')
      .isArray({ min: 1, max: 50 })
      .withMessage('Symbols must be an array with 1-50 items'),
    body('symbols.*.symbol')
      .notEmpty()
      .withMessage('Each symbol is required')
      .isLength({ min: 1, max: 50 })
      .withMessage('Each symbol must be between 1 and 50 characters'),
    body('symbols.*.exchange')
      .optional()
      .isIn(['NSE', 'BSE', 'NFO', 'BFO', 'MCX'])
      .withMessage('Invalid exchange')
  ],
  batchValidateSymbols
);

// Symbol search endpoints
router.get('/search', authenticateToken, symbolSearchController.searchSymbols);
router.get('/search/quick', authenticateToken, symbolSearchController.quickSearch);
router.get('/search/suggestions', authenticateToken, symbolSearchController.getSearchSuggestions);

// Individual symbol lookup
router.get('/:id', authenticateToken, symbolSearchController.getSymbolById);

// Underlying-based searches
router.get('/underlying/:symbol', authenticateToken, symbolSearchController.getSymbolsByUnderlying);
router.get('/underlying/:symbol/options', authenticateToken, symbolSearchController.getOptionChain);
router.get('/underlying/:symbol/futures', authenticateToken, symbolSearchController.getFuturesChain);

// Advanced filtering
router.post('/filter', authenticateToken, symbolSearchController.advancedFilter);

// Popular/trending symbols
router.get('/popular', authenticateToken, symbolSearchController.getPopularSymbols);
router.get('/popular/:instrumentType', authenticateToken, symbolSearchController.getPopularSymbols);

export default router;