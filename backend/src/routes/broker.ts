import express from 'express';
import { body } from 'express-validator';
import {
  connectBroker,
  validateFyersAuthCode,
  getConnectedAccounts,
  checkAccountSessionStatus,
  saveConnectedAccount,
  removeConnectedAccount,
  activateAccount,
  deactivateAccount,
  disconnectBroker,
  placeOrder,
  getOrderHistory,
  getOrderStatus,
  checkOrderStatus,
  getOrderSearchSuggestions,
  getOrderBook,
  getPositions,
  searchSymbol,
  getQuotes
} from '../controllers/brokerController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Validation rules for broker connection
const connectBrokerValidation = [
  body('brokerName')
    .isIn(['shoonya', 'fyers'])
    .withMessage('Supported brokers: shoonya, fyers'),

  // Conditional validation for Shoonya
  body('credentials.userId')
    .if(body('brokerName').equals('shoonya'))
    .trim()
    .isLength({ min: 1 })
    .withMessage('User ID is required for Shoonya'),
  body('credentials.password')
    .if(body('brokerName').equals('shoonya'))
    .isLength({ min: 1 })
    .withMessage('Password is required for Shoonya'),
  body('credentials.totpKey')
    .if(body('brokerName').equals('shoonya'))
    .trim()
    .isLength({ min: 1 })
    .withMessage('TOTP Key is required for Shoonya'),
  body('credentials.vendorCode')
    .if(body('brokerName').equals('shoonya'))
    .trim()
    .isLength({ min: 1 })
    .withMessage('Vendor Code is required for Shoonya'),
  body('credentials.apiSecret')
    .if(body('brokerName').equals('shoonya'))
    .isLength({ min: 1 })
    .withMessage('API Secret is required for Shoonya'),
  body('credentials.imei')
    .if(body('brokerName').equals('shoonya'))
    .trim()
    .isLength({ min: 1 })
    .withMessage('IMEI is required for Shoonya'),

  // Conditional validation for Fyers
  body('credentials.clientId')
    .if(body('brokerName').equals('fyers'))
    .trim()
    .isLength({ min: 1 })
    .withMessage('Client ID is required for Fyers'),
  body('credentials.secretKey')
    .if(body('brokerName').equals('fyers'))
    .isLength({ min: 1 })
    .withMessage('Secret Key is required for Fyers'),
  body('credentials.redirectUri')
    .if(body('brokerName').equals('fyers'))
    .trim()
    .isURL()
    .withMessage('Valid Redirect URI is required for Fyers'),
];

// Validation rules for placing orders
const placeOrderValidation = [
  body('brokerName')
    .isIn(['shoonya', 'fyers'])
    .withMessage('Supported brokers: shoonya, fyers'),
  body('symbol')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Trading symbol is required'),
  body('action')
    .isIn(['BUY', 'SELL'])
    .withMessage('Action must be BUY or SELL'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  body('orderType')
    .isIn(['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET'])
    .withMessage('Invalid order type'),
  body('exchange')
    .isIn(['NSE', 'BSE', 'NFO', 'MCX', 'CDS'])
    .withMessage('Invalid exchange'),
  body('productType')
    .isIn(['C', 'M', 'H', 'B', 'CNC', 'MIS', 'NRML', 'BO'])
    .withMessage('Invalid product type'),
];

// Routes
router.post('/connect', authenticateToken, connectBrokerValidation, connectBroker);
router.post('/validate-fyers-auth', authenticateToken, validateFyersAuthCode);

// Account management routes
router.get('/accounts', authenticateToken, getConnectedAccounts);
router.get('/accounts/:accountId/status', authenticateToken, checkAccountSessionStatus);
router.post('/accounts', authenticateToken, saveConnectedAccount);
router.delete('/accounts/:accountId', authenticateToken, removeConnectedAccount);
router.post('/accounts/:accountId/activate', authenticateToken, activateAccount);
router.post('/accounts/:accountId/deactivate', authenticateToken, deactivateAccount);

router.post('/disconnect', authenticateToken, disconnectBroker);
router.post('/place-order', authenticateToken, placeOrderValidation, placeOrder);
router.get('/order-history', authenticateToken, getOrderHistory);
router.get('/order-status/:brokerOrderId', authenticateToken, getOrderStatus);
router.post('/check-order-status', authenticateToken, checkOrderStatus);
router.get('/order-search-suggestions', authenticateToken, getOrderSearchSuggestions);
router.get('/orders/:brokerName', authenticateToken, getOrderBook);
router.get('/positions/:brokerName', authenticateToken, getPositions);
router.get('/search/:brokerName/:exchange/:symbol', authenticateToken, searchSymbol);
router.get('/quotes/:brokerName/:exchange/:token', authenticateToken, getQuotes);

export default router;
