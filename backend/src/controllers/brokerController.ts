import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { ShoonyaService, ShoonyaCredentials } from '../services/shoonyaService';

// Store broker connections per user (in production, use Redis or database)
const userBrokerConnections = new Map<string, Map<string, ShoonyaService>>();

export const connectBroker = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const { brokerName, credentials } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Initialize user connections if not exists
    if (!userBrokerConnections.has(userId)) {
      userBrokerConnections.set(userId, new Map());
    }

    const userConnections = userBrokerConnections.get(userId)!;

    // Check if already connected to this broker
    if (userConnections.has(brokerName)) {
      res.status(409).json({
        success: false,
        message: `Already connected to ${brokerName}`,
      });
      return;
    }

    // Create new broker service instance
    const shoonyaService = new ShoonyaService();
    
    // Attempt to login
    const loginResponse = await shoonyaService.login(credentials as ShoonyaCredentials);
    
    if (loginResponse.stat === 'Ok') {
      // Store the connection
      userConnections.set(brokerName, shoonyaService);
      
      res.status(200).json({
        success: true,
        message: `Successfully connected to ${brokerName}`,
        data: {
          brokerName,
          userId: credentials.userId,
          accountId: loginResponse.actid,
          userName: loginResponse.uname,
          email: loginResponse.email,
          brokerDisplayName: loginResponse.brkname,
          lastAccessTime: loginResponse.lastaccesstime,
          exchanges: loginResponse.exarr,
          products: loginResponse.prarr,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: loginResponse.emsg || 'Failed to connect to broker',
      });
    }
  } catch (error: any) {
    console.error('🚨 Connect broker error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to connect to broker',
    });
  }
};

export const disconnectBroker = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { brokerName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const userConnections = userBrokerConnections.get(userId);
    if (!userConnections || !userConnections.has(brokerName)) {
      res.status(404).json({
        success: false,
        message: `Not connected to ${brokerName}`,
      });
      return;
    }

    const brokerService = userConnections.get(brokerName)!;
    
    // Logout from broker
    await brokerService.logout();
    
    // Remove connection
    userConnections.delete(brokerName);
    
    res.status(200).json({
      success: true,
      message: `Successfully disconnected from ${brokerName}`,
    });
  } catch (error: any) {
    console.error('🚨 Disconnect broker error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to disconnect from broker',
    });
  }
};

export const placeOrder = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const { 
      brokerName, 
      symbol, 
      action, 
      quantity, 
      orderType, 
      price, 
      triggerPrice,
      exchange,
      productType,
      remarks 
    } = req.body;
    
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const userConnections = userBrokerConnections.get(userId);
    if (!userConnections || !userConnections.has(brokerName)) {
      res.status(404).json({
        success: false,
        message: `Not connected to ${brokerName}. Please connect first.`,
      });
      return;
    }

    const brokerService = userConnections.get(brokerName)!;
    
    // Map order type
    let shoonyaPriceType: 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT';
    switch (orderType) {
      case 'LIMIT':
        shoonyaPriceType = 'LMT';
        break;
      case 'MARKET':
        shoonyaPriceType = 'MKT';
        break;
      case 'SL-LIMIT':
        shoonyaPriceType = 'SL-LMT';
        break;
      case 'SL-MARKET':
        shoonyaPriceType = 'SL-MKT';
        break;
      default:
        shoonyaPriceType = 'MKT';
    }

    const orderData = {
      userId: userId,
      buyOrSell: action === 'BUY' ? 'B' as const : 'S' as const,
      productType: productType || 'C',
      exchange: exchange || 'NSE',
      tradingSymbol: symbol,
      quantity: parseInt(quantity),
      discloseQty: 0,
      priceType: shoonyaPriceType,
      price: price ? parseFloat(price) : 0,
      triggerPrice: triggerPrice ? parseFloat(triggerPrice) : 0,
      retention: 'DAY' as const,
      remarks: remarks || `Order placed via CopyTrade Pro`,
    };

    const orderResponse = await brokerService.placeOrder(orderData);
    
    if (orderResponse.stat === 'Ok') {
      res.status(200).json({
        success: true,
        message: 'Order placed successfully',
        data: {
          orderId: orderResponse.norenordno,
          brokerName,
          symbol,
          action,
          quantity,
          orderType,
          price,
          triggerPrice,
          exchange,
          status: 'PLACED',
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: orderResponse.emsg || 'Failed to place order',
      });
    }
  } catch (error: any) {
    console.error('🚨 Place order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to place order',
    });
  }
};

export const getOrderBook = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { brokerName } = req.params;
    const userId = req.user?.id;

    if (!userId || !brokerName) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or broker name missing',
      });
      return;
    }

    const userConnections = userBrokerConnections.get(userId);
    if (!userConnections || !userConnections.has(brokerName)) {
      res.status(404).json({
        success: false,
        message: `Not connected to ${brokerName}`,
      });
      return;
    }

    const brokerService = userConnections.get(brokerName)!;
    const orderBook = await brokerService.getOrderBook(userId);
    
    res.status(200).json({
      success: true,
      data: orderBook,
    });
  } catch (error: any) {
    console.error('🚨 Get order book error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get order book',
    });
  }
};

export const getPositions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { brokerName } = req.params;
    const userId = req.user?.id;

    if (!userId || !brokerName) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or broker name missing',
      });
      return;
    }

    const userConnections = userBrokerConnections.get(userId);
    if (!userConnections || !userConnections.has(brokerName)) {
      res.status(404).json({
        success: false,
        message: `Not connected to ${brokerName}`,
      });
      return;
    }

    const brokerService = userConnections.get(brokerName)!;
    const positions = await brokerService.getPositions(userId);
    
    res.status(200).json({
      success: true,
      data: positions,
    });
  } catch (error: any) {
    console.error('🚨 Get positions error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get positions',
    });
  }
};

export const searchSymbol = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { brokerName, exchange, symbol } = req.params;
    const userId = req.user?.id;

    if (!userId || !brokerName || !exchange || !symbol) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or missing parameters',
      });
      return;
    }

    const userConnections = userBrokerConnections.get(userId);
    if (!userConnections || !userConnections.has(brokerName)) {
      res.status(404).json({
        success: false,
        message: `Not connected to ${brokerName}`,
      });
      return;
    }

    const brokerService = userConnections.get(brokerName)!;
    const searchResults = await brokerService.searchScrip(exchange, symbol);
    
    res.status(200).json({
      success: true,
      data: searchResults,
    });
  } catch (error: any) {
    console.error('🚨 Search symbol error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to search symbol',
    });
  }
};

export const getQuotes = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { brokerName, exchange, token } = req.params;
    const userId = req.user?.id;

    if (!userId || !brokerName || !exchange || !token) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or missing parameters',
      });
      return;
    }

    const userConnections = userBrokerConnections.get(userId);
    if (!userConnections || !userConnections.has(brokerName)) {
      res.status(404).json({
        success: false,
        message: `Not connected to ${brokerName}`,
      });
      return;
    }

    const brokerService = userConnections.get(brokerName)!;
    const quotes = await brokerService.getQuotes(exchange, token);
    
    res.status(200).json({
      success: true,
      data: quotes,
    });
  } catch (error: any) {
    console.error('🚨 Get quotes error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get quotes',
    });
  }
};
