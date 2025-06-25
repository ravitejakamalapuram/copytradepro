import express from 'express';
import { body } from 'express-validator';
import { 
  connectBroker, 
  disconnectBroker, 
  placeOrder, 
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
    .isIn(['shoonya'])
    .withMessage('Only Shoonya broker is currently supported'),
  body('credentials.userId')
    .trim()
    .isLength({ min: 1 })
    .withMessage('User ID is required'),
  body('credentials.password')
    .isLength({ min: 1 })
    .withMessage('Password is required'),
  body('credentials.twoFA')
    .trim()
    .isLength({ min: 1 })
    .withMessage('2FA/OTP is required'),
  body('credentials.vendorCode')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Vendor Code is required'),
  body('credentials.apiSecret')
    .isLength({ min: 1 })
    .withMessage('API Secret is required'),
  body('credentials.imei')
    .trim()
    .isLength({ min: 1 })
    .withMessage('IMEI is required'),
];

// Validation rules for placing orders
const placeOrderValidation = [
  body('brokerName')
    .isIn(['shoonya'])
    .withMessage('Only Shoonya broker is currently supported'),
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
    .isIn(['C', 'M', 'H', 'B'])
    .withMessage('Invalid product type'),
];

// Routes
router.post('/connect', authenticateToken, connectBrokerValidation, connectBroker);
router.post('/disconnect', authenticateToken, disconnectBroker);
router.post('/place-order', authenticateToken, placeOrderValidation, placeOrder);
router.get('/orders/:brokerName', authenticateToken, getOrderBook);
router.get('/positions/:brokerName', authenticateToken, getPositions);
router.get('/search/:brokerName/:exchange/:symbol', authenticateToken, searchSymbol);
router.get('/quotes/:brokerName/:exchange/:token', authenticateToken, getQuotes);

export default router;
