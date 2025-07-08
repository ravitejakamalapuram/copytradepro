import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
// Legacy imports removed - now using unified broker interface
import { userDatabase } from '../services/databaseCompatibility';
import { setBrokerConnectionManager } from '../services/orderStatusService';
import orderStatusService from '../services/orderStatusService';
import BrokerConnectionHelper from '../helpers/brokerConnectionHelper';
import { BrokerRegistry, IBrokerService } from '@copytrade/unified-broker';

// Store broker connections per user (in production, use Redis or database)
// Legacy connection map - will be phased out in favor of brokerManager
export const userBrokerConnections = new Map<string, Map<string, any>>();

/**
 * Helper function to get broker service using the new broker manager
 * Falls back to legacy connection map for backward compatibility
 */
function getBrokerService(userId: string, brokerName: string, accountId?: string): any | null {
  // Fall back to legacy connection map for now
  const userConnections = userBrokerConnections.get(userId);
  if (userConnections) {
    const connectionKey = accountId ? `${brokerName}_${accountId}` : `${brokerName}`;
    return userConnections.get(connectionKey) || null;
  }

  return null;
}

/**
 * Helper function to validate session without hardcoded broker checks
 */
async function validateBrokerSession(userId: string, brokerName: string, accountId: string): Promise<boolean> {
  try {
    // Try new broker manager first
    const connection = brokerManager.getConnection(userId, brokerName, accountId);
    if (connection) {
      return await brokerManager.validateConnection(connection);
    }

    // Fall back to legacy validation
    const userConnections = userBrokerConnections.get(userId);
    const connectionKey = `${brokerName}_${accountId}`;
    const brokerService = userConnections?.get(connectionKey);

    if (brokerService) {
      // Use duck typing to call validateSession method
      if (typeof brokerService.validateSession === 'function') {
        try {
          // Try with accountId first (for brokers that need it)
          return await brokerService.validateSession(accountId);
        } catch (error) {
          try {
            // Fallback to no parameters (for brokers that don't need accountId)
            return await brokerService.validateSession();
          } catch (fallbackError) {
            console.warn(`Session validation failed for ${brokerName}:`, fallbackError);
            return false;
          }
        }
      }
    }

    return false;
  } catch (error) {
    console.error(`Session validation failed for ${brokerName}:`, error);
    return false;
  }
}

/**
 * Helper function to logout from broker without hardcoded broker checks
 */
async function logoutFromBroker(userId: string, brokerName: string, accountId: string): Promise<void> {
  try {
    // Try new broker manager first
    const connection = brokerManager.getConnection(userId, brokerName, accountId);
    if (connection) {
      await connection.service.logout();
      brokerManager.removeConnection(userId, connection.connectionKey);
      return;
    }

    // Fall back to legacy logout
    const userConnections = userBrokerConnections.get(userId);
    const connectionKey = `${brokerName}_${accountId}`;
    const brokerService = userConnections?.get(connectionKey);

    if (brokerService && userConnections) {
      // Use duck typing to call logout method
      if (typeof brokerService.logout === 'function') {
        try {
          // Try with accountId first (for brokers that need it)
          await brokerService.logout(accountId);
        } catch (error) {
          try {
            // Fallback to no parameters (for brokers that don't need accountId)
            await brokerService.logout();
          } catch (fallbackError) {
            console.warn(`Logout failed for ${brokerName}:`, fallbackError);
          }
        }
      }
      userConnections.delete(connectionKey);
    }
  } catch (error) {
    console.error(`Logout failed for ${brokerName}:`, error);
    throw error;
  }
}

/**
 * Helper function to place order without hardcoded broker checks
 */
async function placeBrokerOrder(
  userId: string,
  brokerName: string,
  accountId: string,
  orderRequest: any
): Promise<any> {
  try {
    // Try new broker manager first
    const connection = brokerManager.getConnection(userId, brokerName, accountId);
    if (connection) {
      return await connection.service.placeOrder(orderRequest);
    }

    // Fall back to legacy order placement
    const userConnections = userBrokerConnections.get(userId);
    const connectionKey = `${brokerName}_${accountId}`;
    const brokerService = userConnections?.get(connectionKey);

    if (!brokerService) {
      throw new Error(`No active connection found for ${brokerName} account ${accountId}`);
    }

    // Use duck typing to call placeOrder method
    if (typeof brokerService.placeOrder === 'function') {
      return await brokerService.placeOrder(orderRequest);
    } else {
      throw new Error(`Broker service does not support order placement: ${brokerName}`);
    }
  } catch (error) {
    console.error(`Order placement failed for ${brokerName}:`, error);
    throw error;
  }
}

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

    // Check if connection exists and is valid using broker manager
    const existingConnection = brokerManager.getConnection(userId, account.broker_name, account.account_id);

    if (existingConnection) {
      // Test if existing connection is still valid
      try {
        const isValid = await brokerManager.validateConnection(existingConnection);

        if (isValid) {
          console.log(`✅ Account ${accountId} session is already valid`);
          return true;
        } else {
          console.log(`⚠️ Account ${accountId} session is invalid, removing connection`);
          brokerManager.removeConnection(userId, existingConnection.connectionKey);
        }
      } catch (error: any) {
        console.log(`⚠️ Session validation failed for ${accountId}:`, error.message);
        brokerManager.removeConnection(userId, existingConnection.connectionKey);
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

    // Try to create a new broker connection using broker manager
    try {
      await brokerManager.createConnection(userId, account.broker_name, credentials);

      // Add to broker account cache for fast lookups
      addToBrokerAccountCache(
        account.account_id, // broker account ID
        userId, // user ID
        account.broker_name, // broker name
        account.user_name // user display name
      );

      console.log(`✅ Successfully auto-reactivated ${account.broker_name} account ${accountId}`);
      return true;
    } catch (error: any) {
      console.log(`❌ Failed to auto-reactivate ${account.broker_name} account ${accountId}:`, error.message);
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

// Legacy ConnectedAccount interface - will be phased out
// interface ConnectedAccount {
//   id: string;
//   brokerName: string;
//   accountId: string;
//   userId: string;
//   userName: string;
//   email: string;
//   brokerDisplayName: string;
//   exchanges: string[];
//   products: any[];
//   isActive: boolean;
//   createdAt: Date;
//   accessToken?: string;
// }

// Legacy user connected accounts map - will be phased out
// const userConnectedAccounts = new Map<string, ConnectedAccount[]>();

export const connectBroker = async (
  req: AuthenticatedRequest,
  res: Response
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

    // Check if account is already connected using broker manager
    // Try to determine account ID from credentials if available
    let potentialAccountId = credentials.userId || credentials.accountId;
    if (potentialAccountId) {
      const existingConnection = brokerManager.getConnection(userId, brokerName, potentialAccountId);
      const connectionKey = `${brokerName}_${potentialAccountId}`;

      if (existingConnection || userConnections.has(connectionKey)) {
        res.status(409).json({
          success: false,
          message: `Already connected to ${brokerName} account ${potentialAccountId}`,
        });
        return;
      }
    }

    // Use unified broker manager for connection
    try {
      const connection = await brokerManager.createConnection(userId, brokerName, credentials);
      const brokerService = connection.service;

      // For backward compatibility, also store in legacy connection map
      const connectionKey = `${brokerName}_${connection.accountId}`;
      userConnections.set(connectionKey, brokerService);

      // Handle successful connection
      if (connection.accountId) {
        // Save account to database
        try {
          const dbAccount = await userDatabase.createConnectedAccount({
            user_id: userId,
            broker_name: brokerName,
            account_id: connection.accountId,
            user_name: connection.accountId, // Use account ID as fallback
            email: '', // Will be updated if available
            broker_display_name: brokerName.toUpperCase(),
            exchanges: [],
            products: [],
            credentials: credentials,
          });

          console.log('✅ Account saved to database:', dbAccount.id);

          // Add to broker account cache for fast lookups
          addToBrokerAccountCache(
            connection.accountId,
            userId,
            brokerName,
            connection.accountId
          );
        } catch (dbError: any) {
          console.error('🚨 Failed to save account to database:', dbError.message);
        }

        res.status(200).json({
          success: true,
          message: `Successfully connected to ${brokerName}`,
          data: {
            brokerName,
            accountId: connection.accountId,
            message: 'Connection established successfully',
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to establish connection',
        });
      }
    } catch (connectionError: any) {
      // Handle broker-specific responses (like auth URL for OAuth brokers)
      if (connectionError.authUrl) {
        res.status(200).json({
          success: true,
          message: 'Auth URL generated. Please complete authentication.',
          data: {
            brokerName,
            authUrl: connectionError.authUrl,
            requiresAuthCode: true,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: connectionError.message || 'Failed to connect to broker',
        });
      }
    }
  } catch (error: any) {
    console.error('🚨 Connect broker error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to connect to broker',
    });
  }
};

export const validateBrokerAuthCode = async (
  req: AuthenticatedRequest,
  res: Response,

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

    // Use unified broker manager for auth completion
    const brokerName = credentials.brokerName || req.body.brokerName || 'fyers'; // Default for backward compatibility
    try {
      const connection = await brokerManager.createConnection(userId, brokerName, { ...credentials, authCode });

      // For backward compatibility, also store in legacy connection map
      const userConnections = userBrokerConnections.get(userId);
      if (!userConnections) {
        userBrokerConnections.set(userId, new Map());
      }
      const connectionKey = `${brokerName}_${connection.accountId}`;
      userBrokerConnections.get(userId)!.set(connectionKey, connection.service);

      res.status(200).json({
        success: true,
        message: `Successfully connected to ${brokerName}`,
        data: {
          brokerName,
          accountId: connection.accountId,
          message: 'Authentication completed successfully',
        },
      });
    } catch (error: any) {
      console.error('🚨 Validate broker auth code error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to complete authentication',
      });
    }
  } catch (error: any) {
    console.error('🚨 Validate broker auth code error:', error);
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
              const sessionValid = await validateBrokerSession(userId, dbAccount.broker_name, dbAccount.account_id);

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

// Check session status for a specific account (for UI refresh)
export const checkAccountSessionStatus = async (
  req: AuthenticatedRequest,
  res: Response,

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
        const sessionValid = await validateBrokerSession(userId, account.broker_name, account.account_id);

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
        try {
          await logoutFromBroker(userId, account.broker_name, account.account_id);
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

// Activate an account (re-authenticate)
export const activateAccount = async (
  req: AuthenticatedRequest,
  res: Response,

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

    // Try to authenticate with the broker using unified broker manager
    try {
      const connection = await brokerManager.createConnection(userId, account.broker_name, credentials);

      // For backward compatibility, also store in legacy connection map
      const connectionKey = `${account.broker_name}_${account.account_id}`;
      userConnections.set(connectionKey, connection.service);

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
    } catch (error: any) {
      console.error('🚨 Activate account error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to activate account',
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
      try {
        await logoutFromBroker(userId, account.broker_name, account.account_id);
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

export const disconnectBroker = async (
  req: AuthenticatedRequest,
  res: Response,

): Promise<void> => {
  try {
    const { brokerName, accountId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!accountId) {
      res.status(400).json({
        success: false,
        message: 'Account ID is required for disconnection',
      });
      return;
    }

    const userConnections = userBrokerConnections.get(userId);
    const connectionKey = `${brokerName}_${accountId}`;

    if (!userConnections || !userConnections.has(connectionKey)) {
      res.status(404).json({
        success: false,
        message: `Not connected to ${brokerName} account ${accountId}`,
      });
      return;
    }

    // Logout from broker
    await logoutFromBroker(userId, brokerName, accountId);

    // Remove connection
    userConnections.delete(connectionKey);

    res.status(200).json({
      success: true,
      message: `Successfully disconnected from ${brokerName} account ${accountId}`,
    });
  } catch (error: any) {
    console.error('🚨 Disconnect broker error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to disconnect from broker',
    });
  }
};

// Note: ensureBrokerConnection function removed as it's not used and doesn't support multiple accounts per broker

export const placeOrder = async (
  req: AuthenticatedRequest,
  res: Response,

): Promise<void> => {
  try {
    // Check validation errors
    const validationErrors = validationResult(req);
    if (!validationErrors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors.array(),
      });
      return;
    }

    const {
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

    // Product type will be handled by the broker adapter
    
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

    const brokerName = account.broker_name;

    // Ensure account is active (auto-reactivate if needed)
    const isAccountActive = await ensureAccountActive(userId, accountId);
    if (!isAccountActive) {
      res.status(400).json({
        success: false,
        message: `Failed to activate ${brokerName} account ${account.account_id}. Please check your credentials and try again.`,
      });
      return;
    }

    // Create unified order request
    const unifiedOrderRequest = {
      symbol,
      action: action as 'BUY' | 'SELL',
      quantity: parseInt(quantity),
      orderType: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
      price: price ? parseFloat(price) : undefined,
      triggerPrice: triggerPrice ? parseFloat(triggerPrice) : undefined,
      exchange: exchange || 'NSE',
      productType: rawProductType,
      validity: 'DAY' as 'DAY' | 'IOC' | 'GTD',
      remarks: remarks || `Order placed via CopyTrade Pro for account ${account.account_id}`,
      accountId: account.account_id
    };

    let orderResponse: any;

    try {
      // Use the unified broker interface
      orderResponse = await placeBrokerOrder(userId, brokerName, account.account_id, unifiedOrderRequest);

      // Handle session expiry with auto-retry
      if (!orderResponse.success && orderResponse.data?.errorType === 'SESSION_EXPIRED') {
        console.log(`🔄 Session expired during order placement for ${account.account_id}. Attempting auto-reactivation...`);

        // Try auto-reactivation once
        const reactivated = await ensureAccountActive(userId, accountId);
        if (reactivated) {
          console.log(`✅ Auto-reactivation successful for ${account.account_id}. Retrying order placement...`);
          orderResponse = await placeBrokerOrder(userId, brokerName, account.account_id, unifiedOrderRequest);
        } else {
          throw new Error(`Session expired and auto-reactivation failed for account ${account.account_id}. Please check your credentials.`);
        }
      }
    // Handle unified response
    if (orderResponse.success) {
      // Save order to history with PLACED status
      // Note: Status is 'PLACED' because broker API success only means order was submitted,
      // not that it was executed. Actual execution depends on market conditions.
      try {
        const orderHistoryData = {
          user_id: userId, // Keep as string for MongoDB ObjectId
          account_id: account.id.toString(), // Ensure it's a string for MongoDB ObjectId
          broker_name: brokerName,
          broker_order_id: orderResponse.data?.brokerOrderId || orderResponse.data?.orderId,
          symbol: symbol,
          action: action as 'BUY' | 'SELL',
          quantity: parseInt(quantity),
          price: price ? parseFloat(price) : 0,
          order_type: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
          status: 'PLACED' as const, // Order successfully placed, not necessarily executed
          exchange: exchange || 'NSE',
          product_type: rawProductType,
          remarks: remarks || `Order placed via CopyTrade Pro`,
          executed_at: new Date().toISOString(), // This is placement time, not execution time
        };

        const savedOrder = await userDatabase.createOrderHistory(orderHistoryData);
        const orderId = orderResponse.data?.brokerOrderId || orderResponse.data?.orderId;
        console.log('✅ Order placed and saved to history:', orderId);
        console.log('ℹ️  Status: PLACED (order submitted to exchange, awaiting execution)');

        // Add order to real-time monitoring
        const orderForMonitoring = {
          id: savedOrder.id.toString(),
          user_id: userId, // Keep as string for MongoDB ObjectId
          account_id: account.id.toString(), // Keep as string for MongoDB ObjectId
          symbol: symbol,
          action: action,
          quantity: parseInt(quantity),
          price: price ? parseFloat(price) : 0,
          status: 'PLACED',
          broker_name: brokerName,
          broker_order_id: orderId,
          order_type: orderType,
          exchange: exchange || 'NSE',
          product_type: rawProductType,
          remarks: remarks || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await orderStatusService.addOrderToMonitoring(orderForMonitoring);
        console.log('📊 Order added to real-time monitoring:', orderId);
      } catch (historyError: any) {
        console.error('⚠️ Failed to save order history:', historyError.message);
        // Don't fail the order response if history saving fails
      }

      res.status(200).json({
        success: true,
        message: orderResponse.message || 'Order placed successfully (awaiting execution)',
        data: {
          orderId: orderResponse.data?.brokerOrderId || orderResponse.data?.orderId,
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
  } catch (error: any) {
    console.error('🚨 Place order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to place order',
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

// Get order history for a user with filtering
export const getOrderHistory = async (
  req: AuthenticatedRequest,
  res: Response,

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

// Check individual order status from broker API
export const getOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,

): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { brokerOrderId } = req.params;
    const { brokerName, accountId } = req.query;

    // Validate required parameters
    if (!userId) {
      return BrokerConnectionHelper.sendAuthenticationError(res);
    }

    const missingParams: string[] = [];
    if (!brokerOrderId) missingParams.push('brokerOrderId');
    if (!brokerName) missingParams.push('brokerName');

    if (missingParams.length > 0) {
      return BrokerConnectionHelper.sendMissingParametersError(res, missingParams);
    }

    // Find broker connection (specific account if provided, or first available)
    const connectionResult = BrokerConnectionHelper.findBrokerConnection(
      userId,
      brokerName as string,
      accountId as string
    );

    if (!connectionResult.success) {
      return BrokerConnectionHelper.sendConnectionNotFoundError(
        res,
        brokerName as string,
        accountId as string
      );
    }

    const { connection: brokerService, accountId: resolvedAccountId } = connectionResult;

    // Get order status from broker API
    console.log(`📊 Checking order status for ${brokerOrderId} via ${brokerName} account ${resolvedAccountId}`);
    const orderStatus = await (brokerService as any).getOrderStatus(
      userId,
      brokerOrderId
    );

    if (orderStatus.stat === 'Ok') {
      res.status(200).json({
        success: true,
        data: {
          brokerOrderId,
          accountId: resolvedAccountId,
          brokerName,
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
          accountId: resolvedAccountId,
          brokerName,
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

): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { q: searchTerm } = req.query;

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
 * Manual order status check - allows users to manually refresh order status
 */
export const checkOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,

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

export const getOrderBook = async (
  req: AuthenticatedRequest,
  res: Response,

): Promise<void> => {
  try {
    const { brokerName } = req.params;
    const { accountId } = req.query;
    const userId = req.user?.id;

    // Validate required parameters
    if (!userId) {
      return BrokerConnectionHelper.sendAuthenticationError(res);
    }

    if (!brokerName) {
      return BrokerConnectionHelper.sendMissingParametersError(res, ['brokerName']);
    }

    // If accountId is provided, get orders for specific account
    if (accountId) {
      const connectionResult = BrokerConnectionHelper.findBrokerConnection(
        userId,
        brokerName,
        accountId as string
      );

      if (!connectionResult.success) {
        return BrokerConnectionHelper.sendConnectionNotFoundError(
          res,
          brokerName,
          accountId as string
        );
      }

      const { connection: brokerService, accountId: resolvedAccountId } = connectionResult;
      const orderBook = await brokerService!.getOrderBook(userId);

      res.status(200).json({
        success: true,
        data: {
          ...orderBook,
          accountId: resolvedAccountId,
          brokerName
        },
      });
      return;
    }

    // If no accountId provided, get orders from all accounts for this broker
    const connectionsResult = BrokerConnectionHelper.findAllBrokerConnections(userId, brokerName);

    if (!connectionsResult.success) {
      return BrokerConnectionHelper.sendConnectionNotFoundError(res, brokerName);
    }

    const { connections } = connectionsResult;
    const allOrderBooks = await Promise.all(
      connections!.map(async ({ accountId: accId, connection }) => {
        try {
          const orderBook = await connection.getOrderBook(userId);
          return {
            accountId: accId,
            brokerName,
            ...orderBook
          };
        } catch (error) {
          console.error(`🚨 Failed to get order book for account ${accId}:`, error);
          return {
            accountId: accId,
            brokerName,
            orders: [],
            error: 'Failed to fetch orders for this account'
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      data: {
        brokerName,
        accounts: allOrderBooks,
        totalAccounts: connections!.length
      },
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

): Promise<void> => {
  try {
    const { brokerName } = req.params;
    const { accountId } = req.query;
    const userId = req.user?.id;

    // Validate required parameters
    if (!userId) {
      return BrokerConnectionHelper.sendAuthenticationError(res);
    }

    if (!brokerName) {
      return BrokerConnectionHelper.sendMissingParametersError(res, ['brokerName']);
    }

    // If accountId is provided, get positions for specific account
    if (accountId) {
      const connectionResult = BrokerConnectionHelper.findBrokerConnection(
        userId,
        brokerName,
        accountId as string
      );

      if (!connectionResult.success) {
        return BrokerConnectionHelper.sendConnectionNotFoundError(
          res,
          brokerName,
          accountId as string
        );
      }

      const { connection: brokerService, accountId: resolvedAccountId } = connectionResult;
      const positions = await brokerService!.getPositions(userId);

      res.status(200).json({
        success: true,
        data: {
          ...positions,
          accountId: resolvedAccountId,
          brokerName
        },
      });
      return;
    }

    // If no accountId provided, get positions from all accounts for this broker
    const connectionsResult = BrokerConnectionHelper.findAllBrokerConnections(userId, brokerName);

    if (!connectionsResult.success) {
      return BrokerConnectionHelper.sendConnectionNotFoundError(res, brokerName);
    }

    const { connections } = connectionsResult;
    const allPositions = await Promise.all(
      connections!.map(async ({ accountId: accId, connection }) => {
        try {
          const positions = await connection.getPositions(userId);
          return {
            accountId: accId,
            brokerName,
            ...positions
          };
        } catch (error) {
          console.error(`🚨 Failed to get positions for account ${accId}:`, error);
          return {
            accountId: accId,
            brokerName,
            positions: [],
            error: 'Failed to fetch positions for this account'
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      data: {
        brokerName,
        accounts: allPositions,
        totalAccounts: connections!.length
      },
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

): Promise<void> => {
  try {
    const { brokerName, exchange, symbol } = req.params;
    const { accountId } = req.query;
    const userId = req.user?.id;

    // Validate required parameters
    if (!userId) {
      return BrokerConnectionHelper.sendAuthenticationError(res);
    }

    const missingParams: string[] = [];
    if (!brokerName) missingParams.push('brokerName');
    if (!exchange) missingParams.push('exchange');
    if (!symbol) missingParams.push('symbol');

    if (missingParams.length > 0) {
      return BrokerConnectionHelper.sendMissingParametersError(res, missingParams);
    }

    // Find broker connection (specific account if provided, or first available)
    // Symbol search is broker-wide, so any account for this broker will work
    const connectionResult = BrokerConnectionHelper.findBrokerConnection(
      userId,
      brokerName,
      accountId as string
    );

    if (!connectionResult.success) {
      return BrokerConnectionHelper.sendConnectionNotFoundError(
        res,
        brokerName,
        accountId as string
      );
    }

    const { connection: brokerService, accountId: resolvedAccountId } = connectionResult;

    console.log(`🔍 Searching symbol ${symbol} on ${exchange} via ${brokerName} account ${resolvedAccountId}`);
    const searchResults = await brokerService!.searchScrip(exchange, symbol);

    res.status(200).json({
      success: true,
      data: {
        ...searchResults,
        searchedVia: {
          accountId: resolvedAccountId,
          brokerName,
          exchange
        }
      },
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

): Promise<void> => {
  try {
    const { brokerName, exchange, token } = req.params;
    const { accountId } = req.query;
    const userId = req.user?.id;

    // Validate required parameters
    if (!userId) {
      return BrokerConnectionHelper.sendAuthenticationError(res);
    }

    const missingParams: string[] = [];
    if (!brokerName) missingParams.push('brokerName');
    if (!exchange) missingParams.push('exchange');
    if (!token) missingParams.push('token');

    if (missingParams.length > 0) {
      return BrokerConnectionHelper.sendMissingParametersError(res, missingParams);
    }

    // Find broker connection (specific account if provided, or first available)
    // Quotes are broker-wide, so any account for this broker will work
    const connectionResult = BrokerConnectionHelper.findBrokerConnection(
      userId,
      brokerName,
      accountId as string
    );

    if (!connectionResult.success) {
      return BrokerConnectionHelper.sendConnectionNotFoundError(
        res,
        brokerName,
        accountId as string
      );
    }

    const { connection: brokerService, accountId: resolvedAccountId } = connectionResult;

    console.log(`📊 Getting quotes for ${exchange}:${token} via ${brokerName} account ${resolvedAccountId}`);

    // Use unified broker interface for quotes
    const unifiedBrokerService = getBrokerService(userId, brokerName, resolvedAccountId);
    let quotes: any;

    if (unifiedBrokerService && 'getQuote' in unifiedBrokerService) {
      // Use the unified interface
      quotes = await unifiedBrokerService.getQuote(token, exchange);
    } else if (brokerService) {
      // Fall back to legacy broker-specific calls using duck typing
      if (typeof brokerService.getQuotes === 'function') {
        try {
          // Try different parameter formats based on broker API requirements
          try {
            // Format 1: (exchange, token) - for some brokers
            quotes = await brokerService.getQuotes(exchange, token);
          } catch (error) {
            // Format 2: ([exchange:token]) - for other brokers
            quotes = await (brokerService as any).getQuotes([`${exchange}:${token}`]);
          }
        } catch (error) {
          console.warn(`Quote fetching failed for ${brokerName}:`, error);
          throw error;
        }
      } else {
        throw new Error(`Broker service does not support quote fetching: ${brokerName}`);
      }
    } else {
      throw new Error(`No broker service available for ${brokerName}`);
    }

    res.status(200).json({
      success: true,
      data: {
        ...quotes,
        quotedVia: {
          accountId: resolvedAccountId,
          brokerName,
          exchange,
          token
        }
      },
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
  getBrokerConnection(brokerAccountId: string, brokerName: string): any | null {
    console.log(`🔍 Looking for broker connection: brokerAccountId=${brokerAccountId}, brokerName=${brokerName}`);

    try {
      // Step 1: Check cache for account mapping
      const accountMapping = getBrokerAccountFromCache(brokerAccountId);

      if (!accountMapping) {
        console.log(`❌ Account ${brokerAccountId} not found in cache`);
        return null;
      }

      // Step 2: Verify broker name matches
      if (accountMapping.brokerName !== brokerName) {
        console.log(`❌ Broker name mismatch: expected ${brokerName}, found ${accountMapping.brokerName}`);
        return null;
      }

      // Step 3: Get active connection for the user
      const userConnections = userBrokerConnections.get(accountMapping.userId);
      if (!userConnections) {
        console.log(`❌ No active connections found for user ${accountMapping.userId}`);
        return null;
      }

      const connectionKey = `${brokerName}_${accountMapping.accountId}`;
      const service = userConnections.get(connectionKey);
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
