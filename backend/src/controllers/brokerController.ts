/**
 * Controller for broker account connection, order placement, and account/session management.
 * Handles all broker-agnostic API endpoints for the backend.
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { ShoonyaService, ShoonyaCredentials } from '../integrations/shoonya';
import { FyersService, FyersCredentials } from '../integrations/fyers';
import { userDatabase } from '../services/databaseCompatibility';
import { setBrokerConnectionManager } from '../services/orderStatusService';
import orderStatusService from '../services/orderStatusService';
import { getBrokerService, BrokerKey } from '../services/brokerFactory';
import { brokerConfigs } from '../services/brokerConfig';
import { IBrokerService } from '../interfaces/IBrokerService';

// Store broker connections per user (in production, use Redis or database)
export const userBrokerConnections = new Map<string, Map<string, IBrokerService>>();

/**
 * Auto-reactivate account if session is expired
 * Returns true if account is active/reactivated, false if reactivation failed
 */
async function ensureAccountActive(userId: string, accountId: string): Promise<boolean> {
  try {
    console.log(`🔄 Ensuring account ${accountId} is active for user ${userId}`);

    // Get account details from database
    const account = await userDatabase.getConnectedAccountById(accountId);
    if (!account) {
      console.log(`❌ Account ${accountId} not found in database`);
      return false;
    }

    // Check if connection exists and is valid
    const userConnections = userBrokerConnections.get(userId);
    const connectionKey = `${account.broker_name}_${account.account_id}`;
    const existingConnection = userConnections?.get(connectionKey);

    if (existingConnection) {
      // Test if existing connection is still valid
      try {
        const isValid = await existingConnection.validateSession(account.account_id);
        if (isValid) {
          console.log(`✅ Account ${accountId} session is already valid`);
          return true;
        } else {
          console.log(`⚠️ Account ${accountId} session is invalid, removing connection`);
          userConnections?.delete(connectionKey);
        }
      } catch (error: any) {
        console.log(`⚠️ Session validation failed for ${accountId}:`, error.message);
        userConnections?.delete(connectionKey);
      }
    }

    // Auto-reactivate the account
    console.log(`🔄 Auto-reactivating account ${accountId}...`);

    // Get decrypted credentials
    const credentials = await userDatabase.getAccountCredentials(accountId);
    if (!credentials) {
      console.log(`❌ Failed to retrieve credentials for account ${accountId}`);
      return false;
    }

    // Initialize user connections if not exists
    if (!userBrokerConnections.has(userId)) {
      userBrokerConnections.set(userId, new Map());
    }
    const userConnectionsMap = userBrokerConnections.get(userId)!;

    // Use the broker factory to instantiate the service
    let brokerService: IBrokerService;
    let loginResponse: any;
    try {
      brokerService = getBrokerService(account.broker_name as BrokerKey, brokerConfigs[account.broker_name as BrokerKey]);
      loginResponse = await brokerService.login(credentials);
    } catch (e) {
      console.log(`❌ Unsupported broker: ${account.broker_name}`);
      return false;
    }

    // Store the connection with account-specific key if login is successful
    // Assume a successful login returns a property 'success' or 'stat' === 'Ok'
    const loginOk = loginResponse?.success === true || loginResponse?.stat === 'Ok';
    if (loginOk) {
      userConnectionsMap.set(connectionKey, brokerService);
      addToBrokerAccountCache(
        account.account_id, // broker account ID
        userId, // user ID
        account.broker_name, // broker name
        account.user_name // user display name
      );
      console.log(`✅ Successfully auto-reactivated ${account.broker_name} account ${accountId}`);
      return true;
    } else {
      console.log(`❌ Failed to auto-reactivate ${account.broker_name} account ${accountId}:`, loginResponse?.emsg || loginResponse?.message);
      return false;
    }
  } catch (error: any) {
    console.error(`🚨 Auto-reactivation failed for account ${accountId}:`, error.message);
    return false;
  }
}

// Broker Account Cache: Maps broker account IDs to user IDs and broker info
interface BrokerAccountMapping {
  userId: string;
  brokerName: string;
  accountId: string;
  userDisplayName: string;
}

const brokerAccountCache = new Map<string, BrokerAccountMapping>();

// Cache Management Functions
const addToBrokerAccountCache = (accountId: string, userId: string, brokerName: string, userDisplayName: string) => {
  brokerAccountCache.set(accountId, {
    userId,
    brokerName,
    accountId,
    userDisplayName
  });
  console.log(`📝 Added to broker cache: ${accountId} -> User ${userId} (${brokerName})`);
};

const removeFromBrokerAccountCache = (accountId: string) => {
  const removed = brokerAccountCache.delete(accountId);
  if (removed) {
    console.log(`🗑️ Removed from broker cache: ${accountId}`);
  }
};

const getBrokerAccountFromCache = (accountId: string): BrokerAccountMapping | null => {
  return brokerAccountCache.get(accountId) || null;
};

// Initialize broker account cache from database
export const initializeBrokerAccountCache = async () => {
  try {
    console.log('🔄 Initializing broker account cache from database...');

    // This would need to be implemented in the database layer
    // For now, we'll populate it as accounts are connected
    console.log('📝 Broker account cache initialized (will populate as accounts connect)');
  } catch (error) {
    console.error('🚨 Failed to initialize broker account cache:', error);
  }
};

// Populate cache when user connects (called during login/session restore)
export const populateCacheForUser = async (userId: string) => {
  try {
    const accounts = await userDatabase.getConnectedAccountsByUserId(userId);
    for (const account of accounts) {
      addToBrokerAccountCache(
        account.account_id,
        userId,
        account.broker_name,
        account.user_name
      );
    }
    console.log(`📝 Populated cache for user ${userId}: ${accounts.length} accounts`);
  } catch (error) {
    console.error(`🚨 Failed to populate cache for user ${userId}:`, error);
  }
};

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

/**
 * Connects a broker account for a user.
 * @route POST /api/broker/connect
 */
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

    // Use the broker factory to create the service
    let brokerService: IBrokerService;
    let loginResponse: any;
    try {
      brokerService = getBrokerService(brokerName as BrokerKey, brokerConfigs[brokerName as BrokerKey]);
    } catch (e) {
      res.status(400).json({
        success: false,
        message: 'Unsupported broker',
      });
      return;
    }
    loginResponse = await brokerService.login(credentials);

    // Shoonya and Fyers have different login flows, handle generically
    if (loginResponse.success) {
      userConnections.set(brokerName, brokerService);
      let accountInfo = brokerService.extractAccountInfo(loginResponse, credentials);
      try {
        const dbAccount = await userDatabase.createConnectedAccount({
          user_id: userId,
          broker_name: brokerName,
          account_id: accountInfo.accountId,
          user_name: accountInfo.userName,
          email: accountInfo.email,
          broker_display_name: accountInfo.brokerDisplayName,
          exchanges: accountInfo.exchanges,
          products: accountInfo.products,
          credentials: credentials,
        });
        addToBrokerAccountCache(
          accountInfo.accountId,
          userId,
          brokerName,
          accountInfo.userName
        );
      } catch (dbError: any) {
        console.error('Failed to save account to database:', dbError.message);
      }
      res.status(200).json({
        success: true,
        message: `Successfully connected to ${brokerName}`,
        data: {
          brokerName,
          userId: credentials.userId || credentials.clientId,
          accountId: accountInfo.accountId,
          userName: accountInfo.userName,
          email: accountInfo.email,
          brokerDisplayName: accountInfo.brokerDisplayName,
          lastAccessTime: loginResponse.lastaccesstime,
          exchanges: accountInfo.exchanges,
          products: accountInfo.products,
        },
      });
    } else if (loginResponse.authUrl) {
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
      res.status(400).json({
        success: false,
        message: loginResponse.emsg || loginResponse.message || 'Failed to connect to broker',
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

/**
 * Validates the Fyers OAuth auth code and completes connection.
 * @route POST /api/broker/validate-fyers-auth
 */
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

/**
 * Gets all connected broker accounts for a user.
 * @route GET /api/broker/accounts
 */
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
      const dbAccounts = await userDatabase.getConnectedAccountsByUserId(userId);

      // Validate session status for each account in real-time
      const accountsWithValidatedStatus = await Promise.all(
        dbAccounts.map(async (dbAccount: any) => {
          let isReallyActive = false;

          // Check if broker service exists in memory and validate session
          const userConnections = userBrokerConnections.get(userId);
          const connectionKey = `${dbAccount.broker_name}_${dbAccount.account_id}`;
          const brokerService = userConnections?.get(connectionKey);

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
                userConnections?.delete(connectionKey);
                isReallyActive = false;
              }
            } catch (validationError: any) {
              console.error(`🚨 Session validation error for ${dbAccount.broker_name}:`, validationError.message);
              // On validation error, remove from memory and mark as inactive
              userConnections?.delete(connectionKey);
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

/**
 * Checks the session status for a specific broker account.
 * @route GET /api/broker/accounts/:accountId/status
 */
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

    // Get account from database
    const account = await userDatabase.getConnectedAccountById(accountId);
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
    const connectionKey = `${account.broker_name}_${account.account_id}`;
    const brokerService = userConnections?.get(connectionKey);

    if (brokerService) {
      try {
        let sessionValid = await brokerService.validateSession(account.account_id);
        if (sessionValid) {
          isActive = true;
          sessionInfo = {
            lastChecked: new Date().toISOString(),
            status: 'active',
            message: 'Session is valid and active',
          };
        } else {
          // Remove from memory if session is invalid
          userConnections?.delete(connectionKey);
          sessionInfo = {
            lastChecked: new Date().toISOString(),
            status: 'expired',
            message: 'Session has expired',
          };
        }
      } catch (validationError: any) {
        console.error(`🚨 Session validation error for ${account.broker_name}:`, validationError.message);
        // On validation error, remove from memory
        userConnections?.delete(connectionKey);
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

/**
 * Removes a connected broker account.
 * @route DELETE /api/broker/accounts/:accountId
 */
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
      // Get account details before deletion for logout
      const account = await userDatabase.getConnectedAccountById(accountId);
      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Account not found',
        });
        return;
      }

      // Perform actual logout from broker and remove from in-memory connections
      const userConnections = userBrokerConnections.get(userId);
      const connectionKey = `${account.broker_name}_${account.account_id}`;
      if (userConnections && userConnections.has(connectionKey)) {
        const brokerService = userConnections.get(connectionKey);
        try {
          if (brokerService) {
            await brokerService.logout(account.account_id);
          }
          console.log('✅ Successfully logged out from broker:', account.broker_name);
        } catch (logoutError: any) {
          console.error('⚠️ Logout error (continuing with removal):', logoutError.message);
        }
        userConnections.delete(connectionKey);
        console.log('✅ Removed from in-memory connections:', connectionKey);
      }

      // Delete from database
      const deleted = await userDatabase.deleteConnectedAccount(accountId);
      if (!deleted) {
        res.status(404).json({
          success: false,
          message: 'Account not found',
        });
        return;
      }

      // Remove from broker account cache
      removeFromBrokerAccountCache(account.account_id);

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

/**
 * Activates a broker account (re-authenticates).
 * @route POST /api/broker/accounts/:accountId/activate
 */
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

    // Get account from database
    const account = await userDatabase.getConnectedAccountById(accountId);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    // Get decrypted credentials
    const credentials = await userDatabase.getAccountCredentials(accountId);
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

    // Use the broker factory to instantiate the service
    let brokerService: IBrokerService;
    let loginResponse: any;
    try {
      brokerService = getBrokerService(account.broker_name as BrokerKey, brokerConfigs[account.broker_name as BrokerKey]);
      loginResponse = await brokerService.login(credentials);
    } catch (e) {
      res.status(400).json({
        success: false,
        message: `Broker ${account.broker_name} not supported for activation`,
      });
      return;
    }
    if (loginResponse.success) {
      // Store the connection with account-specific key to support multiple accounts per broker
      const connectionKey = `${account.broker_name}_${account.account_id}`;
      userConnections.set(connectionKey, brokerService);
      // Add to broker account cache for fast lookups
      addToBrokerAccountCache(
        account.account_id, // broker account ID
        userId, // user ID
        account.broker_name, // broker name
        account.user_name // user display name
      );
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
  } catch (error: any) {
    console.error('🚨 Activate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate account',
    });
  }
};

/**
 * Deactivates a broker account (logs out).
 * @route POST /api/broker/accounts/:accountId/deactivate
 */
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

    // Get account from database
    const account = await userDatabase.getConnectedAccountById(accountId);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    // Perform actual logout from broker
    const userConnections = userBrokerConnections.get(userId);
    const connectionKey = `${account.broker_name}_${account.account_id}`;
    if (userConnections && userConnections.has(connectionKey)) {
      const brokerService = userConnections.get(connectionKey);
      try {
        if (brokerService) {
          await brokerService.logout(account.account_id);
        }
        console.log('✅ Successfully logged out from broker:', account.broker_name);
      } catch (logoutError: any) {
        console.error('⚠️ Logout error (continuing anyway):', logoutError.message);
      }
      // Remove from in-memory connections using account-specific key
      userConnections.delete(connectionKey);
      console.log('✅ Removed from in-memory connections:', connectionKey);
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

/**
 * Disconnects a broker account for a user.
 * @route POST /api/broker/disconnect
 */
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
const ensureBrokerConnection = async (userId: string, brokerName: string): Promise<IBrokerService | null> => {
  // Check if connection already exists in memory
  const userConnections = userBrokerConnections.get(userId);
  if (userConnections && userConnections.has(brokerName)) {
    return userConnections.get(brokerName)!;
  }

  // Connection not in memory, try to re-establish it
  console.log(`🔄 Re-establishing connection for ${brokerName} user ${userId}`);

  // Get all accounts for this user and broker
  const userAccounts = await userDatabase.getConnectedAccountsByUserId(userId);
  const brokerAccount = userAccounts.find((account: any) => account.broker_name === brokerName);

  if (!brokerAccount) {
    console.log(`❌ No ${brokerName} account found for user ${userId}`);
    return null;
  }

  // Get decrypted credentials
  const credentials = await userDatabase.getAccountCredentials(brokerAccount.id.toString());
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
    let brokerService: IBrokerService;
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

/**
 * Places an order for a connected broker account.
 * @route POST /api/broker/order
 */
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
    const account = await userDatabase.getConnectedAccountById(accountId);
    if (!account || account.user_id.toString() !== userId.toString()) {
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

    // Ensure account is active (auto-reactivate if needed)
    const isAccountActive = await ensureAccountActive(userId, accountId);
    if (!isAccountActive) {
      res.status(400).json({
        success: false,
        message: `Failed to activate ${brokerName} account ${account.account_id}. Please check your credentials and try again.`,
      });
      return;
    }

    // Get the account-specific broker connection (should be available after auto-reactivation)
    const userConnections = userBrokerConnections.get(userId);
    const connectionKey = `${brokerName}_${account.account_id}`;
    const brokerService = userConnections?.get(connectionKey);

    if (!brokerService) {
      res.status(500).json({
        success: false,
        message: `Internal error: Connection not found after activation for ${brokerName} account ${account.account_id}.`,
      });
      return;
    }
    let orderResponse: any;

    // Build a generic order input object
    const orderInput = {
      userId: account.account_id,
      symbol,
      action,
      quantity: parseInt(quantity),
      orderType,
      price: price ? parseFloat(price) : 0,
      triggerPrice: triggerPrice ? parseFloat(triggerPrice) : 0,
      exchange: exchange || 'NSE',
      productType,
      remarks: remarks || `Order placed via CopyTrade Pro for account ${account.account_id}`,
      // Add any other fields needed by all brokers
    };

    // Place the order using the broker service
    orderResponse = await brokerService.placeOrder(orderInput);
    if (orderResponse.success) {
      // Use brokerService.extractOrderInfo to get order info for history and monitoring
      const orderInfo = brokerService.extractOrderInfo(orderResponse, orderInput);
      try {
        const orderHistoryData = {
          user_id: userId,
          account_id: account.id.toString(),
          broker_name: brokerName,
          broker_order_id: orderInfo.brokerOrderId,
          symbol: symbol,
          action: action as 'BUY' | 'SELL',
          quantity: parseInt(quantity),
          price: price ? parseFloat(price) : 0,
          order_type: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
          status: 'PLACED' as const,
          exchange: exchange || 'NSE',
          product_type: productType || 'C',
          remarks: remarks || `Order placed via CopyTrade Pro`,
          executed_at: new Date().toISOString(),
        };
        const savedOrder = await userDatabase.createOrderHistory(orderHistoryData);
        // Add order to real-time monitoring
        const orderForMonitoring = {
          id: savedOrder.id.toString(),
          user_id: userId,
          account_id: account.id.toString(),
          symbol: symbol,
          action: action,
          quantity: parseInt(quantity),
          price: price ? parseFloat(price) : 0,
          status: 'PLACED',
          broker_name: brokerName,
          broker_order_id: orderInfo.brokerOrderId,
          order_type: orderType,
          exchange: exchange || 'NSE',
          product_type: productType || 'C',
          remarks: remarks || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await orderStatusService.addOrderToMonitoring(orderForMonitoring);
      } catch (historyError: any) {
        console.error('⚠️ Failed to save order history:', historyError.message);
      }
      res.status(200).json({
        success: true,
        message: 'Order placed successfully (awaiting execution)',
        data: {
          orderId: orderInfo.brokerOrderId,
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
        message: orderResponse.message || orderResponse.emsg || 'Failed to place order',
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

/**
 * Gets the order history for a user with optional filters.
 * @route GET /api/broker/order-history
 */
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

    // Build filter options (no default filtering - let frontend handle defaults)
    const filterOptions = {
      status: status as string,
      symbol: symbol as string,
      brokerName: brokerName as string,
      startDate: startDate as string,
      endDate: endDate as string,
      action: action as 'BUY' | 'SELL',
      search: search as string,
    };

    const orderHistory = await userDatabase.getOrderHistoryByUserIdWithFilters(
      userId, // Keep as string for MongoDB ObjectId
      parseInt(limit as string),
      parseInt(offset as string),
      filterOptions
    );

    const totalCount = await userDatabase.getOrderCountByUserIdWithFilters(
      userId, // Keep as string for MongoDB ObjectId
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

/**
 * Gets the status of a specific order from the broker API.
 * @route GET /api/broker/order-status/:brokerOrderId
 */
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
    const accounts = await userDatabase.getConnectedAccountsByUserId(userId);
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

    // Use the generic interface for order status
    try {
      const status = await brokerService.getOrderStatus(brokerAccount.account_id, brokerOrderId);
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to fetch order status',
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
      userId, // Keep as string for MongoDB ObjectId
      searchTerm.trim()
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

/**
 * Manually checks the status of an order and updates it if changed.
 * @route POST /api/broker/order-status/check
 */
export const checkOrderStatus = async (
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

    const { orderId } = req.body;

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    console.log(`🔍 Manual status check requested for order: ${orderId} by user: ${userId}`);

    // Get order from database
    const order = await userDatabase.getOrderHistoryById(orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Verify order belongs to the requesting user
    if (order.user_id.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied - order belongs to different user',
      });
      return;
    }

    console.log(`📊 Found order: ${order.symbol} (${order.broker_order_id}) - Current status: ${order.status}`);

    // Use the order status service to check current status
    const orderForMonitoring = {
      id: order.id.toString(),
      user_id: order.user_id.toString(),
      account_id: order.account_id.toString(),
      symbol: order.symbol,
      action: order.action,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      broker_name: order.broker_name,
      broker_order_id: order.broker_order_id,
      order_type: order.order_type,
      exchange: order.exchange,
      product_type: order.product_type,
      remarks: order.remarks || '',
      created_at: order.created_at,
      updated_at: order.created_at,
    };

    // Import the order status service
    const orderStatusService = (await import('../services/orderStatusService')).default;

    // Check the order status manually
    await orderStatusService.checkOrderStatus(orderForMonitoring);

    // Get the updated order from database
    const updatedOrder = await userDatabase.getOrderHistoryById(orderId);

    if (!updatedOrder) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve updated order status',
      });
      return;
    }

    const statusChanged = updatedOrder.status !== order.status;

    console.log(`✅ Manual status check completed for order ${orderId}: ${order.status} → ${updatedOrder.status}${statusChanged ? ' (CHANGED)' : ' (NO CHANGE)'}`);

    res.status(200).json({
      success: true,
      message: statusChanged
        ? `Order status updated from ${order.status} to ${updatedOrder.status}`
        : `Order status confirmed as ${updatedOrder.status}`,
      data: {
        orderId: updatedOrder.id,
        previousStatus: order.status,
        currentStatus: updatedOrder.status,
        statusChanged,
        order: {
          id: updatedOrder.id,
          symbol: updatedOrder.symbol,
          action: updatedOrder.action,
          quantity: updatedOrder.quantity,
          price: updatedOrder.price,
          order_type: updatedOrder.order_type,
          status: updatedOrder.status,
          exchange: updatedOrder.exchange,
          broker_name: updatedOrder.broker_name,
          broker_order_id: updatedOrder.broker_order_id,
          executed_at: updatedOrder.executed_at,
          created_at: updatedOrder.created_at,
        },
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error: any) {
    console.error('🚨 Manual order status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check order status',
      error: error.message,
    });
  }
};

/**
 * Gets the order book for a broker account.
 * @route GET /api/broker/orders/:brokerName
 */
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

/**
 * Gets all open/current positions for a broker account.
 * @route GET /api/broker/positions/:brokerName
 */
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

/**
 * Searches for a symbol or scrip on a broker.
 * @route GET /api/broker/search/:brokerName/:exchange/:symbol
 */
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

/**
 * Gets live quotes for a symbol/token from a broker.
 * @route GET /api/broker/quotes/:brokerName/:exchange/:token
 */
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

// Broker Connection Manager for Order Status Service
const brokerConnectionManagerImpl = {
  getBrokerConnection(brokerAccountId: string, brokerName: string): IBrokerService | null {
    console.log(`🔍 Looking for broker connection: brokerAccountId=${brokerAccountId}, brokerName=${brokerName}`);
    try {
      const accountMapping = getBrokerAccountFromCache(brokerAccountId);
      if (!accountMapping) {
        console.log(`❌ Account ${brokerAccountId} not found in cache`);
        return null;
      }
      if (accountMapping.brokerName !== brokerName) {
        console.log(`❌ Broker name mismatch: expected ${brokerName}, found ${accountMapping.brokerName}`);
        return null;
      }
      const userConnections = userBrokerConnections.get(accountMapping.userId);
      if (!userConnections) {
        console.log(`❌ No active connections found for user ${accountMapping.userId}`);
        return null;
      }
      // Use brokerName as the key for userConnections
      const service = userConnections.get(brokerName) ?? null;
      if (service) {
        console.log(`✅ Found ${brokerName} service for user ${accountMapping.userId} (${accountMapping.userDisplayName})`);
        return service;
      }
      console.log(`❌ Service not found for user ${accountMapping.userId}`);
      return null;
    } catch (error) {
      console.error(`🚨 Error in getBrokerConnection:`, error);
      return null;
    }
  }
};

// Set the broker connection manager for the order status service
setBrokerConnectionManager(brokerConnectionManagerImpl);
