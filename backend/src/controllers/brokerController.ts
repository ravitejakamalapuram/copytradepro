import { Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthenticatedRequest } from '../middleware/auth';
import { userDatabase } from '../services/databaseCompatibility';
import { setBrokerConnectionManager } from '../services/orderStatusService';
import orderStatusService from '../services/orderStatusService';
import BrokerConnectionHelper from '../helpers/brokerConnectionHelper';
import { logger } from '../utils/logger';
import { orderStatusLogger, OrderStatusLogContext } from '../services/orderStatusLogger';

import { enhancedUnifiedBrokerManager } from '../services/enhancedUnifiedBrokerManager';
import { oauthStateManager } from '../services/oauthStateManager';
import { brokerSessionManager } from '../services/brokerSessionManager';

import {
  ActivateAccountResponse,
  ApiErrorCode,
  createActivationResponse
} from '@copytrade/shared-types';
import websocketService from '../services/websocketService';
import { OrderErrorClassifier } from '../services/orderErrorClassifier';
import { orderRetryService } from '../services/orderRetryService';

// All broker connections now managed by Enhanced Unified Broker Manager

/**
 * Helper function to logout from broker using enhanced unified broker manager
 */
async function logoutFromBroker(userId: string, brokerName: string, accountId: string): Promise<void> {
  try {
    await enhancedUnifiedBrokerManager.disconnect(userId, brokerName, accountId);

    // Unregister session from health monitoring
    brokerSessionManager.unregisterSession(userId, brokerName, accountId);
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
  databaseAccountId: string,
  orderRequest: any
): Promise<any> {
  try {
    // Get account details from database to find the broker's account ID
    const account = await userDatabase.getConnectedAccountById(databaseAccountId);
    if (!account) {
      throw new Error(`Account ${databaseAccountId} not found in database`);
    }

    // Use the broker's account ID (not the database account ID) for the connection lookup
    const brokerAccountId = account.account_id;
    const brokerService = enhancedUnifiedBrokerManager.getBrokerService(userId, brokerName, brokerAccountId);

    if (!brokerService) {
      throw new Error(`No active connection found for ${brokerName} account ${brokerAccountId} (database ID: ${databaseAccountId})`);
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

    // Check if connection exists using enhanced unified broker manager
    const existingConnection = enhancedUnifiedBrokerManager.getConnection(userId, account.broker_name, account.account_id);

    if (existingConnection) {
      // Test if existing connection is still valid
      try {
        // Get credentials for validation
        const credentials = await userDatabase.getAccountCredentials(account.id);

        const validationResult = await enhancedUnifiedBrokerManager.validateSession(
          userId,
          account.broker_name,
          account.account_id,
          credentials
        );

        if (validationResult.isValid) {
          console.log(`✅ Account ${accountId} session is already valid`);
          return true;
        } else {
          console.log(`⚠️ Account ${accountId} session is invalid, removing connection`);
          await enhancedUnifiedBrokerManager.disconnect(userId, account.broker_name, account.account_id);
        }
      } catch (error: any) {
        console.log(`⚠️ Session validation failed for ${accountId}:`, error.message);
        await enhancedUnifiedBrokerManager.disconnect(userId, account.broker_name, account.account_id);
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

    // Actually connect to the broker through enhanced unified broker manager
    try {
      console.log(`🔄 Connecting to ${account.broker_name} for account ${accountId}...`);

      // Connect to broker using enhanced unified broker manager
      const connectionResult = await enhancedUnifiedBrokerManager.connectToBroker(
        userId,
        account.broker_name,
        credentials
      );

      if (connectionResult.success) {
        // Add to broker account cache for fast lookups
        addToBrokerAccountCache(
          account.account_id, // broker account ID
          userId, // user ID
          account.broker_name, // broker name
          account.user_name // user display name
        );

        console.log(`✅ Successfully auto-reactivated ${account.broker_name} account ${accountId}`);
        return true;
      } else {
        console.log(`❌ Failed to connect to ${account.broker_name}: ${connectionResult.message}`);
        return false;
      }
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

    // Get available brokers from enhanced unified broker manager
    const availableBrokers = enhancedUnifiedBrokerManager.getAvailableBrokers();

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
    const { accountId, authCode, stateToken } = req.body;
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
        message: 'Account ID and authorization code are required',
      });
      return;
    }

    console.log(`🔄 Completing OAuth for account ${accountId} with auth code: ${authCode.substring(0, 10)}...`);

    // Validate state token if provided (for enhanced security)
    if (stateToken) {
      const storedState = oauthStateManager.retrieveState(stateToken);
      if (!storedState) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OAuth state. Please try again.',
          errorType: 'AUTH_CODE_EXPIRED'
        });
        return;
      }

      // Verify state matches current request
      if (storedState.userId !== userId || storedState.accountId !== accountId) {
        res.status(400).json({
          success: false,
          message: 'OAuth state mismatch. Please try again.',
          errorType: 'AUTH_FAILED'
        });
        return;
      }

      // Clean up state after validation
      oauthStateManager.removeState(stateToken);
    }

    // Get account from database to determine broker
    const account = await userDatabase.getConnectedAccountById(accountId);
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Account not found. Please reconnect your broker account.',
        errorType: 'AUTH_FAILED'
      });
      return;
    }

    // Get decrypted credentials from database
    const credentials = await userDatabase.getAccountCredentials(accountId);
    if (!credentials) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve account credentials. Please reconnect your broker account.',
        errorType: 'AUTH_FAILED'
      });
      return;
    }

    // Complete OAuth authentication using enhanced unified broker manager
    try {
      const result = await enhancedUnifiedBrokerManager.completeOAuthAuth(
        userId,
        account.broker_name,
        authCode,
        credentials // Use decrypted credentials from database
      );

      if (result.success && result.accountInfo) {
        console.log(`✅ OAuth completed successfully for ${account.broker_name}`);

        // Update database account with complete information from standardized response
        try {
          // Update credentials with auth code for future use
          const updatedCredentials = {
            ...credentials,
            authCode: authCode,
            accessToken: result.tokenInfo?.accessToken,
            refreshToken: result.tokenInfo?.refreshToken
          };

          // Update database account with complete information
          await userDatabase.updateConnectedAccount(accountId, {
            account_id: result.accountInfo.accountId,
            user_name: result.accountInfo.userName,
            email: result.accountInfo.email || account.email,
            broker_display_name: result.accountInfo.brokerDisplayName,
            exchanges: result.accountInfo.exchanges,
            products: result.accountInfo.products,
            credentials: updatedCredentials,
            account_status: result.accountStatus,
            token_expiry_time: result.tokenInfo?.expiryTime || null
          });

          console.log(`✅ Database account ${accountId} updated with OAuth completion`);
        } catch (updateError: any) {
          console.error('⚠️ Failed to update account after OAuth completion:', updateError.message);

          // Update with minimal information if update fails
          await userDatabase.updateConnectedAccount(accountId, {
            account_id: result.accountInfo.accountId,
            user_name: result.accountInfo.userName,
            account_status: result.accountStatus,
            token_expiry_time: result.tokenInfo?.expiryTime || null
          });
        }

        // Get updated account from database
        const updatedAccount = await userDatabase.getConnectedAccountById(accountId);
        if (!updatedAccount) {
          throw new Error('Failed to retrieve updated account');
        }

        // Add to broker account cache for fast lookups
        addToBrokerAccountCache(
          updatedAccount.account_id,
          userId,
          account.broker_name,
          updatedAccount.user_name
        );

        // Set database account ID for proper mapping
        enhancedUnifiedBrokerManager.setConnectionDatabaseId(
          userId,
          account.broker_name,
          updatedAccount.account_id,
          accountId
        );

        // Register session with session manager for health monitoring
        brokerSessionManager.registerSession(
          userId,
          account.broker_name,
          updatedAccount.account_id,
          result.tokenInfo?.expiryTime
        );

        // Return standardized account object (same contract as get accounts API)
        const accountResponse = {
          id: updatedAccount.id,
          brokerName: updatedAccount.broker_name,
          accountId: updatedAccount.account_id,
          userId: updatedAccount.user_id.toString(),
          userName: updatedAccount.user_name,
          email: updatedAccount.email,
          brokerDisplayName: updatedAccount.broker_display_name,
          exchanges: JSON.parse(updatedAccount.exchanges),
          products: JSON.parse(updatedAccount.products),
          isActive: result.accountStatus === 'ACTIVE',
          accountStatus: updatedAccount.account_status,
          tokenExpiryTime: updatedAccount.token_expiry_time,
          createdAt: updatedAccount.created_at,
        };

        res.status(200).json({
          success: true,
          message: result.message || 'OAuth authentication completed successfully',
          data: accountResponse
        });
      } else {
        // OAuth completion failed - return user-friendly error response
        console.error(`❌ OAuth completion failed for ${account.broker_name}:`, result.message);

        let userFriendlyMessage = result.message;

        // Provide specific user-friendly messages based on error type
        switch (result.errorType) {
          case 'AUTH_CODE_EXPIRED':
            userFriendlyMessage = 'The authorization code has expired. Please try connecting again.';
            break;
          case 'AUTH_FAILED':
            userFriendlyMessage = 'Authentication failed. Please check your credentials and try again.';
            break;
          case 'TOKEN_EXPIRED':
            userFriendlyMessage = 'Your session has expired. Please reconnect your account.';
            break;
          case 'NETWORK_ERROR':
            userFriendlyMessage = 'Network error occurred. Please check your connection and try again.';
            break;
          case 'BROKER_ERROR':
            userFriendlyMessage = `${account.broker_name} service error. Please try again later.`;
            break;
          default:
            userFriendlyMessage = result.message || 'Authentication failed. Please try again.';
        }

        res.status(400).json({
          success: false,
          message: userFriendlyMessage,
          errorType: result.errorType,
          accountStatus: result.accountStatus,
          authenticationStep: result.authenticationStep
        });
      }
    } catch (oauthError: any) {
      console.error(`🚨 OAuth completion error for ${account.broker_name}:`, oauthError);

      // Provide user-friendly error message
      let userFriendlyMessage = 'OAuth authentication failed. Please try again.';

      if (oauthError.message?.includes('expired')) {
        userFriendlyMessage = 'The authorization code has expired. Please try connecting again.';
      } else if (oauthError.message?.includes('invalid')) {
        userFriendlyMessage = 'Invalid authorization code. Please try connecting again.';
      } else if (oauthError.message?.includes('network') || oauthError.message?.includes('timeout')) {
        userFriendlyMessage = 'Network error occurred. Please check your connection and try again.';
      }

      res.status(500).json({
        success: false,
        message: userFriendlyMessage,
        errorType: 'OAUTH_COMPLETION_ERROR'
      });
    }
  } catch (error: any) {
    console.error('🚨 OAuth completion error:', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during authentication. Please try again.',
      errorType: 'INTERNAL_ERROR'
    });
  }
};

// OAuth callback handler for brokers like Fyers (redirect-based flow)
export const handleOAuthCallback = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  try {
    const { code, state, broker, error, error_description } = req.query;
    const userId = req.user?.id;

    console.log(`🔄 OAuth callback received:`, {
      code: code ? `${code.toString().substring(0, 10)}...` : 'none',
      state: state ? `${state.toString().substring(0, 8)}...` : 'none',
      broker,
      error,
      error_description
    });

    // Handle OAuth errors from broker
    if (error) {
      console.error(`❌ OAuth error from ${broker}:`, error, error_description);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const errorMessage = error_description || error || 'OAuth authentication failed';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent(errorMessage)}`);
      return;
    }

    if (!userId) {
      console.error('❌ OAuth callback: User not authenticated');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('User session expired. Please login again.')}`);
      return;
    }

    if (!code || !broker) {
      console.error('❌ OAuth callback: Missing required parameters');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('Invalid OAuth callback parameters')}`);
      return;
    }

    // Validate state token if provided (for enhanced security)
    let accountId: string | null = null;
    if (state) {
      const storedState = oauthStateManager.retrieveState(state as string);
      if (storedState) {
        // Verify state matches current request
        if (storedState.userId === userId && storedState.brokerName === broker) {
          accountId = storedState.accountId;
          console.log(`✅ OAuth state validated for account ${accountId}`);

          // Clean up state after validation
          oauthStateManager.removeState(state as string);
        } else {
          console.error('❌ OAuth state mismatch');
          const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
          res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('OAuth state validation failed. Please try again.')}`);
          return;
        }
      } else {
        console.warn('⚠️ OAuth state not found or expired, proceeding without validation');
      }
    }

    // Find pending OAuth account in database if we don't have accountId from state
    if (!accountId) {
      try {
        const accounts = await userDatabase.getConnectedAccountsByUserId(userId);
        const pendingAccount = accounts.find(acc =>
          acc.broker_name === broker &&
          acc.account_status === 'PROCEED_TO_OAUTH'
        );

        if (pendingAccount) {
          accountId = pendingAccount.id.toString();
          console.log(`✅ Found pending OAuth account: ${accountId}`);
        }
      } catch (dbError: any) {
        console.error('⚠️ Failed to find pending OAuth account:', dbError.message);
      }
    }

    if (!accountId) {
      console.error('❌ No pending OAuth account found');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('No pending OAuth account found. Please try connecting again.')}`);
      return;
    }

    // Get account from database
    const account = await userDatabase.getConnectedAccountById(accountId);
    if (!account) {
      console.error(`❌ Account ${accountId} not found in database`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('Account not found. Please try connecting again.')}`);
      return;
    }

    // Get stored credentials
    const credentials = await userDatabase.getAccountCredentials(accountId);
    if (!credentials) {
      console.error(`❌ No credentials found for account ${accountId}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('Account credentials not found. Please try connecting again.')}`);
      return;
    }

    console.log(`🔄 Processing OAuth callback for ${broker} account ${accountId}`);

    // Complete OAuth authentication using enhanced unified broker manager
    try {
      const result = await enhancedUnifiedBrokerManager.completeOAuthAuth(
        userId,
        broker as string,
        code as string,
        credentials
      );

      if (result.success && result.accountInfo) {
        console.log(`✅ OAuth completed successfully for ${broker}`);

        // Update database account with OAuth completion
        try {
          const updatedCredentials = {
            ...credentials,
            authCode: code,
            accessToken: result.tokenInfo?.accessToken,
            refreshToken: result.tokenInfo?.refreshToken
          };

          await userDatabase.updateConnectedAccount(accountId, {
            account_id: result.accountInfo.accountId,
            user_name: result.accountInfo.userName,
            email: result.accountInfo.email || account.email,
            broker_display_name: result.accountInfo.brokerDisplayName,
            exchanges: result.accountInfo.exchanges,
            products: result.accountInfo.products,
            credentials: updatedCredentials,
            account_status: result.accountStatus,
            token_expiry_time: result.tokenInfo?.expiryTime || null
          });

          console.log(`✅ Database account ${accountId} updated after OAuth callback`);

          // Add to broker account cache
          addToBrokerAccountCache(
            result.accountInfo.accountId,
            userId,
            broker as string,
            result.accountInfo.userName
          );

          // Set database account ID for proper mapping
          enhancedUnifiedBrokerManager.setConnectionDatabaseId(
            userId,
            broker as string,
            result.accountInfo.accountId,
            accountId
          );

          // Register session with session manager for health monitoring
          brokerSessionManager.registerSession(
            userId,
            broker as string,
            result.accountInfo.accountId,
            result.tokenInfo?.expiryTime
          );

        } catch (updateError: any) {
          console.error('⚠️ Failed to update account after OAuth callback:', updateError.message);
        }

        // Redirect to frontend with success
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/account-setup?oauth=success&broker=${broker}&account=${result.accountInfo.accountId}&message=${encodeURIComponent('Account connected successfully!')}`);
      } else {
        console.error(`❌ OAuth completion failed for ${broker}:`, result.message);

        // Provide user-friendly error message
        let userFriendlyMessage = 'OAuth authentication failed. Please try again.';

        switch (result.errorType) {
          case 'AUTH_CODE_EXPIRED':
            userFriendlyMessage = 'The authorization code has expired. Please try connecting again.';
            break;
          case 'AUTH_FAILED':
            userFriendlyMessage = 'Authentication failed. Please check your credentials and try again.';
            break;
          case 'BROKER_ERROR':
            userFriendlyMessage = `${broker} service error. Please try again later.`;
            break;
          default:
            userFriendlyMessage = result.message || 'OAuth authentication failed. Please try again.';
        }

        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent(userFriendlyMessage)}`);
      }
    } catch (oauthError: any) {
      console.error(`🚨 OAuth completion error for ${broker}:`, oauthError);

      // Provide user-friendly error message
      let userFriendlyMessage = 'OAuth authentication failed. Please try again.';

      if (oauthError.message?.includes('expired')) {
        userFriendlyMessage = 'The authorization code has expired. Please try connecting again.';
      } else if (oauthError.message?.includes('invalid')) {
        userFriendlyMessage = 'Invalid authorization code. Please try connecting again.';
      } else if (oauthError.message?.includes('network') || oauthError.message?.includes('timeout')) {
        userFriendlyMessage = 'Network error occurred. Please check your connection and try again.';
      }

      // Redirect to frontend with error
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent(userFriendlyMessage)}`);
    }
  } catch (error: any) {
    console.error('🚨 OAuth callback error:', error);

    // Redirect to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('An unexpected error occurred during authentication. Please try again.')}`);
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

    // Use enhanced unified broker manager for connection
    try {
      const result = await enhancedUnifiedBrokerManager.connectToBroker(userId, brokerName, credentials);

      if (result.success && result.accountInfo) {
        // Direct authentication successful (e.g., Shoonya)
        // Store encrypted credentials only after successful authentication
        try {
          const dbAccount = await userDatabase.createConnectedAccount({
            user_id: userId,
            broker_name: brokerName,
            account_id: result.accountInfo.accountId,
            user_name: result.accountInfo.userName,
            email: result.accountInfo.email || '',
            broker_display_name: result.accountInfo.brokerDisplayName,
            exchanges: result.accountInfo.exchanges,
            products: result.accountInfo.products,
            credentials: credentials,
            account_status: result.accountStatus,
            token_expiry_time: result.tokenInfo?.expiryTime || null,
          });

          console.log('✅ Account saved to database with status:', result.accountStatus, dbAccount.id);

          // Add to broker account cache for fast lookups
          addToBrokerAccountCache(
            result.accountInfo.accountId,
            userId,
            brokerName,
            result.accountInfo.userName
          );

          // Set database account ID for proper mapping
          enhancedUnifiedBrokerManager.setConnectionDatabaseId(
            userId,
            brokerName,
            result.accountInfo.accountId,
            dbAccount.id.toString()
          );

          // Register session with session manager for health monitoring
          brokerSessionManager.registerSession(
            userId,
            brokerName,
            result.accountInfo.accountId,
            result.tokenInfo?.expiryTime
          );

          // Return standardized account object (same contract as get accounts API)
          const accountResponse = {
            id: dbAccount.id,
            brokerName: dbAccount.broker_name,
            accountId: dbAccount.account_id,
            userId: dbAccount.user_id.toString(),
            userName: dbAccount.user_name,
            email: dbAccount.email,
            brokerDisplayName: dbAccount.broker_display_name,
            exchanges: JSON.parse(dbAccount.exchanges),
            products: JSON.parse(dbAccount.products),
            isActive: result.accountStatus === 'ACTIVE',
            accountStatus: dbAccount.account_status,
            tokenExpiryTime: dbAccount.token_expiry_time,
            createdAt: dbAccount.created_at,
          };

          res.status(200).json({
            success: true,
            message: result.message,
            data: accountResponse,
          });
        } catch (dbError: any) {
          console.error('🚨 Failed to save account to database:', dbError.message);
          res.status(500).json({
            success: false,
            message: 'Authentication successful but failed to save account',
          });
        }
      } else if (result.authUrl) {
        // OAuth flow (e.g., Fyers) - save account only after successful OAuth URL generation
        // Store encrypted credentials only after successful OAuth URL generation
        try {
          // Use a temporary account ID that will be updated after OAuth completion
          const tempAccountId = `${brokerName}_${userId}_${Date.now()}`;

          // Generate state token for OAuth security
          const stateToken = oauthStateManager.generateStateToken();

          const dbAccount = await userDatabase.createConnectedAccount({
            user_id: userId,
            broker_name: brokerName,
            account_id: tempAccountId,
            user_name: tempAccountId, // Will be updated after OAuth
            email: 'oauth-pending@temp.com', // Will be updated after OAuth
            broker_display_name: brokerName.toUpperCase(),
            exchanges: [],
            products: [],
            credentials: credentials,
            account_status: result.accountStatus,
            token_expiry_time: result.tokenInfo?.expiryTime || null,
          });

          console.log('✅ OAuth account saved to database with status:', result.accountStatus, dbAccount.id);

          // Store OAuth state for secure callback handling
          oauthStateManager.storeState(
            stateToken,
            userId,
            brokerName,
            dbAccount.id.toString(),
            credentials,
            credentials.redirectUri
          );

          // Append state token to OAuth URL for security
          const secureAuthUrl = `${result.authUrl}&state=${stateToken}`;

          // Return standardized account object with OAuth URL
          const accountResponse = {
            id: dbAccount.id,
            brokerName: dbAccount.broker_name,
            accountId: dbAccount.account_id,
            userId: dbAccount.user_id.toString(),
            userName: dbAccount.user_name,
            email: dbAccount.email,
            brokerDisplayName: dbAccount.broker_display_name,
            exchanges: JSON.parse(dbAccount.exchanges),
            products: JSON.parse(dbAccount.products),
            isActive: false,
            accountStatus: dbAccount.account_status,
            tokenExpiryTime: dbAccount.token_expiry_time,
            createdAt: dbAccount.created_at,
            authUrl: secureAuthUrl,
            requiresAuthCode: result.requiresAuthCode || true,
            stateToken: stateToken, // Include state token for frontend
          };

          res.status(200).json({
            success: true,
            message: result.message,
            data: accountResponse,
          });
        } catch (dbError: any) {
          console.error('🚨 Failed to save OAuth account to database:', dbError.message);
          res.status(500).json({
            success: false,
            message: 'Failed to prepare OAuth authentication',
          });
        }
      } else {
        // Authentication failed - return standardized error response
        res.status(400).json({
          success: false,
          message: result.message,
          errorType: result.errorType,
          accountStatus: result.accountStatus,
          authenticationStep: result.authenticationStep
        });
      }
    } catch (connectionError: any) {
      console.error('🚨 Connection error:', connectionError);

      // Authentication unsuccessful or unable to create redirect URL - throw error
      res.status(400).json({
        success: false,
        message: connectionError.message || 'Failed to connect to broker',
        errorType: 'BROKER_ERROR'
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
      const result = await enhancedUnifiedBrokerManager.completeOAuthAuth(userId, brokerName, authCode, credentials);

      if (result.success && result.accountInfo?.accountId) {
        // Save account to database
        try {
          const dbAccount = await userDatabase.createConnectedAccount({
            user_id: userId,
            broker_name: brokerName,
            account_id: result.accountInfo.accountId,
            user_name: result.accountInfo.accountId,
            email: '',
            broker_display_name: brokerName.toUpperCase(),
            exchanges: [],
            products: [],
            credentials: { ...credentials, authCode },
          });

          console.log('✅ OAuth account saved to database:', dbAccount.id);

          // Add to broker account cache
          addToBrokerAccountCache(
            result.accountInfo.accountId,
            userId,
            brokerName,
            result.accountInfo.accountId
          );
        } catch (dbError: any) {
          console.error('🚨 Failed to save OAuth account to database:', dbError.message);
        }

        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            brokerName,
            accountId: result.accountInfo?.accountId || 'unknown',
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

      // Validate session status for each account using session health monitoring
      const accountsWithValidatedStatus = await Promise.all(
        dbAccounts.map(async (dbAccount: any) => {
          let isReallyActive = false;
          let sessionHealth = null;

          // Get session health metrics from session manager
          sessionHealth = brokerSessionManager.getSessionHealth(userId, dbAccount.broker_name, dbAccount.account_id);

          // Check if broker connection exists in enhanced manager
          const connection = enhancedUnifiedBrokerManager.getConnection(userId, dbAccount.broker_name, dbAccount.account_id);

          if (connection) {
            // Use session manager for validation if available, otherwise fallback to direct validation
            if (sessionHealth) {
              // Use cached health status if recent
              const timeSinceLastValidation = Date.now() - sessionHealth.lastValidated.getTime();
              if (timeSinceLastValidation < 2 * 60 * 1000) { // 2 minutes
                isReallyActive = sessionHealth.isHealthy;
                console.log(`📊 Using cached session health for ${dbAccount.broker_name} account ${dbAccount.account_id}: ${sessionHealth.isHealthy ? 'healthy' : 'unhealthy'} (score: ${sessionHealth.healthScore}%)`);
              } else {
                // Validate session using session manager
                const validationResult = await brokerSessionManager.validateSession(
                  userId,
                  dbAccount.broker_name,
                  dbAccount.account_id
                );
                isReallyActive = validationResult.isValid;
                console.log(`📊 Session validation via session manager for ${dbAccount.broker_name} account ${dbAccount.account_id}: ${validationResult.isValid ? 'valid' : 'invalid'} (score: ${validationResult.healthScore}%)`);
              }
            } else {
              // Fallback to direct validation if session manager doesn't have metrics
              try {
                // Get credentials for validation
                const credentials = await userDatabase.getAccountCredentials(dbAccount.id);

                // Use enhanced manager's validation
                const validationResult = await enhancedUnifiedBrokerManager.validateSession(
                  userId,
                  dbAccount.broker_name,
                  dbAccount.account_id,
                  credentials
                );

                if (validationResult.isValid) {
                  isReallyActive = true;
                  console.log(`✅ Session valid for ${dbAccount.broker_name} account ${dbAccount.account_id}`);

                  // Register with session manager for future monitoring
                  brokerSessionManager.registerSession(
                    userId,
                    dbAccount.broker_name,
                    dbAccount.account_id,
                    dbAccount.token_expiry_time
                  );
                } else {
                  console.log(`⚠️ Session expired for ${dbAccount.broker_name} account ${dbAccount.account_id}`);
                  // Remove connection if session is invalid
                  await enhancedUnifiedBrokerManager.disconnect(userId, dbAccount.broker_name, dbAccount.account_id);
                  brokerSessionManager.unregisterSession(userId, dbAccount.broker_name, dbAccount.account_id);
                  isReallyActive = false;
                }
              } catch (validationError: any) {
                console.error(`🚨 Session validation error for ${dbAccount.broker_name}:`, validationError.message);
                // On validation error, remove connection and mark as inactive
                await enhancedUnifiedBrokerManager.disconnect(userId, dbAccount.broker_name, dbAccount.account_id);
                brokerSessionManager.unregisterSession(userId, dbAccount.broker_name, dbAccount.account_id);
                isReallyActive = false;
              }
            }
          } else {
            // No broker service in memory means not active
            console.log(`⚠️ No active connection found for ${dbAccount.broker_name} account ${dbAccount.account_id}`);
            brokerSessionManager.unregisterSession(userId, dbAccount.broker_name, dbAccount.account_id);
            isReallyActive = false;
          }

          // Determine token expiry status for UI button logic
          const now = new Date();
          let isTokenExpired = false;
          let shouldShowActivateButton = false;
          let shouldShowDeactivateButton = false;

          // Get token info from broker connection if available
          let tokenInfo = null;
          if (connection) {
            try {
              tokenInfo = connection.service.getTokenInfo();
            } catch (error) {
              console.warn(`⚠️ Could not get token info for ${dbAccount.broker_name}:`, error);
            }
          }

          if (dbAccount.token_expiry_time) {
            // Token has an expiry time (most brokers like Fyers)
            const expiryTime = new Date(dbAccount.token_expiry_time);
            isTokenExpired = now > expiryTime;

            if (isTokenExpired) {
              shouldShowActivateButton = true;
              shouldShowDeactivateButton = false;
              isReallyActive = false; // Override active status if token is expired
            } else {
              shouldShowActivateButton = false;
              shouldShowDeactivateButton = true;
            }
          } else {
            // Token has no expiry (infinity tokens like Shoonya)
            // Use token info from broker to determine UI behavior
            if (tokenInfo && tokenInfo.expiryTime === null && !tokenInfo.canRefresh) {
              // Infinity token that doesn't need refresh (like Shoonya)
              shouldShowActivateButton = false;
              shouldShowDeactivateButton = false; // Don't show deactivate for infinity tokens
            } else {
              // Other brokers without expiry time or unknown token behavior
              shouldShowActivateButton = !isReallyActive;
              shouldShowDeactivateButton = isReallyActive;
            }
          }

          // Include session health information if available
          const healthInfo = sessionHealth ? {
            healthScore: sessionHealth.healthScore,
            lastValidated: sessionHealth.lastValidated,
            consecutiveFailures: sessionHealth.consecutiveFailures,
            averageResponseTime: Math.round(sessionHealth.averageResponseTime),
            needsRefresh: sessionHealth.needsRefresh
          } : null;

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
            accountStatus: dbAccount.account_status || 'INACTIVE',
            tokenExpiryTime: dbAccount.token_expiry_time,
            isTokenExpired,
            shouldShowActivateButton,
            shouldShowDeactivateButton,
            createdAt: dbAccount.created_at,
            sessionHealth: healthInfo, // Include session health metrics
          };

          console.log('🔍 DEBUG: Returning account data:', accountData);
          return accountData;
        })
      );

      // Debug: Enhanced manager doesn't need debug listing

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

    // Check if broker connection exists in enhanced manager
    const connection = enhancedUnifiedBrokerManager.getConnection(userId, account.broker_name, account.account_id);

    if (connection) {
      try {
        // Get credentials for validation
        const credentials = await userDatabase.getAccountCredentials(account.id);

        // Use enhanced manager's validation
        const validationResult = await enhancedUnifiedBrokerManager.validateSession(
          userId,
          account.broker_name,
          account.account_id,
          credentials
        );

        if (validationResult.isValid) {
          isActive = true;
          sessionInfo = {
            lastChecked: new Date().toISOString(),
            status: 'active',
            message: 'Session is valid and active',
          };
        } else {
          // Remove connection if session is invalid
          await enhancedUnifiedBrokerManager.disconnect(userId, account.broker_name, account.account_id);
          sessionInfo = {
            lastChecked: new Date().toISOString(),
            status: 'expired',
            message: 'Session has expired',
          };
        }
      } catch (validationError: any) {
        console.error(`🚨 Session validation error for ${account.broker_name}:`, validationError.message);
        // On validation error, remove connection
        await enhancedUnifiedBrokerManager.disconnect(userId, account.broker_name, account.account_id);
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

      // Perform actual logout from broker using enhanced manager
      const connection = enhancedUnifiedBrokerManager.getConnection(userId, account.broker_name, account.account_id);
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

    // Use enhanced unified broker manager for account activation
    try {
      console.log(`🔄 Starting activation for account ${accountId} (user ${userId})`);

      // Get account details from database
      const account = await userDatabase.getConnectedAccountById(accountId);
      if (!account) {
        throw new Error('Account not found');
      }

      // Get credentials for activation
      const credentials = await userDatabase.getAccountCredentials(accountId);

      // Use enhanced manager to connect/activate
      const result = await enhancedUnifiedBrokerManager.connectToBroker(userId, account.broker_name, credentials);

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
            authStep: 'ACTIVE' as any,
            additionalData: {
              ...(account?.broker_name && { brokerName: account.broker_name }),
              ...(result.accountInfo?.userName && { userName: result.accountInfo.userName }),
              exchanges: account?.exchanges ? JSON.parse(account.exchanges) : [],
              products: account?.products ? JSON.parse(account.products) : []
            }
          }
        );

        res.status(200).json(response);
      } else {
        console.log(`❌ Account ${accountId} activation failed: ${result.message}`);

        // Handle OAuth flow - return auth URL for redirect
        if (result.authenticationStep === 'OAUTH_REQUIRED' && result.authUrl) {
          console.log(`🔄 OAuth authentication required for ${account?.broker_name}: ${result.authUrl}`);

          // Simple response with just the auth URL
          res.status(200).json({
            success: false,
            authUrl: result.authUrl,
            message: 'OAuth authentication required'
          });
          return;
        }

        // Handle other failures
        const errorCode = ApiErrorCode.BROKER_ERROR;

        const response: ActivateAccountResponse = createActivationResponse(
          false,
          result.message,
          undefined,
          {
            code: errorCode,
            message: result.message,
            details: result.message
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

    // Perform actual logout from broker using enhanced manager
    const connection = enhancedUnifiedBrokerManager.getConnection(userId, account.broker_name, account.account_id);
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

    const connection = enhancedUnifiedBrokerManager.getConnection(userId, brokerName, accountId);

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

// Multi-account order placement
export const placeMultiAccountOrder = async (
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
      selectedAccounts, // Array of account IDs
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

    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!selectedAccounts || !Array.isArray(selectedAccounts) || selectedAccounts.length === 0) {
      res.status(400).json({
        success: false,
        message: 'At least one account must be selected',
      });
      return;
    }

    // Validate all selected accounts belong to the user
    const accounts = [];
    for (const accountId of selectedAccounts) {
      const account = await userDatabase.getConnectedAccountById(accountId);
      if (!account || account.user_id.toString() !== userId.toString()) {
        res.status(404).json({
          success: false,
          message: `Account ${accountId} not found or access denied`,
        });
        return;
      }
      accounts.push(account);
    }

    // Create unified order request template
    const baseOrderRequest = {
      symbol,
      action: action as 'BUY' | 'SELL',
      quantity: parseInt(quantity),
      orderType: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
      price: price ? parseFloat(price) : undefined,
      triggerPrice: triggerPrice ? parseFloat(triggerPrice) : undefined,
      exchange: exchange || 'NSE',
      productType: rawProductType,
      validity: 'DAY' as 'DAY' | 'IOC' | 'GTD',
      remarks: remarks || `Multi-account order placed via CopyTrade Pro`,
    };

    // Place orders on all selected accounts
    const orderResults = [];
    const successfulOrders = [];
    const failedOrders = [];

    for (const account of accounts) {
      try {
        console.log(`🔄 Placing order on ${account.broker_name} account ${account.account_id}...`);

        // Ensure account is active (auto-reactivate if needed)
        const isAccountActive = await ensureAccountActive(userId, account.id.toString());
        if (!isAccountActive) {
          const error = `Failed to activate ${account.broker_name} account ${account.account_id}`;
          console.error(`❌ ${error}`);
          failedOrders.push({
            accountId: account.id.toString(),
            brokerName: account.broker_name,
            accountDisplayName: `${account.broker_name} (${account.account_id})`,
            error: error,
            errorType: 'ACTIVATION_FAILED'
          });
          continue;
        }

        // Create account-specific order request
        const orderRequest = {
          ...baseOrderRequest,
          accountId: account.account_id,
          remarks: `${baseOrderRequest.remarks} - Account: ${account.account_id}`
        };

        // Place order using unified broker interface
        const orderResponse = await placeBrokerOrder(userId, account.broker_name, account.id.toString(), orderRequest);

        // Handle session expiry with auto-retry
        if (!orderResponse.success && orderResponse.data?.errorType === 'SESSION_EXPIRED') {
          console.log(`🔄 Session expired during order placement for ${account.account_id}. Attempting auto-reactivation...`);

          const reactivated = await ensureAccountActive(userId, account.id.toString());
          if (reactivated) {
            console.log(`✅ Auto-reactivation successful for ${account.account_id}. Retrying order placement...`);
            const retryResponse = await placeBrokerOrder(userId, account.broker_name, account.id.toString(), orderRequest);

            if (retryResponse.success) {
              await handleSuccessfulOrder(userId, account, retryResponse, baseOrderRequest);
              successfulOrders.push({
                accountId: account.id.toString(),
                brokerName: account.broker_name,
                accountDisplayName: `${account.broker_name} (${account.account_id})`,
                orderId: retryResponse.data?.brokerOrderId || retryResponse.data?.orderId,
                message: retryResponse.message || 'Order placed successfully'
              });
            } else {
              failedOrders.push({
                accountId: account.id.toString(),
                brokerName: account.broker_name,
                accountDisplayName: `${account.broker_name} (${account.account_id})`,
                error: retryResponse.message || 'Order placement failed after retry',
                errorType: 'ORDER_FAILED'
              });
            }
          } else {
            failedOrders.push({
              accountId: account.id.toString(),
              brokerName: account.broker_name,
              accountDisplayName: `${account.broker_name} (${account.account_id})`,
              error: 'Session expired and auto-reactivation failed',
              errorType: 'SESSION_EXPIRED'
            });
          }
        } else if (orderResponse.success) {
          // Order placed successfully
          await handleSuccessfulOrder(userId, account, orderResponse, baseOrderRequest);
          successfulOrders.push({
            accountId: account.id.toString(),
            brokerName: account.broker_name,
            accountDisplayName: `${account.broker_name} (${account.account_id})`,
            orderId: orderResponse.data?.brokerOrderId || orderResponse.data?.orderId,
            message: orderResponse.message || 'Order placed successfully'
          });
        } else {
          // Order placement failed - save to database with error details
          await handleFailedOrder(userId, account, orderResponse, baseOrderRequest);
          failedOrders.push({
            accountId: account.id.toString(),
            brokerName: account.broker_name,
            accountDisplayName: `${account.broker_name} (${account.account_id})`,
            error: orderResponse.message || 'Order placement failed',
            errorType: 'ORDER_FAILED'
          });
        }

      } catch (error: any) {
        console.error(`🚨 Order placement error for ${account.broker_name} account ${account.account_id}:`, error);

        // Save failed order to database with error details
        await handleFailedOrder(userId, account, {
          success: false,
          message: error.message || 'Unexpected error during order placement',
          data: { errorType: 'SYSTEM_ERROR' }
        }, baseOrderRequest);

        failedOrders.push({
          accountId: account.id.toString(),
          brokerName: account.broker_name,
          accountDisplayName: `${account.broker_name} (${account.account_id})`,
          error: error.message || 'Unexpected error during order placement',
          errorType: 'SYSTEM_ERROR'
        });
      }
    }

    // Determine overall success status
    const totalAccounts = accounts.length;
    const successCount = successfulOrders.length;
    const failureCount = failedOrders.length;

    let overallSuccess = false;
    let statusMessage = '';

    if (successCount === totalAccounts) {
      overallSuccess = true;
      statusMessage = `Orders placed successfully on all ${totalAccounts} account${totalAccounts > 1 ? 's' : ''}`;
    } else if (successCount > 0) {
      overallSuccess = true; // Partial success is still considered success
      statusMessage = `Orders placed on ${successCount} of ${totalAccounts} accounts. ${failureCount} failed.`;
    } else {
      overallSuccess = false;
      statusMessage = `Failed to place orders on all ${totalAccounts} account${totalAccounts > 1 ? 's' : ''}`;
    }

    // Return comprehensive response
    res.status(overallSuccess ? 200 : 400).json({
      success: overallSuccess,
      message: statusMessage,
      data: {
        summary: {
          totalAccounts,
          successCount,
          failureCount,
          symbol,
          action,
          quantity,
          orderType
        },
        successfulOrders,
        failedOrders,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('🚨 Multi-account order placement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place multi-account orders',
      error: error.message
    });
  }
};

// Helper function to handle failed order processing
async function handleFailedOrder(
  userId: string,
  account: any,
  orderResponse: any,
  baseOrderRequest: any
): Promise<void> {
  try {
    const errorClassifier = OrderErrorClassifier.getInstance();
    const errorClassification = errorClassifier.classifyFyersError({
      message: orderResponse.message,
      code: orderResponse.data?.errorCode,
      s: orderResponse.data?.s
    });

    // Generate a unique broker order ID for failed orders
    const failedOrderId = `FAILED_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const orderHistoryData = {
      user_id: userId,
      account_id: account.id.toString(),
      broker_name: account.broker_name,
      broker_order_id: failedOrderId,
      symbol: baseOrderRequest.symbol,
      action: baseOrderRequest.action as 'BUY' | 'SELL',
      quantity: baseOrderRequest.quantity,
      price: baseOrderRequest.price || 0,
      order_type: baseOrderRequest.orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
      status: 'FAILED' as const,
      exchange: baseOrderRequest.exchange || 'NSE',
      product_type: baseOrderRequest.productType,
      remarks: `Failed: ${orderResponse.message}`,
      executed_at: new Date().toISOString(),
      // Error details
      error_message: orderResponse.message,
      error_code: orderResponse.data?.errorCode || orderResponse.data?.s,
      error_type: errorClassification.errorType,
      failure_reason: errorClassification.userMessage,
      is_retryable: errorClassification.isRetryable,
      retry_count: 0,
      max_retries: errorClassification.maxRetries
    };

    const savedOrder = await userDatabase.createOrderHistory(orderHistoryData);
    console.log(`💾 Failed order saved to history: ${failedOrderId} for ${account.broker_name}`);

    // Schedule automatic retry if retryable
    if (errorClassification.isRetryable && errorClassification.maxRetries > 0) {
      const retryDelay = errorClassifier.calculateRetryDelay(errorClassification.retryDelay, 0);
      await orderRetryService.scheduleAutoRetry(savedOrder.id.toString(), retryDelay);
      console.log(`⏰ Scheduled auto-retry for failed order ${failedOrderId} in ${retryDelay}ms`);
    }

  } catch (historyError: any) {
    console.error(`⚠️ Failed to save failed order history for ${account.broker_name}:`, historyError.message);
  }
}

// Helper function to handle successful order processing
async function handleSuccessfulOrder(
  userId: string,
  account: any,
  orderResponse: any,
  baseOrderRequest: any
): Promise<void> {
  try {
    // Save order to history with PLACED status
    const orderHistoryData = {
      user_id: userId,
      account_id: account.id.toString(),
      broker_name: account.broker_name,
      broker_order_id: orderResponse.data?.brokerOrderId || orderResponse.data?.orderId,
      symbol: baseOrderRequest.symbol,
      action: baseOrderRequest.action,
      quantity: baseOrderRequest.quantity,
      price: baseOrderRequest.price || 0,
      order_type: baseOrderRequest.orderType,
      status: 'PLACED' as const,
      exchange: baseOrderRequest.exchange,
      product_type: baseOrderRequest.productType,
      remarks: baseOrderRequest.remarks,
      executed_at: new Date().toISOString(),
    };

    const savedOrder = await userDatabase.createOrderHistory(orderHistoryData);
    const orderId = orderResponse.data?.brokerOrderId || orderResponse.data?.orderId;
    console.log(`✅ Order placed and saved to history for ${account.broker_name}:`, orderId);

    // Add order to real-time monitoring
    const orderForMonitoring = {
      id: savedOrder.id.toString(),
      user_id: userId,
      account_id: account.id.toString(),
      symbol: baseOrderRequest.symbol,
      action: baseOrderRequest.action,
      quantity: baseOrderRequest.quantity,
      price: baseOrderRequest.price || 0,
      status: 'PLACED',
      broker_name: account.broker_name,
      broker_order_id: orderId,
      order_type: baseOrderRequest.orderType,
      exchange: baseOrderRequest.exchange,
      product_type: baseOrderRequest.productType,
      remarks: baseOrderRequest.remarks,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await orderStatusService.addOrderToMonitoring(orderForMonitoring);
    console.log(`📊 Order added to real-time monitoring for ${account.broker_name}:`, orderId);
  } catch (historyError: any) {
    console.error(`⚠️ Failed to save order history for ${account.broker_name}:`, historyError.message);
    // Don't throw error as the order was placed successfully
  }
}

// Legacy single-account order placement (kept for backward compatibility)
export const placeOrder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  // Declare variables at function scope so they're available in catch block
  let symbol: string | undefined;
  let action: string | undefined;
  let quantity: string | undefined;
  let orderType: string | undefined;
  let price: string | undefined;
  let triggerPrice: string | undefined;
  let exchange: string | undefined;
  let rawProductType: string | undefined;
  let remarks: string | undefined;
  let userId: string | undefined;
  let account: any;
  let brokerName: string | undefined;

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

    // Extract request body
    const requestBody = req.body;
    symbol = requestBody.symbol;
    action = requestBody.action;
    quantity = requestBody.quantity;
    orderType = requestBody.orderType;
    price = requestBody.price;
    triggerPrice = requestBody.triggerPrice;
    exchange = requestBody.exchange;
    rawProductType = requestBody.productType;
    remarks = requestBody.remarks;
    const accountId = requestBody.accountId;

    userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Validate required fields
    if (!symbol || !action || !quantity || !orderType) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: symbol, action, quantity, orderType',
      });
      return;
    }

    // Validate that the user owns the specified account
    account = await userDatabase.getConnectedAccountById(accountId);
    if (!account || account.user_id.toString() !== userId.toString()) {
      res.status(404).json({
        success: false,
        message: 'Account not found or access denied',
      });
      return;
    }

    brokerName = account.broker_name;

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

    // Use the unified broker interface - use database account ID, not broker account ID
    let orderResponse = await placeBrokerOrder(userId!, brokerName!, accountId, unifiedOrderRequest);

    // Handle session expiry with auto-retry
    if (!orderResponse.success && orderResponse.data?.errorType === 'SESSION_EXPIRED') {
      console.log(`🔄 Session expired during order placement for ${account.account_id}. Attempting auto-reactivation...`);

      // Try auto-reactivation once
      const reactivated = await ensureAccountActive(userId, accountId);
      if (reactivated) {
        console.log(`✅ Auto-reactivation successful for ${account.account_id}. Retrying order placement...`);
        orderResponse = await placeBrokerOrder(userId!, brokerName!, accountId, unifiedOrderRequest);
      } else {
        throw new Error(`Session expired and auto-reactivation failed for account ${account.account_id}. Please check your credentials.`);
      }
    }

    // Handle unified response
    if (orderResponse.success) {
      // Save order to history with PLACED status
      try {
        const orderHistoryData = {
          user_id: userId,
          account_id: account.id.toString(),
          broker_name: brokerName,
          broker_order_id: orderResponse.data?.brokerOrderId || orderResponse.data?.orderId,
          symbol: symbol,
          action: action as 'BUY' | 'SELL',
          quantity: parseInt(quantity),
          price: price ? parseFloat(price) : 0,
          order_type: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
          status: 'PLACED' as const,
          exchange: exchange || 'NSE',
          product_type: rawProductType,
          remarks: remarks || `Order placed via CopyTrade Pro`,
          executed_at: new Date().toISOString(),
        };

        const savedOrder = await userDatabase.createOrderHistory(orderHistoryData);
        const orderId = orderResponse.data?.brokerOrderId || orderResponse.data?.orderId;
        console.log('✅ Order placed and saved to history:', orderId);

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
          broker_name: brokerName!,
          broker_order_id: orderId,
          order_type: orderType,
          exchange: exchange || 'NSE',
          product_type: rawProductType || 'C',
          remarks: remarks || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await orderStatusService.addOrderToMonitoring(orderForMonitoring);
        console.log('📊 Order added to real-time monitoring:', orderId);
      } catch (historyError: any) {
        console.error('⚠️ Failed to save order history:', historyError.message);
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
      // Order placement failed - save to database with error details
      try {
        const failedOrderData = {
          symbol,
          action: action as 'BUY' | 'SELL',
          quantity: parseInt(quantity),
          orderType: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
          price: price ? parseFloat(price) : 0,
          exchange: exchange || 'NSE',
          productType: rawProductType
        };

        await handleFailedOrder(userId, account, orderResponse, failedOrderData);
      } catch (historyError: any) {
        console.error('⚠️ Failed to save failed order history:', historyError.message);
      }

      res.status(400).json({
        success: false,
        message: orderResponse.message || 'Failed to place order',
        data: {
          orderId: null,
          brokerName,
          symbol,
          action,
          quantity,
          orderType,
          price,
          triggerPrice,
          exchange,
          status: 'FAILED',
          timestamp: new Date().toISOString(),
          error: orderResponse.message || 'Order placement failed',
          isRetryable: false
        }
      });
    }

  } catch (error: any) {
    console.error('🚨 Place order error:', error);

    // Save system error to database if variables are available
    if (symbol && action && quantity && orderType && userId && account) {
      try {
        const failedOrderData = {
          symbol,
          action: action as 'BUY' | 'SELL',
          quantity: parseInt(quantity),
          orderType: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
          price: price ? parseFloat(price) : 0,
          exchange: exchange || 'NSE',
          productType: rawProductType
        };

        await handleFailedOrder(userId, account, {
          success: false,
          message: error.message || 'System error during order placement',
          data: { errorType: 'SYSTEM_ERROR' }
        }, failedOrderData);
      } catch (historyError: any) {
        console.error('⚠️ Failed to save system error order history:', historyError.message);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to place order',
    });
  }
};

// Refresh order status for all pending orders
export const refreshAllOrderStatus = async (
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

    console.log(`🔄 Manual order status refresh requested by user ${userId}`);

    const result = await orderStatusService.refreshAllOrderStatus(userId);

    res.status(result.success ? 200 : 500).json(result);
  } catch (error: any) {
    console.error('🚨 Refresh all order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh order status',
      error: error.message
    });
  }
};

// Refresh order status for a specific order
export const refreshOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    console.log(`🔄 Manual order status refresh requested for order ${orderId} by user ${userId}`);

    const result = await orderStatusService.refreshOrderStatus(orderId, userId);

    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    console.error('🚨 Refresh order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh order status',
      error: error.message
    });
  }
};

// Cancel an order
export const cancelOrder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    console.log(`🚫 Order cancellation requested for order ${orderId} by user ${userId}`);

    // Get order from database
    const orderHistory = await userDatabase.getOrderHistoryById(parseInt(orderId));
    if (!orderHistory) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Verify user owns the order
    if (orderHistory.user_id.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Check if order can be cancelled
    if (!['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(orderHistory.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${orderHistory.status}`,
      });
      return;
    }

    // Get account details
    const account = await userDatabase.getConnectedAccountById(orderHistory.account_id.toString());
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Associated account not found',
      });
      return;
    }

    // Ensure account is active
    const isAccountActive = await ensureAccountActive(userId, account.id.toString());
    if (!isAccountActive) {
      res.status(400).json({
        success: false,
        message: `Failed to activate ${account.broker_name} account for order cancellation`,
      });
      return;
    }

    try {
      // Cancel order using broker service
      const brokerService = enhancedUnifiedBrokerManager.getBrokerService(userId, account.broker_name, account.account_id);
      if (!brokerService) {
        res.status(400).json({
          success: false,
          message: `No active connection found for ${account.broker_name} account`,
        });
        return;
      }

      // Cancel order using unified broker interface
      const cancelResult = await brokerService.cancelOrder(orderHistory.broker_order_id);

      if (cancelResult.success) {
        // Update order status in database
        const updated = await userDatabase.updateOrderStatusByBrokerOrderId(
          orderHistory.broker_order_id,
          'CANCELLED'
        );

        if (updated) {
          console.log(`✅ Order ${orderId} cancelled successfully`);

          // Send WebSocket update
          websocketService.sendToUser(userId, 'orderStatusUpdate', {
            orderId: orderHistory.id.toString(),
            brokerOrderId: orderHistory.broker_order_id,
            symbol: orderHistory.symbol,
            action: orderHistory.action,
            quantity: orderHistory.quantity,
            price: orderHistory.price,
            oldStatus: orderHistory.status,
            newStatus: 'CANCELLED',
            brokerName: orderHistory.broker_name,
            exchange: orderHistory.exchange,
            orderType: orderHistory.order_type,
            timestamp: new Date().toISOString()
          });

          res.status(200).json({
            success: true,
            message: 'Order cancelled successfully',
            data: {
              orderId: orderHistory.id,
              brokerOrderId: orderHistory.broker_order_id,
              symbol: orderHistory.symbol,
              status: 'CANCELLED',
              timestamp: new Date().toISOString()
            }
          });
        } else {
          res.status(500).json({
            success: false,
            message: 'Order cancelled at broker but failed to update database',
          });
        }
      } else {
        res.status(400).json({
          success: false,
          message: cancelResult.message || 'Failed to cancel order at broker',
        });
      }

    } catch (error: any) {
      console.error(`🚨 Order cancellation error for order ${orderId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to cancel order',
        error: error.message
      });
    }

  } catch (error: any) {
    console.error('🚨 Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message
    });
  }
};

// Modify an order
export const modifyOrder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;
    const { quantity, price, triggerPrice, orderType } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    console.log(`✏️ Order modification requested for order ${orderId} by user ${userId}`);

    // Get order from database
    const orderHistory = await userDatabase.getOrderHistoryById(parseInt(orderId));
    if (!orderHistory) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Verify user owns the order
    if (orderHistory.user_id.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Check if order can be modified
    if (!['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(orderHistory.status)) {
      res.status(400).json({
        success: false,
        message: `Cannot modify order with status: ${orderHistory.status}`,
      });
      return;
    }

    // Get account details
    const account = await userDatabase.getConnectedAccountById(orderHistory.account_id.toString());
    if (!account) {
      res.status(404).json({
        success: false,
        message: 'Associated account not found',
      });
      return;
    }

    // Ensure account is active
    const isAccountActive = await ensureAccountActive(userId, account.id.toString());
    if (!isAccountActive) {
      res.status(400).json({
        success: false,
        message: `Failed to activate ${account.broker_name} account for order modification`,
      });
      return;
    }

    try {
      // Modify order using broker service
      const brokerService = enhancedUnifiedBrokerManager.getBrokerService(userId, account.broker_name, account.account_id);
      if (!brokerService) {
        res.status(400).json({
          success: false,
          message: `No active connection found for ${account.broker_name} account`,
        });
        return;
      }

      const modifyRequest = {
        orderId: orderHistory.broker_order_id,
        quantity: quantity ? parseInt(quantity) : orderHistory.quantity,
        price: price ? parseFloat(price) : orderHistory.price,
        triggerPrice: triggerPrice ? parseFloat(triggerPrice) : undefined,
        orderType: orderType || orderHistory.order_type
      };

      // Modify order using unified broker interface
      const modifications = {
        qty: modifyRequest.quantity.toString(),
        prc: modifyRequest.price.toString(),
        prctyp: modifyRequest.orderType
      };

      if (modifyRequest.triggerPrice) {
        (modifications as any).trgprc = modifyRequest.triggerPrice.toString();
      }

      const modifyResult = await brokerService.modifyOrder(orderHistory.broker_order_id, modifications);

      if (modifyResult.success) {
        // Update order in database with new details
        const updateData = {
          quantity: modifyRequest.quantity,
          price: modifyRequest.price,
          order_type: modifyRequest.orderType,
          updated_at: new Date().toISOString()
        };

        // Note: This would require a new database method to update order details
        console.log(`✅ Order ${orderId} modified successfully`);

        // Send WebSocket update
        websocketService.sendToUser(userId, 'orderModified', {
          orderId: orderHistory.id.toString(),
          brokerOrderId: orderHistory.broker_order_id,
          symbol: orderHistory.symbol,
          action: orderHistory.action,
          oldQuantity: orderHistory.quantity,
          newQuantity: modifyRequest.quantity,
          oldPrice: orderHistory.price,
          newPrice: modifyRequest.price,
          orderType: modifyRequest.orderType,
          brokerName: orderHistory.broker_name,
          timestamp: new Date().toISOString()
        });

        res.status(200).json({
          success: true,
          message: 'Order modified successfully',
          data: {
            orderId: orderHistory.id,
            brokerOrderId: orderHistory.broker_order_id,
            symbol: orderHistory.symbol,
            modifications: updateData,
            timestamp: new Date().toISOString()
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: modifyResult.message || 'Failed to modify order at broker',
        });
      }

    } catch (error: any) {
      console.error(`🚨 Order modification error for order ${orderId}:`, error);
      res.status(500).json({
        success: false,
        message: 'Failed to modify order',
        error: error.message
      });
    }

  } catch (error: any) {
    console.error('🚨 Modify order error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to modify order',
      error: error.message
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
      accountIds, // Comma-separated list of account IDs
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

    // Parse accountIds if provided
    let accountIdsArray: string[] | undefined;
    if (accountIds && typeof accountIds === 'string') {
      accountIdsArray = accountIds.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }

    // Build filter options with enhanced filtering
    const filterOptions = {
      status: status as string,
      symbol: symbol as string,
      brokerName: brokerName as string,
      accountIds: accountIdsArray,
      startDate: startDate as string,
      endDate: endDate as string,
      action: action as 'BUY' | 'SELL',
      search: search as string,
    };

    console.log(`📊 Getting order history for user ${userId} with filters:`, {
      ...filterOptions,
      accountIds: accountIdsArray?.length || 0
    });

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
      error: error.message
    });
  }
};

// Check individual order status from broker API
export const getOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const userId = req.user?.id;
    const { brokerOrderId } = req.params;
    const { brokerName, accountId } = req.query;

    // Enhanced logging for request start
    logger.info('Order status request initiated', {
      requestId,
      userId,
      brokerOrderId,
      brokerName: brokerName as string,
      accountId: accountId as string,
      component: 'BROKER_CONTROLLER',
      operation: 'GET_ORDER_STATUS',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    // Enhanced authentication validation
    if (!userId) {
      logger.warn('Order status request failed - user not authenticated', {
        requestId,
        component: 'BROKER_CONTROLLER',
        operation: 'GET_ORDER_STATUS',
        errorType: 'AUTHENTICATION_ERROR'
      });
      return BrokerConnectionHelper.sendAuthenticationError(res);
    }

    // Enhanced parameter validation
    const missingParams: string[] = [];
    const invalidParams: string[] = [];

    if (!brokerOrderId || typeof brokerOrderId !== 'string' || brokerOrderId.trim().length === 0) {
      missingParams.push('brokerOrderId');
    }
    if (!brokerName || typeof brokerName !== 'string' || brokerName.trim().length === 0) {
      missingParams.push('brokerName');
    }

    // Validate brokerOrderId format (basic validation)
    if (brokerOrderId && typeof brokerOrderId === 'string' && brokerOrderId.trim().length > 0) {
      // Check for reasonable order ID format (alphanumeric, dashes, underscores)
      if (!/^[a-zA-Z0-9_-]+$/.test(brokerOrderId.trim())) {
        invalidParams.push('brokerOrderId (invalid format)');
      }
    }

    // Validate brokerName against supported brokers
    const supportedBrokers = ['shoonya', 'fyers', 'zerodha', 'angel', 'upstox', 'dhan'];
    if (brokerName && typeof brokerName === 'string' && brokerName.trim().length > 0) {
      if (!supportedBrokers.includes(brokerName.toLowerCase())) {
        invalidParams.push(`brokerName (unsupported broker: ${brokerName})`);
      }
    }

    if (missingParams.length > 0 || invalidParams.length > 0) {
      const errorMessage = [
        ...(missingParams.length > 0 ? [`Missing required parameters: ${missingParams.join(', ')}`] : []),
        ...(invalidParams.length > 0 ? [`Invalid parameters: ${invalidParams.join(', ')}`] : [])
      ].join('. ');

      logger.warn('Order status request failed - parameter validation error', {
        requestId,
        userId,
        component: 'BROKER_CONTROLLER',
        operation: 'GET_ORDER_STATUS',
        errorType: 'VALIDATION_ERROR',
        missingParams,
        invalidParams
      });

      res.status(400).json({
        success: false,
        message: errorMessage,
        errorType: 'VALIDATION_ERROR',
        details: {
          missingParams,
          invalidParams,
          supportedBrokers
        }
      });
      return;
    }

    // Find broker connection (specific account if provided, or first available)
    const connectionResult = BrokerConnectionHelper.findBrokerConnection(
      userId,
      brokerName as string,
      accountId as string
    );

    if (!connectionResult.success) {
      logger.warn('Order status request failed - broker connection not found', {
        requestId,
        userId,
        brokerName: brokerName as string,
        accountId: accountId as string,
        component: 'BROKER_CONTROLLER',
        operation: 'GET_ORDER_STATUS',
        errorType: 'CONNECTION_NOT_FOUND'
      });

      const errorMessage = accountId 
        ? `Not connected to ${brokerName} account ${accountId}. Please reconnect your broker account.`
        : `Not connected to ${brokerName}. Please connect your broker account first.`;

      res.status(404).json({
        success: false,
        message: errorMessage,
        errorType: 'CONNECTION_NOT_FOUND',
        details: {
          brokerName,
          accountId,
          suggestion: 'Please reconnect your broker account from the Account Setup page.'
        }
      });
      return;
    }

    const { connection: brokerService, accountId: resolvedAccountId } = connectionResult;

    // Enhanced logging for broker API call
    logger.info('Calling broker API for order status', {
      requestId,
      userId,
      brokerOrderId,
      brokerName: brokerName as string,
      accountId: resolvedAccountId,
      component: 'BROKER_CONTROLLER',
      operation: 'BROKER_API_CALL'
    });

    // Import comprehensive error handler
    const { comprehensiveErrorHandler } = await import('../services/comprehensiveErrorHandler');
    
    const context = {
      userId: userId,
      brokerName: brokerName as string,
      accountId: resolvedAccountId || 'unknown',
      operation: 'getOrderStatus',
      timestamp: new Date()
    };

    // Get order status from broker API with comprehensive error handling
    let orderStatus;
    try {
      // Check rate limiting before making broker API call
      const rateLimitCheck = comprehensiveErrorHandler.checkRateLimit(
        userId, brokerName as string, 'getOrderStatus'
      );

      if (!rateLimitCheck.allowed) {
        const waitTime = rateLimitCheck.waitTime || 0;
        const waitTimeSeconds = Math.ceil(waitTime / 1000);
        
        logger.warn('Order status request rate limited', {
          requestId,
          userId,
          brokerOrderId,
          brokerName: brokerName as string,
          accountId: resolvedAccountId,
          component: 'BROKER_CONTROLLER',
          operation: 'RATE_LIMIT_CHECK',
          waitTime: waitTime
        });

        res.status(429).json({
          success: false,
          message: `Rate limit exceeded. Please wait ${waitTimeSeconds} seconds before trying again.`,
          errorType: 'RATE_LIMIT_ERROR',
          waitTime: waitTime,
          retryAfter: waitTimeSeconds,
          suggestedActions: [
            `Wait for ${waitTimeSeconds} seconds before trying again`,
            'Reduce the frequency of your requests',
            'Consider using bulk operations where available'
          ],
          details: {
            brokerName,
            requestId
          }
        });
        return;
      }

      // Execute order status retrieval with comprehensive error handling and retry logic
      orderStatus = await comprehensiveErrorHandler.executeWithRetry(
        async () => {
          return await (brokerService as any).getOrderStatus(
            userId,
            brokerOrderId
          );
        },
        context,
        {
          maxRetries: 3,
          baseDelay: 1000,
          maxDelay: 10000
        }
      );

    } catch (brokerError: any) {
      logger.error('Broker API call failed for order status', {
        requestId,
        userId,
        brokerOrderId,
        brokerName: brokerName as string,
        accountId: resolvedAccountId,
        component: 'BROKER_CONTROLLER',
        operation: 'BROKER_API_CALL',
        errorType: 'BROKER_API_ERROR',
        originalError: brokerError.message
      }, brokerError);

      // Use comprehensive error handler for enhanced error processing
      const userFriendlyMessage = comprehensiveErrorHandler.getUserFriendlyMessage(brokerError, context);
      const suggestedActions = comprehensiveErrorHandler.getSuggestedActions(brokerError, context);
      const isRetryable = comprehensiveErrorHandler.isRetryable(brokerError, context);
      
      // Determine appropriate HTTP status code based on error type
      let statusCode = 503; // Default to service unavailable
      if (brokerError.errorType === 'SESSION_EXPIRED' || brokerError.errorType === 'AUTH_FAILED') {
        statusCode = 401;
      } else if (brokerError.errorType === 'PERMISSION_ERROR') {
        statusCode = 403;
      } else if (brokerError.errorType === 'ORDER_NOT_FOUND') {
        statusCode = 404;
      } else if (brokerError.errorType === 'RATE_LIMIT_ERROR') {
        statusCode = 429;
      } else if (brokerError.errorType === 'VALIDATION_ERROR') {
        statusCode = 400;
      } else if (brokerError.errorType === 'SERVER_ERROR') {
        statusCode = 502;
      } else if (brokerError.errorType === 'NETWORK_ERROR') {
        statusCode = 503;
      }

      res.status(statusCode).json({
        success: false,
        message: userFriendlyMessage,
        errorType: brokerError.errorType || 'BROKER_ERROR',
        retryable: isRetryable,
        suggestedActions: suggestedActions,
        details: {
          brokerName,
          requestId,
          originalError: brokerError.message,
          context: {
            operation: 'getOrderStatus',
            timestamp: new Date().toISOString()
          }
        }
      });
      return;
    }

    const duration = Date.now() - startTime;

    // Enhanced response handling
    if (orderStatus && orderStatus.stat === 'Ok') {
      logger.info('Order status retrieved successfully', {
        requestId,
        userId,
        brokerOrderId,
        brokerName: brokerName as string,
        accountId: resolvedAccountId,
        component: 'BROKER_CONTROLLER',
        operation: 'GET_ORDER_STATUS',
        duration,
        status: orderStatus.status
      });

      const responseData = {
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
      };

      // Log successful response
      logger.logApiCall('GET', `/api/broker/order-status/${brokerOrderId}`, duration, 200, {
        requestId,
        userId,
        brokerName: brokerName as string,
        accountId: resolvedAccountId
      });

      res.status(200).json({
        success: true,
        message: 'Order status retrieved successfully',
        data: responseData
      });
    } else {
      logger.warn('Order not found in broker system', {
        requestId,
        userId,
        brokerOrderId,
        brokerName: brokerName as string,
        accountId: resolvedAccountId,
        component: 'BROKER_CONTROLLER',
        operation: 'GET_ORDER_STATUS',
        duration,
        errorMessage: orderStatus?.emsg
      });

      const errorMessage = orderStatus?.emsg || 'Order not found in broker system';
      const userFriendlyMessage = `Order ${brokerOrderId} not found in ${brokerName}. The order may have been cancelled or may not exist.`;

      // Log API call with 404 status
      logger.logApiCall('GET', `/api/broker/order-status/${brokerOrderId}`, duration, 404, {
        requestId,
        userId,
        brokerName: brokerName as string,
        accountId: resolvedAccountId
      });

      res.status(404).json({
        success: false,
        message: userFriendlyMessage,
        errorType: 'ORDER_NOT_FOUND',
        data: {
          brokerOrderId,
          accountId: resolvedAccountId,
          brokerName,
          status: 'NOT_FOUND',
          details: errorMessage
        }
      });
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    logger.error('Unexpected error in getOrderStatus', {
      requestId,
      userId: req.user?.id,
      brokerOrderId: req.params.brokerOrderId,
      brokerName: req.query.brokerName as string,
      component: 'BROKER_CONTROLLER',
      operation: 'GET_ORDER_STATUS',
      duration,
      errorType: 'INTERNAL_ERROR'
    }, error);

    // Log API call with 500 status
    logger.logApiCall('GET', `/api/broker/order-status/${req.params.brokerOrderId}`, duration, 500, {
      requestId,
      userId: req.user?.id,
      brokerName: req.query.brokerName as string
    });

    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while retrieving order status. Please try again.',
      errorType: 'INTERNAL_ERROR',
      retryable: true,
      details: {
        requestId,
        suggestion: 'If the problem persists, please contact support.'
      }
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

    // Use enhanced unified broker interface for quotes
    const unifiedBrokerService = resolvedAccountId ?
      enhancedUnifiedBrokerManager.getBrokerService(userId, brokerName, resolvedAccountId) :
      null;
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

// Retry a failed order
export const retryOrder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    console.log(`🔄 Order retry requested for order ${orderId} by user ${userId}`);

    const retryResult = await orderRetryService.retryOrder(orderId, userId);

    if (retryResult.success) {
      res.status(200).json({
        success: true,
        message: retryResult.message,
        data: {
          orderId: retryResult.orderId,
          newStatus: retryResult.newStatus,
          retryCount: retryResult.retryCount
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: retryResult.message,
        data: {
          retryCount: retryResult.retryCount,
          isRetryable: retryResult.isRetryable
        }
      });
    }

  } catch (error: any) {
    console.error('🚨 Retry order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to retry order',
    });
  }
};

// Delete a failed order
export const deleteOrder = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    if (!orderId) {
      res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
      return;
    }

    console.log(`🗑️ Order deletion requested for order ${orderId} by user ${userId}`);

    // Get order from database to verify ownership and status
    const order = await userDatabase.getOrderHistoryById(orderId);
    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Verify order belongs to user
    if (order.user_id.toString() !== userId) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Only allow deletion of failed orders
    if (order.status !== 'FAILED' && order.status !== 'REJECTED') {
      res.status(400).json({
        success: false,
        message: 'Only failed or rejected orders can be deleted',
      });
      return;
    }

    // Cancel any scheduled retries
    orderRetryService.cancelScheduledRetry(orderId);

    // Delete the order
    const deleted = await userDatabase.deleteOrderHistory(orderId);

    if (deleted) {
      res.status(200).json({
        success: true,
        message: 'Order deleted successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to delete order',
      });
    }

  } catch (error: any) {
    console.error('🚨 Delete order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete order',
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

      // Step 3: Get active connection for the user using enhanced manager
      const connection = enhancedUnifiedBrokerManager.getConnection(accountMapping.userId, brokerName, accountMapping.accountId);
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
