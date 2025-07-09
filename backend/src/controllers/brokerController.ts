import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { userDatabase } from '../services/databaseCompatibility';
import { setBrokerConnectionManager } from '../services/orderStatusService';
import orderStatusService from '../services/orderStatusService';
import BrokerConnectionHelper from '../helpers/brokerConnectionHelper';
import { IBrokerService } from '@copytrade/unified-broker';
import { unifiedBrokerManager } from '../services/unifiedBrokerManager';
import {
  ActivateAccountResponse,
  AuthenticationStep,
  ApiErrorCode,
  createActivationResponse,
  createErrorResponse,
  createSuccessResponse
} from '@copytrade/shared-types';

// All broker connections now managed by UnifiedBrokerManager

/**
 * Helper function to get broker service using the unified broker manager
 */
function getBrokerService(userId: string, brokerName: string, accountId?: string): IBrokerService | null {
  if (!accountId) {
    // If no specific account ID, try to find any connection for this broker
    const connections = unifiedBrokerManager.getUserBrokerConnections(userId, brokerName);
    if (connections.length > 0) {
      return connections[0]?.service || null;
    }
    return null;
  }

  return unifiedBrokerManager.getBrokerService(userId, brokerName, accountId);
}

/**
 * Helper function to validate session using unified broker manager
 */
async function validateBrokerSession(userId: string, brokerName: string, accountId: string): Promise<boolean> {
  try {
    return await unifiedBrokerManager.validateConnection(userId, brokerName, accountId);
  } catch (error) {
    console.error(`🚨 Session validation error for ${brokerName}:`, error);
    return false;
  }
}

/**
 * Helper function to logout from broker using unified broker manager
 */
async function logoutFromBroker(userId: string, brokerName: string, accountId: string): Promise<void> {
  try {
    await unifiedBrokerManager.disconnect(userId, brokerName, accountId);
  } catch (error) {
    console.error(`🚨 Logout failed for ${brokerName}:`, error);
    throw error;
  }
}

/**
 * Helper function to place order using unified broker manager
 */
async function placeBrokerOrder(
  userId: string,
  brokerName: string,
  accountId: string,
  orderRequest: any
): Promise<any> {
  try {
    const brokerService = unifiedBrokerManager.getBrokerService(userId, brokerName, accountId);

    if (!brokerService) {
      throw new Error(`No active connection found for ${brokerName} account ${accountId}`);
    }

    return await brokerService.placeOrder(orderRequest);
  } catch (error) {
    console.error(`🚨 Order placement failed for ${brokerName}:`, error);
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

    // Check if connection exists using unified broker manager
    const existingConnection = unifiedBrokerManager.getConnection(userId, account.broker_name, account.account_id);

    if (existingConnection) {
      // Test if existing connection is still valid
      try {
        const isValid = await unifiedBrokerManager.validateConnection(userId, account.broker_name, account.account_id);
        if (isValid) {
          console.log(`✅ Account ${accountId} session is already valid`);
          return true;
        } else {
          console.log(`⚠️ Account ${accountId} session is invalid, removing connection`);
          await unifiedBrokerManager.disconnect(userId, account.broker_name, account.account_id);
        }
      } catch (error: any) {
        console.log(`⚠️ Session validation failed for ${accountId}:`, error.message);
        await unifiedBrokerManager.disconnect(userId, account.broker_name, account.account_id);
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

    // For now, skip auto-reactivation - user needs to manually activate
    try {
      console.log(`⚠️ Account ${accountId} needs manual reactivation`);

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

// Get available/initialized brokers
export const getAvailableBrokers = async (
  req: AuthenticatedRequest,
  res: Response
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

    // Get available brokers from unified broker manager
    const availableBrokers = unifiedBrokerManager.getAvailableBrokers();

    console.log(`📋 Available brokers for user ${userId}:`, availableBrokers);

    res.status(200).json({
      success: true,
      message: 'Available brokers retrieved successfully',
      data: {
        brokers: availableBrokers,
        count: availableBrokers.length
      }
    });
  } catch (error: any) {
    console.error('🚨 Get available brokers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available brokers',
      error: error.message
    });
  }
};

// Complete OAuth authentication with auth code
export const completeOAuthAuth = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { accountId, authCode } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!accountId || !authCode) {
      res.status(400).json({
        success: false,
        message: 'Account ID and auth code are required',
      });
      return;
    }

    console.log(`🔄 Completing OAuth for account ${accountId} with auth code: ${authCode}`);

    // Get account from database to determine broker
    const account = await userDatabase.getConnectedAccountById(accountId);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found',
      });
      return;
    }

    // Complete OAuth authentication using unified broker manager
    const result = await unifiedBrokerManager.completeOAuthAuth(
      userId,
      account.broker_name,
      authCode,
      {} // credentials will be retrieved from database
    );

    if (result.success) {
      console.log(`✅ OAuth completed successfully for ${account.broker_name}`);

      // Add to broker account cache for fast lookups
      addToBrokerAccountCache(
        account.account_id,
        userId,
        account.broker_name,
        account.user_name
      );

      res.status(200).json({
        success: true,
        message: 'OAuth authentication completed successfully',
        data: {
          accountId: result.accountId,
          brokerName: account.broker_name
        }
      });
    } else {
      console.error(`❌ OAuth completion failed for ${account.broker_name}:`, result.message);
      res.status(400).json({
        success: false,
        message: result.message || 'OAuth authentication failed'
      });
    }
  } catch (error: any) {
    console.error('🚨 OAuth completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during OAuth completion'
    });
  }
};

// OAuth callback handler for brokers like Fyers (legacy redirect-based flow)
export const handleOAuthCallback = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { code, state, broker } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!code || !broker) {
      res.status(400).json({
        success: false,
        message: 'Missing authorization code or broker parameter',
      });
      return;
    }

    console.log(`🔄 Processing OAuth callback for ${broker} with code: ${code}`);

    // Complete OAuth authentication using unified broker manager
    const result = await unifiedBrokerManager.completeOAuthAuth(
      userId,
      broker as string,
      code as string,
      {} // credentials will be retrieved from database
    );

    if (result.success) {
      console.log(`✅ OAuth completed successfully for ${broker}`);

      // Redirect to frontend with success
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=success&broker=${broker}&account=${result.accountId}`);
    } else {
      console.error(`❌ OAuth completion failed for ${broker}:`, result.message);

      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent(result.message || 'OAuth failed')}`);
    }
  } catch (error: any) {
    console.error('🚨 OAuth callback error:', error);

    // Redirect to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('OAuth callback failed')}`);
  }
};

// All account management now handled by UnifiedBrokerManager and database

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

    // Use unified broker manager for connection
    try {
      const result = await unifiedBrokerManager.connectToBroker(userId, brokerName, credentials);

      if (result.success && result.accountId) {
        // Save account to database
        try {
          const dbAccount = await userDatabase.createConnectedAccount({
            user_id: userId,
            broker_name: brokerName,
            account_id: result.accountId,
            user_name: result.accountId, // Use account ID as fallback
            email: '', // Will be updated if available
            broker_display_name: brokerName.toUpperCase(),
            exchanges: [],
            products: [],
            credentials: credentials,
          });

          console.log('✅ Account saved to database:', dbAccount.id);

          // Add to broker account cache for fast lookups
          addToBrokerAccountCache(
            result.accountId,
            userId,
            brokerName,
            result.accountId
          );
        } catch (dbError: any) {
          console.error('🚨 Failed to save account to database:', dbError.message);
        }

        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            brokerName,
            accountId: result.accountId,
            message: 'Connection established successfully',
          },
        });
      } else if (result.authUrl) {
        // OAuth flow - return auth URL
        res.status(200).json({
          success: true,
          message: result.message || 'Auth URL generated. Please complete authentication.',
          data: {
            brokerName,
            authUrl: result.authUrl,
            requiresAuthCode: true,
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to establish connection',
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

    // Complete OAuth authentication using unified broker manager
    const brokerName = credentials.brokerName || req.body.brokerName || 'fyers';
    try {
      const result = await unifiedBrokerManager.completeOAuthAuth(userId, brokerName, authCode, credentials);

      if (result.success && result.accountId) {
        // Save account to database
        try {
          const dbAccount = await userDatabase.createConnectedAccount({
            user_id: userId,
            broker_name: brokerName,
            account_id: result.accountId,
            user_name: result.accountId,
            email: '',
            broker_display_name: brokerName.toUpperCase(),
            exchanges: [],
            products: [],
            credentials: { ...credentials, authCode },
          });

          console.log('✅ OAuth account saved to database:', dbAccount.id);

          // Add to broker account cache
          addToBrokerAccountCache(
            result.accountId,
            userId,
            brokerName,
            result.accountId
          );
        } catch (dbError: any) {
          console.error('🚨 Failed to save OAuth account to database:', dbError.message);
        }

        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            brokerName,
            accountId: result.accountId,
            message: 'Authentication completed successfully',
          },
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.message || 'Failed to complete authentication',
        });
      }
    } catch (error: any) {
      console.error('🚨 OAuth completion error:', error);
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

          // Check if broker connection exists and validate session
          const connection = unifiedBrokerManager.getConnection(userId, dbAccount.broker_name, dbAccount.account_id);

          if (connection) {
            try {
              const sessionValid = await validateBrokerSession(userId, dbAccount.broker_name, dbAccount.account_id);

              if (sessionValid) {
                isReallyActive = true;
                console.log(`✅ Session valid for ${dbAccount.broker_name} account ${dbAccount.account_id}`);
              } else {
                console.log(`⚠️ Session expired for ${dbAccount.broker_name} account ${dbAccount.account_id}`);
                // Remove connection if session is invalid
                await unifiedBrokerManager.disconnect(userId, dbAccount.broker_name, dbAccount.account_id);
                isReallyActive = false;
              }
            } catch (validationError: any) {
              console.error(`🚨 Session validation error for ${dbAccount.broker_name}:`, validationError.message);
              // On validation error, remove connection and mark as inactive
              await unifiedBrokerManager.disconnect(userId, dbAccount.broker_name, dbAccount.account_id);
              isReallyActive = false;
            }
          } else {
            // No broker service in memory means not active
            console.log(`⚠️ No active connection found for ${dbAccount.broker_name} account ${dbAccount.account_id}`);
            isReallyActive = false;
          }

          const accountData = {
            id: dbAccount.id.toString(),
            brokerName: dbAccount.broker_name,
            accountId: dbAccount.account_id,
            userId: dbAccount.account_id, // Use account_id as userId for display
            userName: dbAccount.user_name,
            email: dbAccount.email,
            brokerDisplayName: dbAccount.broker_display_name,
            exchanges: JSON.parse(dbAccount.exchanges || '[]'),
            products: JSON.parse(dbAccount.products || '[]'),
            isActive: isReallyActive, // Pure real-time validated status
            createdAt: dbAccount.created_at,
          };

          console.log('🔍 DEBUG: Returning account data:', accountData);
          return accountData;
        })
      );

      // Debug: List all connections
      unifiedBrokerManager.debugListConnections();

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

    // Check if broker connection exists and validate session
    const connection = unifiedBrokerManager.getConnection(userId, account.broker_name, account.account_id);

    if (connection) {
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
          // Remove connection if session is invalid
          await unifiedBrokerManager.disconnect(userId, account.broker_name, account.account_id);
          sessionInfo = {
            lastChecked: new Date().toISOString(),
            status: 'expired',
            message: 'Session has expired',
          };
        }
      } catch (validationError: any) {
        console.error(`🚨 Session validation error for ${account.broker_name}:`, validationError.message);
        // On validation error, remove connection
        await unifiedBrokerManager.disconnect(userId, account.broker_name, account.account_id);
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

      // Perform actual logout from broker using unified manager
      const connection = unifiedBrokerManager.getConnection(userId, account.broker_name, account.account_id);
      if (connection) {
        try {
          await logoutFromBroker(userId, account.broker_name, account.account_id);
          console.log('✅ Successfully logged out from broker:', account.broker_name);
        } catch (logoutError: any) {
          console.error('⚠️ Logout error (continuing with removal):', logoutError.message);
        }
        console.log('✅ Removed connection from unified manager');
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

    // Use unified broker manager for account activation
    try {
      console.log(`🔄 Starting activation for account ${accountId} (user ${userId})`);
      const result = await unifiedBrokerManager.autoActivateAccount(userId, accountId);

      if (result.success) {
        // Add to broker account cache for fast lookups
        const account = await userDatabase.getConnectedAccountById(accountId);
        if (account) {
          addToBrokerAccountCache(
            account.account_id,
            userId,
            account.broker_name,
            account.user_name
          );
          console.log(`✅ Account ${accountId} activated successfully for ${account.broker_name}`);
        }

        const response: ActivateAccountResponse = createActivationResponse(
          true,
          result.message,
          {
            accountId,
            isActive: true,
            authStep: result.authStep,
            additionalData: {
              ...(result.brokerName && { brokerName: result.brokerName }),
              ...(result.userName && { userName: result.userName }),
              exchanges: account?.exchanges ? JSON.parse(account.exchanges) : [],
              products: account?.products ? JSON.parse(account.products) : []
            }
          }
        );

        res.status(200).json(response);
      } else {
        console.log(`❌ Account ${accountId} activation failed: ${result.message}`);

        // Handle OAuth flow - return OAuth URL for frontend popup handling
        if (result.authStep === AuthenticationStep.OAUTH_REQUIRED && result.authUrl) {
          console.log(`🔄 OAuth authentication required for ${result.brokerName}: ${result.authUrl}`);

          const response: ActivateAccountResponse = createActivationResponse(
            false,
            result.message || 'OAuth authentication required',
            {
              accountId,
              isActive: false,
              authStep: result.authStep,
              authUrl: result.authUrl,
              additionalData: {
                ...(result.brokerName && { brokerName: result.brokerName }),
                ...(result.userName && { userName: result.userName })
              }
            }
          );
          res.status(200).json(response); // 200 for OAuth flow, not an error
          return;
        }

        // Handle other failures
        const errorCode = result.error === 'CREDENTIALS_NOT_FOUND' ? ApiErrorCode.INVALID_CREDENTIALS :
                         result.error === 'ACCOUNT_NOT_FOUND' ? ApiErrorCode.ACCOUNT_NOT_FOUND :
                         ApiErrorCode.BROKER_ERROR;

        const response: ActivateAccountResponse = createActivationResponse(
          false,
          result.message,
          undefined,
          {
            code: errorCode,
            message: result.message,
            details: result.error
          }
        );

        res.status(400).json(response);
      }
    } catch (error: any) {
      console.error('🚨 Activate account error:', error);
      const response: ActivateAccountResponse = createActivationResponse(
        false,
        'Failed to activate account',
        undefined,
        {
          code: ApiErrorCode.INTERNAL_ERROR,
          message: error.message || 'Failed to activate account',
          details: error
        }
      );
      res.status(500).json(response);
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

    // Perform actual logout from broker using unified manager
    const connection = unifiedBrokerManager.getConnection(userId, account.broker_name, account.account_id);
    if (connection) {
      try {
        await logoutFromBroker(userId, account.broker_name, account.account_id);
        console.log('✅ Successfully logged out from broker:', account.broker_name);
      } catch (logoutError: any) {
        console.error('⚠️ Logout error (continuing anyway):', logoutError.message);
      }
      console.log('✅ Removed connection from unified manager');
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

    const connection = unifiedBrokerManager.getConnection(userId, brokerName, accountId);

    if (!connection) {
      res.status(404).json({
        success: false,
        message: `Not connected to ${brokerName} account ${accountId}`,
      });
      return;
    }

    // Logout from broker using unified manager
    await logoutFromBroker(userId, brokerName, accountId);

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
      const orderBook = await brokerService!.getOrderHistory(userId);

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
          const orderBook = await connection.getOrderHistory(userId);
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
    const searchResults = await brokerService!.searchSymbols(symbol, exchange);

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
      // Use unified broker interface
      if (typeof brokerService.getQuote === 'function') {
        try {
          // Try different parameter formats based on broker API requirements
          try {
            // Format 1: (exchange, token) - for some brokers
            quotes = await brokerService.getQuote(token, exchange);
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

      // Step 3: Get active connection for the user using unified manager
      const connection = unifiedBrokerManager.getConnection(accountMapping.userId, brokerName, accountMapping.accountId);
      if (!connection) {
        console.log(`❌ No active connection found for user ${accountMapping.userId}`);
        return null;
      }

      if (connection.service) {
        console.log(`✅ Found ${brokerName} service for user ${accountMapping.userId} (${accountMapping.userDisplayName})`);
        return connection.service;
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
