import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { ShoonyaService, ShoonyaCredentials } from '../services/shoonyaService';
import { FyersService, FyersCredentials } from '../services/fyersService';
import { userDatabase } from '../services/databaseCompatibility';
import { setBrokerConnectionManager } from '../services/orderStatusService';
import orderStatusService from '../services/orderStatusService';

// Store broker connections per user (in production, use Redis or database)
type BrokerService = ShoonyaService | FyersService;
export const userBrokerConnections = new Map<string, Map<string, BrokerService>>();

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

        // Save account to database
        try {
          const dbAccount = await userDatabase.createConnectedAccount({
            user_id: parseInt(userId),
            broker_name: brokerName,
            account_id: loginResponse.actid,
            user_name: loginResponse.uname,
            email: loginResponse.email,
            broker_display_name: loginResponse.brkname,
            exchanges: loginResponse.exarr || [],
            products: loginResponse.prarr || [],
            credentials: credentials, // Will be encrypted in database
          });

          console.log('✅ Account saved to database:', dbAccount.id);
        } catch (dbError: any) {
          console.error('🚨 Failed to save account to database:', dbError.message);
          // Continue with response even if DB save fails
        }

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

// Get all connected accounts for a user with pure real-time session validation
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

    // Get connected accounts from database (no is_active field - pure real-time validation)
    try {
      const dbAccounts = await userDatabase.getConnectedAccountsByUserId(parseInt(userId));

      // Validate session status for each account in real-time
      const accountsWithValidatedStatus = await Promise.all(
        dbAccounts.map(async (dbAccount: any) => {
          let isReallyActive = false;

          // Check if broker service exists in memory and validate session
          const userConnections = userBrokerConnections.get(userId);
          const brokerService = userConnections?.get(dbAccount.broker_name);

          if (brokerService) {
            try {
              let sessionValid = false;

              if (dbAccount.broker_name === 'shoonya') {
                sessionValid = await (brokerService as ShoonyaService).validateSession(dbAccount.account_id);
              } else if (dbAccount.broker_name === 'fyers') {
                sessionValid = await (brokerService as FyersService).validateSession();
              }

              if (sessionValid) {
                isReallyActive = true;
                console.log(`✅ Session valid for ${dbAccount.broker_name} account ${dbAccount.account_id}`);
              } else {
                console.log(`⚠️ Session expired for ${dbAccount.broker_name} account ${dbAccount.account_id}`);
                // Remove from memory if session is invalid
                userConnections?.delete(dbAccount.broker_name);
                isReallyActive = false;
              }
            } catch (validationError: any) {
              console.error(`🚨 Session validation error for ${dbAccount.broker_name}:`, validationError.message);
              // On validation error, remove from memory and mark as inactive
              userConnections?.delete(dbAccount.broker_name);
              isReallyActive = false;
            }
          } else {
            // No broker service in memory means not active
            console.log(`⚠️ No active connection found for ${dbAccount.broker_name} account ${dbAccount.account_id}`);
            isReallyActive = false;
          }

          return {
            id: dbAccount.id.toString(),
            brokerName: dbAccount.broker_name,
            accountId: dbAccount.account_id,
            userId: dbAccount.account_id, // Use account_id as userId for display
            userName: dbAccount.user_name,
            email: dbAccount.email,
            brokerDisplayName: dbAccount.broker_display_name,
            exchanges: JSON.parse(dbAccount.exchanges),
            products: JSON.parse(dbAccount.products),
            isActive: isReallyActive, // Pure real-time validated status
            createdAt: dbAccount.created_at,
          };
        })
      );

      res.status(200).json({
        success: true,
        accounts: accountsWithValidatedStatus,
      });
    } catch (dbError: any) {
      console.error('🚨 Failed to fetch accounts from database:', dbError.message);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch connected accounts',
      });
    }
  } catch (error: any) {
    console.error('🚨 Get connected accounts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Check session status for a specific account (for UI refresh)
export const checkAccountSessionStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.params;

    if (!userId || !accountId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or account ID missing',
      });
      return;
    }

    const accountIdNum = parseInt(accountId);

    // Get account from database
    const account = await userDatabase.getConnectedAccountById(accountIdNum);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    let isActive = false;
    let sessionInfo = {
      lastChecked: new Date().toISOString(),
      status: 'inactive',
      message: 'No active session found',
    };

    // Check if broker service exists in memory and validate session
    const userConnections = userBrokerConnections.get(userId);
    const brokerService = userConnections?.get(account.broker_name);

    if (brokerService) {
      try {
        let sessionValid = false;

        if (account.broker_name === 'shoonya') {
          sessionValid = await (brokerService as ShoonyaService).validateSession(account.account_id);
        } else if (account.broker_name === 'fyers') {
          sessionValid = await (brokerService as FyersService).validateSession();
        }

        if (sessionValid) {
          isActive = true;
          sessionInfo = {
            lastChecked: new Date().toISOString(),
            status: 'active',
            message: 'Session is valid and active',
          };
        } else {
          // Remove from memory if session is invalid
          userConnections?.delete(account.broker_name);
          sessionInfo = {
            lastChecked: new Date().toISOString(),
            status: 'expired',
            message: 'Session has expired',
          };
        }
      } catch (validationError: any) {
        console.error(`🚨 Session validation error for ${account.broker_name}:`, validationError.message);
        // On validation error, remove from memory
        userConnections?.delete(account.broker_name);
        sessionInfo = {
          lastChecked: new Date().toISOString(),
          status: 'error',
          message: `Validation error: ${validationError.message}`,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        accountId: account.id,
        brokerName: account.broker_name,
        isActive,
        sessionInfo,
      },
    });
  } catch (error: any) {
    console.error('🚨 Check session status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check session status',
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

    if (!userId || !accountId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or account ID missing',
      });
      return;
    }

    // Remove account from database and logout
    try {
      const accountIdNum = parseInt(accountId);

      // Get account details before deletion for logout
      const account = await userDatabase.getConnectedAccountById(accountIdNum);
      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Account not found',
        });
        return;
      }

      // Perform actual logout from broker and remove from in-memory connections
      const userConnections = userBrokerConnections.get(userId);
      if (userConnections && userConnections.has(account.broker_name)) {
        const brokerService = userConnections.get(account.broker_name);

        try {
          if (account.broker_name === 'shoonya' && brokerService) {
            await (brokerService as ShoonyaService).logout(account.account_id);
          } else if (account.broker_name === 'fyers' && brokerService) {
            await (brokerService as FyersService).logout();
          }
          console.log('✅ Successfully logged out from broker:', account.broker_name);
        } catch (logoutError: any) {
          console.error('⚠️ Logout error (continuing with removal):', logoutError.message);
        }

        userConnections.delete(account.broker_name);
        console.log('✅ Removed from in-memory connections:', account.broker_name);
      }

      // Delete from database
      const deleted = await userDatabase.deleteConnectedAccount(accountIdNum);
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Account not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Account removed and logged out successfully',
      });
    } catch (dbError: any) {
      console.error('🚨 Failed to remove account:', dbError.message);
      res.status(500).json({
        success: false,
        message: 'Failed to remove account',
      });
    }
  } catch (error: any) {
    console.error('🚨 Remove connected account error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Activate an account (re-authenticate)
export const activateAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.params;

    if (!userId || !accountId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or account ID missing',
      });
      return;
    }

    const accountIdNum = parseInt(accountId);

    // Get account from database
    const account = userDatabase.getConnectedAccountById(accountIdNum);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    // Get decrypted credentials
    const credentials = await userDatabase.getAccountCredentials(accountIdNum);
    if (!credentials) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve account credentials',
      });
      return;
    }

    // Initialize user connections if not exists
    if (!userBrokerConnections.has(userId)) {
      userBrokerConnections.set(userId, new Map());
    }
    const userConnections = userBrokerConnections.get(userId)!;

    // Try to authenticate with the broker
    let brokerService: BrokerService;
    let loginResponse: any;

    if (account.broker_name === 'shoonya') {
      brokerService = new ShoonyaService();
      loginResponse = await brokerService.login(credentials as ShoonyaCredentials);

      if (loginResponse.stat === 'Ok') {
        // Store the connection (status is determined by real-time validation)
        userConnections.set(account.broker_name, brokerService);

        res.status(200).json({
          success: true,
          message: `Successfully activated ${account.broker_name} account`,
          data: {
            accountId: account.id,
            brokerName: account.broker_name,
            isActive: true,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: loginResponse.emsg || 'Failed to authenticate with broker',
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: `Broker ${account.broker_name} not supported for activation`,
      });
    }
  } catch (error: any) {
    console.error('🚨 Activate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate account',
    });
  }
};

// Deactivate an account (logout only)
export const deactivateAccount = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { accountId } = req.params;

    if (!userId || !accountId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or account ID missing',
      });
      return;
    }

    const accountIdNum = parseInt(accountId);

    // Get account from database
    const account = userDatabase.getConnectedAccountById(accountIdNum);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    // Perform actual logout from broker
    const userConnections = userBrokerConnections.get(userId);
    if (userConnections && userConnections.has(account.broker_name)) {
      const brokerService = userConnections.get(account.broker_name);

      try {
        if (account.broker_name === 'shoonya' && brokerService) {
          await (brokerService as ShoonyaService).logout(account.account_id);
        } else if (account.broker_name === 'fyers' && brokerService) {
          await (brokerService as FyersService).logout();
        }
        console.log('✅ Successfully logged out from broker:', account.broker_name);
      } catch (logoutError: any) {
        console.error('⚠️ Logout error (continuing anyway):', logoutError.message);
      }

      // Remove from in-memory connections
      userConnections.delete(account.broker_name);
      console.log('✅ Removed from in-memory connections:', account.broker_name);
    }

    // Note: No database status update needed - status is determined by real-time validation

    res.status(200).json({
      success: true,
      message: `Successfully deactivated ${account.broker_name} account`,
      data: {
        accountId: account.id,
        brokerName: account.broker_name,
        isActive: false,
      },
    });
  } catch (error: any) {
    console.error('🚨 Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate account',
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

// Helper function to ensure broker connection is active
const ensureBrokerConnection = async (userId: string, brokerName: string): Promise<BrokerService | null> => {
  // Check if connection already exists in memory
  const userConnections = userBrokerConnections.get(userId);
  if (userConnections && userConnections.has(brokerName)) {
    return userConnections.get(brokerName)!;
  }

  // Connection not in memory, try to re-establish it
  console.log(`🔄 Re-establishing connection for ${brokerName} user ${userId}`);

  // Get all accounts for this user and broker
  const userAccounts = await userDatabase.getConnectedAccountsByUserId(parseInt(userId));
  const brokerAccount = userAccounts.find((account: any) => account.broker_name === brokerName);

  if (!brokerAccount) {
    console.log(`❌ No ${brokerName} account found for user ${userId}`);
    return null;
  }

  // Get decrypted credentials
  const credentials = await userDatabase.getAccountCredentials(typeof brokerAccount.id === 'string' ? parseInt(brokerAccount.id) : brokerAccount.id);
  if (!credentials) {
    console.log(`❌ Failed to retrieve credentials for ${brokerName} account ${brokerAccount.id}`);
    return null;
  }

  try {
    // Initialize user connections if not exists
    if (!userBrokerConnections.has(userId)) {
      userBrokerConnections.set(userId, new Map());
    }
    const userConnectionsMap = userBrokerConnections.get(userId)!;

    // Try to authenticate with the broker
    let brokerService: BrokerService;
    let loginResponse: any;

    if (brokerName === 'shoonya') {
      brokerService = new ShoonyaService();
      loginResponse = await brokerService.login(credentials as ShoonyaCredentials);
    } else if (brokerName === 'fyers') {
      brokerService = new FyersService();
      loginResponse = await brokerService.login(credentials as FyersCredentials);
    } else {
      console.log(`❌ Unsupported broker: ${brokerName}`);
      return null;
    }

    // Store the connection
    userConnectionsMap.set(brokerName, brokerService);
    console.log(`✅ Successfully re-established ${brokerName} connection for user ${userId}`);

    return brokerService;
  } catch (error: any) {
    console.error(`❌ Failed to re-establish ${brokerName} connection:`, error.message);
    return null;
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
      accountId,
      symbol,
      action,
      quantity,
      orderType,
      price,
      triggerPrice,
      exchange,
      productType: rawProductType,
      remarks
    } = req.body;

    // Convert product type to single character format if needed
    const productTypeMap: { [key: string]: string } = {
      'CNC': 'C',
      'MIS': 'M',
      'NRML': 'H',
      'BO': 'B',
      'C': 'C',
      'M': 'M',
      'H': 'H',
      'B': 'B'
    };

    const productType = productTypeMap[rawProductType] || rawProductType;
    
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Validate that the user owns the specified account
    const account = await userDatabase.getConnectedAccountById(parseInt(accountId));
    if (!account || account.user_id !== parseInt(userId)) {
      res.status(404).json({
        success: false,
        message: 'Account not found or access denied',
      });
      return;
    }

    // Verify broker name matches the account
    if (account.broker_name !== brokerName) {
      res.status(400).json({
        success: false,
        message: `Broker name mismatch. Account belongs to ${account.broker_name}, not ${brokerName}`,
      });
      return;
    }

    // Ensure broker connection is active (re-establish if needed)
    const brokerService = await ensureBrokerConnection(userId, brokerName);
    if (!brokerService) {
      res.status(404).json({
        success: false,
        message: `Failed to establish connection to ${brokerName}. Please check your account and try again.`,
      });
      return;
    }
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

      const shoonyaOrderData: import('../services/shoonyaService').PlaceOrderRequest = {
        userId: account.account_id, // Use the actual broker account ID (e.g., "FN135006")
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
        remarks: remarks || `Order placed via CopyTrade Pro for account ${account.account_id}`,
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
        // Save order to history with PLACED status
        // Note: Status is 'PLACED' because broker API success only means order was submitted,
        // not that it was executed. Actual execution depends on market conditions.
        try {
          const orderHistoryData = {
            user_id: parseInt(userId),
            account_id: account.id,
            broker_name: brokerName,
            broker_order_id: orderResponse.norenordno,
            symbol: symbol,
            action: action as 'BUY' | 'SELL',
            quantity: parseInt(quantity),
            price: price ? parseFloat(price) : 0,
            order_type: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
            status: 'PLACED' as const, // Order successfully placed, not necessarily executed
            exchange: exchange || 'NSE',
            product_type: productType || 'C',
            remarks: remarks || `Order placed via CopyTrade Pro`,
            executed_at: new Date().toISOString(), // This is placement time, not execution time
          };

          const savedOrder = await userDatabase.createOrderHistory(orderHistoryData);
          console.log('✅ Order placed and saved to history:', orderResponse.norenordno);
          console.log('ℹ️  Status: PLACED (order submitted to exchange, awaiting execution)');

          // Add order to real-time monitoring
          const orderForMonitoring = {
            id: savedOrder.id.toString(),
            user_id: parseInt(userId),
            account_id: account.id,
            symbol: symbol,
            action: action,
            quantity: parseInt(quantity),
            price: price ? parseFloat(price) : 0,
            status: 'PLACED',
            broker_name: brokerName,
            broker_order_id: orderResponse.norenordno,
            order_type: orderType,
            exchange: exchange || 'NSE',
            product_type: productType || 'C',
            remarks: remarks || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await orderStatusService.addOrderToMonitoring(orderForMonitoring);
          console.log('📊 Order added to real-time monitoring:', orderResponse.norenordno);
        } catch (historyError: any) {
          console.error('⚠️ Failed to save order history:', historyError.message);
          // Don't fail the order response if history saving fails
        }

        res.status(200).json({
          success: true,
          message: 'Order placed successfully (awaiting execution)',
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
            note: 'Order has been submitted to the exchange and is awaiting execution',
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
        // Save order to history with PLACED status
        // Note: Status is 'PLACED' because broker API success only means order was submitted,
        // not that it was executed. Actual execution depends on market conditions.
        try {
          const orderHistoryData = {
            user_id: parseInt(userId),
            account_id: account.id,
            broker_name: brokerName,
            broker_order_id: orderResponse.id,
            symbol: symbol,
            action: action as 'BUY' | 'SELL',
            quantity: parseInt(quantity),
            price: price ? parseFloat(price) : 0,
            order_type: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
            status: 'PLACED' as const, // Order successfully placed, not necessarily executed
            exchange: exchange || 'NSE',
            product_type: productType || 'C',
            remarks: remarks || `Order placed via CopyTrade Pro`,
            executed_at: new Date().toISOString(), // This is placement time, not execution time
          };

          const savedOrder = await userDatabase.createOrderHistory(orderHistoryData);
          console.log('✅ Order placed and saved to history:', orderResponse.id);
          console.log('ℹ️  Status: PLACED (order submitted to exchange, awaiting execution)');

          // Add order to real-time monitoring
          const orderForMonitoring = {
            id: savedOrder.id.toString(),
            user_id: parseInt(userId),
            account_id: account.id,
            symbol: symbol,
            action: action,
            quantity: parseInt(quantity),
            price: price ? parseFloat(price) : 0,
            status: 'PLACED',
            broker_name: brokerName,
            broker_order_id: orderResponse.id,
            order_type: orderType,
            exchange: exchange || 'NSE',
            product_type: productType || 'C',
            remarks: remarks || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await orderStatusService.addOrderToMonitoring(orderForMonitoring);
          console.log('📊 Order added to real-time monitoring:', orderResponse.id);
        } catch (historyError: any) {
          console.error('⚠️ Failed to save order history:', historyError.message);
          // Don't fail the order response if history saving fails
        }

        res.status(200).json({
          success: true,
          message: 'Order placed successfully (awaiting execution)',
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
            note: 'Order has been submitted to the exchange and is awaiting execution',
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

// Get order history for a user with filtering
export const getOrderHistory = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const {
      limit = '50',
      offset = '0',
      status,
      symbol,
      brokerName,
      startDate,
      endDate,
      action,
      search
    } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Build filter options
    const filterOptions = {
      status: status as string,
      symbol: symbol as string,
      brokerName: brokerName as string,
      startDate: startDate as string,
      endDate: endDate as string,
      action: action as 'BUY' | 'SELL',
      search: search as string,
    };

    const orderHistory = userDatabase.getOrderHistoryByUserIdWithFilters(
      parseInt(userId),
      parseInt(limit as string),
      parseInt(offset as string),
      filterOptions
    );

    const totalCount = userDatabase.getOrderCountByUserIdWithFilters(
      parseInt(userId),
      filterOptions
    );

    res.status(200).json({
      success: true,
      data: {
        orders: orderHistory,
        totalCount,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        filters: filterOptions,
      },
    });
  } catch (error: any) {
    console.error('🚨 Get order history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch order history',
    });
  }
};

// Check individual order status from broker API
export const getOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { brokerOrderId } = req.params;
    const { brokerName } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!brokerOrderId) {
      res.status(400).json({
        success: false,
        message: 'Broker order ID is required',
      });
      return;
    }

    if (!brokerName) {
      res.status(400).json({
        success: false,
        message: 'Broker name is required as query parameter',
      });
      return;
    }

    // Get the user's connected accounts
    const accounts = await userDatabase.getConnectedAccountsByUserId(parseInt(userId));
    const brokerAccount = accounts.find((account: any) => account.broker_name === brokerName);

    if (!brokerAccount) {
      res.status(404).json({
        success: false,
        message: `No ${brokerName} account found for user`,
      });
      return;
    }

    // Get the broker connection using the existing pattern
    const userConnections = userBrokerConnections.get(userId);
    if (!userConnections || !userConnections.has(brokerName as string)) {
      res.status(400).json({
        success: false,
        message: `${brokerName} broker not connected. Please activate your account first.`,
      });
      return;
    }

    const brokerService = userConnections.get(brokerName as string)!;

    if (!brokerService) {
      res.status(400).json({
        success: false,
        message: `${brokerName} broker not connected. Please activate your account first.`,
      });
      return;
    }

    // Get order status from broker API
    console.log(`📊 Checking order status for ${brokerOrderId} via API endpoint`);
    const orderStatus = await (brokerService as any).getOrderStatus(
      userId,
      brokerOrderId
    );

    if (orderStatus.stat === 'Ok') {
      res.status(200).json({
        success: true,
        data: {
          brokerOrderId,
          status: orderStatus.status,
          symbol: orderStatus.symbol,
          quantity: orderStatus.quantity,
          price: orderStatus.price,
          executedQuantity: orderStatus.executedQuantity,
          averagePrice: orderStatus.averagePrice,
          rejectionReason: orderStatus.rejectionReason,
          orderTime: orderStatus.orderTime,
          updateTime: orderStatus.updateTime,
          rawResponse: orderStatus.rawOrder
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: orderStatus.emsg || 'Order not found in broker system',
        data: {
          brokerOrderId,
          status: 'NOT_FOUND',
          details: orderStatus.emsg
        }
      });
    }
  } catch (error: any) {
    console.error('🚨 Get order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check order status',
      error: error.message
    });
  }
};

// Get search suggestions for order history
export const getOrderSearchSuggestions = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { q: searchTerm, limit = '10' } = req.query;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim().length < 1) {
      res.status(400).json({
        success: false,
        message: 'Search term is required and must be at least 1 character',
      });
      return;
    }

    const suggestions = userDatabase.getOrderSearchSuggestions(
      parseInt(userId),
      searchTerm.trim(),
      parseInt(limit as string)
    );

    res.status(200).json({
      success: true,
      data: {
        suggestions,
        searchTerm: searchTerm.trim(),
      },
    });
  } catch (error: any) {
    console.error('🚨 Get search suggestions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch search suggestions',
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

// Broker Connection Manager for Order Status Service
const brokerConnectionManagerImpl = {
  getBrokerConnection(brokerAccountId: string, brokerName: string): ShoonyaService | null {
    console.log(`🔍 Looking for broker connection: brokerAccountId=${brokerAccountId}, brokerName=${brokerName}`);
    console.log(`🔍 Available user connections:`, Array.from(userBrokerConnections.keys()));

    try {
      // Find which web user has this broker account connected
      const connectedAccount = userDatabase.getConnectedAccountByAccountId(brokerAccountId);

      if (!connectedAccount) {
        console.log(`❌ No connected account found for broker account ID: ${brokerAccountId}`);
        return null;
      }

      console.log(`🔍 Found connected account for user ${connectedAccount.user_id}, broker: ${connectedAccount.broker_name}`);

      // Check if the broker name matches
      if (connectedAccount.broker_name !== brokerName) {
        console.log(`❌ Broker name mismatch: expected ${brokerName}, found ${connectedAccount.broker_name}`);
        return null;
      }

      // Get the broker connection for this web user
      const userId = connectedAccount.user_id.toString();
      const userConnections = userBrokerConnections.get(userId);

      if (!userConnections) {
        console.log(`❌ No active connections found for user ${userId}`);
        return null;
      }

      const service = userConnections.get(brokerName);
      if (service instanceof ShoonyaService) {
        console.log(`✅ Found ${brokerName} service for user ${userId} with broker account ${brokerAccountId}`);
        return service;
      }

      console.log(`❌ Service not found or not a ShoonyaService for user ${userId}, broker ${brokerName}`);
      return null;

    } catch (error) {
      console.error(`🚨 Error in getBrokerConnection:`, error);
      return null;
    }
  }
};

// Set the broker connection manager for the order status service
setBrokerConnectionManager(brokerConnectionManagerImpl);
