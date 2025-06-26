import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { ShoonyaService, ShoonyaCredentials } from '../services/shoonyaService';
import { FyersService } from '../services/fyersService';

// Store broker connections per user (in production, use Redis or database)
type BrokerService = ShoonyaService | FyersService;
const userBrokerConnections = new Map<string, Map<string, BrokerService>>();

// Store connected account data per user
interface ConnectedAccount {
  id: string;
  brokerName: string;
  accountId: string;
  userId: string;
  userName: string;
  email: string;
  brokerDisplayName: string;
  exchanges: string[];
  products: any[];
  isActive: boolean;
  createdAt: Date;
  accessToken?: string;
}

const userConnectedAccounts = new Map<string, ConnectedAccount[]>();

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

    console.log('🔍 Connect broker request:', { brokerName, userId, credentialsKeys: Object.keys(credentials || {}) });

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

    // Create broker service instance based on broker type
    let brokerService: BrokerService;
    let loginResponse: any;

    if (brokerName === 'shoonya') {
      brokerService = new ShoonyaService();
      loginResponse = await brokerService.login(credentials as ShoonyaCredentials);

      if (loginResponse.stat === 'Ok') {
        // Store the connection
        userConnections.set(brokerName, brokerService);

        // Create account data
        const accountData: ConnectedAccount = {
          id: Date.now().toString(),
          brokerName,
          accountId: loginResponse.actid,
          userId: credentials.userId,
          userName: loginResponse.uname,
          email: loginResponse.email,
          brokerDisplayName: loginResponse.brkname,
          exchanges: loginResponse.exarr || [],
          products: loginResponse.prarr || [],
          isActive: true,
          createdAt: new Date(),
        };

        // Store the account data
        if (!userConnectedAccounts.has(userId)) {
          userConnectedAccounts.set(userId, []);
        }
        const userAccounts = userConnectedAccounts.get(userId)!;

        // Remove existing account for this broker if any
        const filteredAccounts = userAccounts.filter(acc => acc.brokerName !== brokerName);
        filteredAccounts.push(accountData);
        userConnectedAccounts.set(userId, filteredAccounts);

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
    } else if (brokerName === 'fyers') {
      brokerService = new FyersService();
      loginResponse = await brokerService.login(credentials);

      if (loginResponse.success && loginResponse.authUrl) {
        // Store the service instance for later use
        userConnections.set(brokerName, brokerService);

        res.status(200).json({
          success: true,
          message: 'Auth URL generated. Please complete authentication.',
          data: {
            brokerName,
            authUrl: loginResponse.authUrl,
            message: loginResponse.message,
            requiresAuthCode: true,
          },
        });
      } else {
        res.status(401).json({
          success: false,
          message: loginResponse.message || 'Authentication failed',
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported broker',
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

export const validateFyersAuthCode = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { authCode, credentials } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!authCode) {
      res.status(400).json({
        success: false,
        message: 'Auth code is required',
      });
      return;
    }

    // Get the existing Fyers service instance
    const userConnections = userBrokerConnections.get(userId);
    const fyersService = userConnections?.get('fyers') as FyersService;

    if (!fyersService) {
      res.status(400).json({
        success: false,
        message: 'No pending Fyers authentication found. Please start the connection process again.',
      });
      return;
    }

    // Generate access token using the auth code
    const tokenResponse = await fyersService.generateAccessToken(authCode, credentials);

    if (tokenResponse.success) {
      res.status(200).json({
        success: true,
        message: 'Successfully connected to Fyers',
        data: {
          brokerName: 'fyers',
          accessToken: tokenResponse.accessToken,
          message: tokenResponse.message,
        },
      });
    } else {
      res.status(401).json({
        success: false,
        message: tokenResponse.message || 'Failed to validate auth code',
      });
    }
  } catch (error: any) {
    console.error('🚨 Validate Fyers auth code error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Get all connected accounts for a user
export const getConnectedAccounts = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Get connected accounts for this user
    const userAccounts = userConnectedAccounts.get(userId) || [];

    res.status(200).json({
      success: true,
      accounts: userAccounts,
    });
  } catch (error: any) {
    console.error('🚨 Get connected accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Save a connected account
export const saveConnectedAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const accountData = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // For now, just return the account with an ID - in production, save to database
    const savedAccount = {
      ...accountData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };

    res.status(200).json({
      success: true,
      data: savedAccount,
    });
  } catch (error: any) {
    console.error('🚨 Save connected account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Remove a connected account
export const removeConnectedAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Remove account from storage
    const userAccounts = userConnectedAccounts.get(userId) || [];
    const filteredAccounts = userAccounts.filter(acc => acc.id !== accountId);
    userConnectedAccounts.set(userId, filteredAccounts);

    // Also remove broker connection if it exists
    const userConnections = userBrokerConnections.get(userId);
    if (userConnections) {
      const accountToRemove = userAccounts.find(acc => acc.id === accountId);
      if (accountToRemove) {
        userConnections.delete(accountToRemove.brokerName);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Account removed successfully',
    });
  } catch (error: any) {
    console.error('🚨 Remove connected account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
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
    let orderResponse: any;

    if (brokerName === 'shoonya') {
      // Map order type for Shoonya
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

      const shoonyaOrderData = {
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

      orderResponse = await (brokerService as ShoonyaService).placeOrder(shoonyaOrderData);
    } else if (brokerName === 'fyers') {
      // Map order type for Fyers
      let fyersOrderType: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
      switch (orderType) {
        case 'LIMIT':
          fyersOrderType = 'LIMIT';
          break;
        case 'MARKET':
          fyersOrderType = 'MARKET';
          break;
        case 'SL-LIMIT':
          fyersOrderType = 'SL';
          break;
        case 'SL-MARKET':
          fyersOrderType = 'SL-M';
          break;
        default:
          fyersOrderType = 'MARKET';
      }

      const fyersOrderData = {
        symbol: `${exchange}:${symbol}`,
        qty: parseInt(quantity),
        type: fyersOrderType,
        side: action as 'BUY' | 'SELL',
        productType: (productType === 'C' ? 'CNC' : productType) as 'CNC' | 'INTRADAY' | 'MARGIN' | 'CO' | 'BO',
        limitPrice: price ? parseFloat(price) : 0,
        stopPrice: triggerPrice ? parseFloat(triggerPrice) : 0,
        validity: 'DAY' as const,
      };

      orderResponse = await (brokerService as FyersService).placeOrder(fyersOrderData);
    }
    
    // Handle response based on broker type
    if (brokerName === 'shoonya') {
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
    } else if (brokerName === 'fyers') {
      if (orderResponse.s === 'ok') {
        res.status(200).json({
          success: true,
          message: 'Order placed successfully',
          data: {
            orderId: orderResponse.id,
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
          message: orderResponse.message || 'Failed to place order',
        });
      }
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
    let quotes: any;

    if (brokerName === 'shoonya') {
      quotes = await (brokerService as ShoonyaService).getQuotes(exchange, token);
    } else if (brokerName === 'fyers') {
      quotes = await (brokerService as FyersService).getQuotes([`${exchange}:${token}`]);
    }
    
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
