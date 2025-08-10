import { Response } from 'express';
import { validationResult } from 'express-validator';
import * as crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth';
import { userDatabase } from '../services/databaseCompatibility';
import { trackedUserDatabase } from '../services/trackedDatabaseCompatibility';

import orderStatusService from '../services/orderStatusService';

import { logger } from '../utils/logger';
import { orderStatusLogger } from '../services/orderStatusLogger';
import { OrderStatusErrorHandler } from '../utils/orderStatusErrorHandler';
import { OrderStatusErrorCode } from '../types/orderStatusTypes';

import { createTrackedBrokerService } from '../services/trackedBrokerService';
import { brokerErrorLoggingService } from '../services/brokerErrorLoggingService';
import { oauthStateManager } from '../services/oauthStateManager';
import { UnifiedBrokerFactory, getSupportedBrokers } from '@copytrade/unified-broker';
import { resolveAccountEffectiveStatus } from '../services/brokerStatusResolvers';


import {
  ActivateAccountResponse,
  ApiErrorCode,
  createActivationResponse,
  ACCOUNT_STATUS,
  AUTHENTICATION_STEP
} from '@copytrade/shared-types';

// Unified account connection options
interface ConnectAndSaveAccountOptions {
  accountId?: string; // If provided, it's activation; if not, it's new connection
  enableDetailedLogging?: boolean;
  isOAuthFlow?: boolean;
}

// Unified broker operation options
interface UnifiedBrokerOperationOptions {
  accountId?: string; // If provided, this is an activation; otherwise it's a new connection
  enableDetailedLogging?: boolean;
  responseFormat?: 'connect' | 'activate'; // Format the response for connect or activate API
}
import websocketService from '../services/websocketService';
import { OrderErrorClassifier } from '../services/orderErrorClassifier';
import { orderRetryService } from '../services/orderRetryService';

import { convertSymbolForBroker } from '../services/symbolConversionHelper';
// All broker connections now managed by Enhanced Unified Broker Manager

/**
 * Helper function to logout from broker using enhanced unified broker manager
 */
async function logoutFromBroker(_userId: string, _brokerName: string, _accountId: string): Promise<void> {
  try {
    // Stateless: no persistent connection to disconnect; for OAuth brokers, token revocation would be implemented in broker module
  } catch (error) {
    console.error(`🚨 Logout failed:`, error);
    throw error;
  }
}

/**
 * Order placement without in-memory connection cache
 * - Always instantiate a fresh broker service
 * - Use credentials from DB per request
 */
async function placeBrokerOrder(
  userId: string,
  brokerName: string,
  databaseAccountId: string,
  orderRequest: any
): Promise<any> {
  try {
    console.log(`🔄 Placing order for ${brokerName} account ${databaseAccountId}...`);

    // Get account details and credentials from database
    const account = await trackedUserDatabase.getConnectedAccountById(databaseAccountId);
    if (!account) {
      const error = new Error(`Account ${databaseAccountId} not found in database`);
      await brokerErrorLoggingService.logBrokerError(
        `Account not found: ${databaseAccountId}`,
        error,
        brokerErrorLoggingService.createBrokerContext(
          userId,
          brokerName,
          databaseAccountId,
          'PLACE_ORDER',
          { orderDetails: { symbol: orderRequest.symbol, quantity: orderRequest.quantity, price: orderRequest.price, orderType: orderRequest.orderType, side: orderRequest.side } }
        )
      );
      throw error;
    }

    const brokerAccountId = account.account_id;

    // Fetch decrypted credentials for this account
    const credentials = await userDatabase.getAccountCredentials(databaseAccountId);
    if (!credentials) {
      return {
        success: false,
        message: `Credentials not found for account ${brokerAccountId}. Please authenticate before placing orders.`,
        data: { errorType: 'AUTH_REQUIRED' }
      };
    }

    // Create a fresh broker service and connect/auth per request
    const factory = UnifiedBrokerFactory.getInstance();
    const brokerService = factory.createBroker(brokerName);

    // For Shoonya (direct auth), connect() will perform login; for Fyers, connect() may indicate OAuth required
    const connectResult = await brokerService.connect(credentials);
    if (!connectResult.success && connectResult.authenticationStep === 'OAUTH_REQUIRED') {
      return {
        success: false,
        message: 'Account requires OAuth authentication. Please activate account before placing orders.',
        data: { errorType: 'AUTH_REQUIRED' }
      };
    }

    // Wrap with tracked service for logging
    const trackedService = createTrackedBrokerService(brokerService, userId, brokerName, brokerAccountId);

    console.log(`📤 Placing ${orderRequest.action} order for ${orderRequest.symbol} (${orderRequest.quantity} qty)`);

    const orderResult = await Promise.race([
      trackedService.placeOrder(orderRequest),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Order placement timeout after 30 seconds')), 30000))
    ]) as any;

    console.log(`📊 Order placement result for ${brokerName} account ${brokerAccountId}:`, orderResult.success ? 'SUCCESS' : 'FAILED');
    return orderResult;

  } catch (error: any) {
    console.error(`🚨 Order placement failed for ${brokerName}:`, error.message);
    return {
      success: false,
      message: error.message || 'Order placement failed',
      data: {
        errorType: error.message?.includes('timeout') ? 'TIMEOUT_ERROR' : 'SYSTEM_ERROR',
        originalError: error.message
      }
    };
  }
}


// In-memory broker account cache removed - operating stateless per request

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

    // Get available brokers from UnifiedBrokerFactory
    const availableBrokers = getSupportedBrokers();

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
    let { accountId, authCode, stateToken } = req.body as { accountId?: string; authCode: string; stateToken?: string };
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
        message: 'Authorization code is required',
      });
      return;
    }

    // Prepare to use state-scoped credentials if available (manual OAuth flow)
    let stateCredentials: any = null;
    let stateRedirectUri: string | undefined = undefined;

    // Validate state token if provided (for enhanced security) and derive accountId if missing
    if (stateToken) {
      const storedState = oauthStateManager.retrieveState(stateToken);
      if (!storedState) {
        res.status(400).json({
          success: false,
          message: 'Invalid or expired OAuth state. Please try again.',
          errorType: 'AUTH_FAILED'
        });
        return;
      }

      // Verify state belongs to this user
      if (storedState.userId !== userId) {
        res.status(400).json({
          success: false,
          message: 'OAuth state mismatch. Please try again.',
          errorType: 'AUTH_FAILED'
        });
        return;
      }

      // Prefer accountId from state for new connections (UI may send '<pending>')
      if (!accountId || accountId === '<pending>' || accountId !== storedState.accountId) {
        accountId = storedState.accountId;
      }

      // Capture credentials/redirectUri from state for manual completion path
      stateCredentials = storedState.credentials || null;
      stateRedirectUri = storedState.redirectUri;

      // Clean up state after validation
      oauthStateManager.removeState(stateToken);
    }

    if (!accountId) {
      res.status(400).json({
        success: false,
        message: 'Account ID or valid OAuth state is required',
        errorType: 'AUTH_FAILED'
      });
      return;
    }

    console.log(`🔄 Completing OAuth for account ${accountId} with auth code: ${authCode.substring(0, 10)}...`);

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

    // Get decrypted credentials from database (fallback to state credentials when available)
    let credentials = stateCredentials || await userDatabase.getAccountCredentials(accountId);
    if (!credentials) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve account credentials. Please reconnect your broker account.',
        errorType: 'AUTH_FAILED'
      });
      return;
    }
    // Ensure redirectUri present for OAuth exchange
    if (stateRedirectUri && !credentials.redirectUri) {
      credentials = { ...credentials, redirectUri: stateRedirectUri };
    }

    // Complete OAuth authentication using unified broker service
    try {
      const factory = UnifiedBrokerFactory.getInstance();
      const brokerService = factory.createBroker(account.broker_name);
      const result = await brokerService.completeOAuth(authCode, credentials);

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

          // Calculate refresh token expiry (15 days for Fyers)
          const refreshTokenExpiry = account.broker_name === 'fyers' && result.tokenInfo?.refreshToken
            ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
            : null;

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
            token_expiry_time: result.tokenInfo?.expiryTime || null,
            refresh_token_expiry_time: refreshTokenExpiry
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

        // In-memory broker account cache removed

        // Note: no connection manager; database already holds account mapping



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
          isActive: result.accountStatus === ACCOUNT_STATUS.ACTIVE,
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
        errorType: 'AUTH_FAILED'
      });
    }
  } catch (error: any) {
    console.error('🚨 OAuth completion error:', error);
    res.status(500).json({
      success: false,
      message: 'An unexpected error occurred during authentication. Please try again.',
      errorType: 'SYSTEM_ERROR'
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
    let stateCredentials: any = null;
    if (state) {
      const storedState = oauthStateManager.retrieveState(state as string);
      if (storedState) {
        // Verify state matches current request
        if (storedState.userId === userId && storedState.brokerName === broker) {
          accountId = storedState.accountId;
          stateCredentials = storedState.credentials || null;
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
          acc.account_status === ACCOUNT_STATUS.PROCEED_TO_OAUTH
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

    // Get stored credentials (prefer state credentials during OAuth completion)
    let credentials = stateCredentials;
    if (!credentials) {
      credentials = await userDatabase.getAccountCredentials(accountId);
    }
    if (!credentials) {
      console.error(`❌ No credentials found for account ${accountId}`);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/account-setup?oauth=error&message=${encodeURIComponent('Account credentials not found. Please try connecting again.')}`);
      return;
    }

    console.log(`🔄 Processing OAuth callback for ${broker} account ${accountId}`);

    // Complete OAuth authentication using unified broker service
    try {
      const factory = UnifiedBrokerFactory.getInstance();
      const brokerService = factory.createBroker(broker as string);
      const result = await brokerService.completeOAuth(code as string, credentials);

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

          // Calculate refresh token expiry (15 days for Fyers)
          const refreshTokenExpiry = account.broker_name === 'fyers' && result.tokenInfo?.refreshToken
            ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
            : null;

          await userDatabase.updateConnectedAccount(accountId, {
            account_id: result.accountInfo.accountId,
            user_name: result.accountInfo.userName,
            email: result.accountInfo.email || account.email,
            broker_display_name: result.accountInfo.brokerDisplayName,
            exchanges: result.accountInfo.exchanges,
            products: result.accountInfo.products,
            credentials: updatedCredentials,
            account_status: result.accountStatus,
            token_expiry_time: result.tokenInfo?.expiryTime || null,
            refresh_token_expiry_time: refreshTokenExpiry
          });

          console.log(`✅ Database account ${accountId} updated after OAuth callback`);
          // In-memory broker account cache removed
          // No connection manager mapping; DB is source of truth
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

/**
 * Unified method to connect and save account (handles both new connections and activations)
 */
async function connectAndSaveAccount(
  userId: string,
  brokerName: string,
  credentials: any,
  options: ConnectAndSaveAccountOptions = {}
): Promise<any> {
  const { accountId } = options;
  const isActivation = !!accountId;

  console.log(`🔄 ${isActivation ? 'Activating' : 'Connecting'} ${brokerName} account for user ${userId}`);

  // Step 1: Test broker connection using new unified method
  // Stateless: test by attempting connect/validate via unified service
  const unified = UnifiedBrokerFactory.getInstance().createBroker(brokerName);
  const conn = await unified.connect(credentials);
  const testResult: any = { ...conn, activated: conn.success, authFlowRequired: conn.authenticationStep === 'OAUTH_REQUIRED', authUrl: conn.authUrl, accountInfo: conn.accountInfo, authToken: conn.tokenInfo?.accessToken, refreshToken: conn.tokenInfo?.refreshToken, authTokenExpiry: conn.tokenInfo?.expiryTime, accountId: conn.accountInfo?.accountId, userName: conn.accountInfo?.userName, email: conn.accountInfo?.email, exchanges: conn.accountInfo?.exchanges, products: conn.accountInfo?.products };

  // Step 2: Handle the test result
  if (!testResult.activated && !testResult.authFlowRequired) {
    // Connection failed and no auth flow available
    const errMsg = testResult.error || testResult.message || `Failed to ${isActivation ? 'activate' : 'connect'} ${brokerName} account`;
    throw new Error(errMsg);
  }

  // Step 3: Convert test result to connection response format for compatibility
  const result = {
    success: true,
    message: testResult.activated ? 'Connection successful' : 'OAuth authentication required',
    accountInfo: testResult.accountInfo || {
      accountId: testResult.accountId || `${brokerName}_${userId}_${Date.now()}`,
      userName: testResult.userName || 'OAuth Pending',
      email: testResult.email || 'oauth-pending@temp.com',
      exchanges: testResult.exchanges || [],
      products: testResult.products || []
    },
    tokenInfo: testResult.authToken ? {
      accessToken: testResult.authToken,
      refreshToken: testResult.refreshToken,
      expiryTime: testResult.authTokenExpiry
    } : null,
    accountStatus: testResult.activated ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.PROCEED_TO_OAUTH,
    requiresAuthCode: testResult.authFlowRequired,
    authUrl: testResult.authUrl
  };

  // Step 4: Calculate token expiry times
  const refreshTokenExpiry = brokerName === 'fyers' && testResult.refreshToken
    ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Step 5: Save/Update account in database
  let dbAccount;
  if (isActivation) {
    // Update existing account with minimal changes; do not store secrets until auth completes
    const updateData: any = {
      account_status: testResult.activated ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.PROCEED_TO_OAUTH,
      token_expiry_time: testResult.activated ? (testResult.authTokenExpiry || null) : null,
      refresh_token_expiry_time: testResult.activated ? refreshTokenExpiry : null,
      // Always persist existing credentials for safety when re-activating
      credentials
    };

    dbAccount = await trackedUserDatabase.updateConnectedAccount(accountId!, updateData);
    console.log(`✅ Account ${accountId} ${testResult.activated ? 'activated' : 'prepared for OAuth'} successfully for ${brokerName}`);
  } else {
    // Create new account; do not store secrets until auth completes
    const accountData: any = {
      user_id: userId,
      broker_name: brokerName,
      account_id: result.accountInfo.accountId,
      user_name: result.accountInfo.userName || '',
      email: result.accountInfo.email || '',
      broker_display_name: brokerName.toUpperCase(),
      exchanges: result.accountInfo.exchanges || [],
      products: result.accountInfo.products || [],
      account_status: testResult.activated ? ACCOUNT_STATUS.ACTIVE : ACCOUNT_STATUS.PROCEED_TO_OAUTH,
      token_expiry_time: testResult.activated ? (testResult.authTokenExpiry || null) : null,
      refresh_token_expiry_time: testResult.activated ? refreshTokenExpiry : null,
      // Placeholder minimal credentials to satisfy schema; real secrets added after OAuth
      credentials: testResult.activated ? (testResult as any) : ({})
    };

    dbAccount = await trackedUserDatabase.createConnectedAccount(accountData);
    console.log(`✅ New ${brokerName} account ${testResult.activated ? 'created' : 'prepared for OAuth'} successfully`);
  }

  // Step 6: No connection mapping step needed in stateless mode
  if (testResult.activated) {
    // All mapping is persisted in DB
  }

  return {
    success: true,
    message: testResult.activated
      ? `${brokerName.toUpperCase()} account ${isActivation ? 'activated' : 'connected'} successfully`
      : `${brokerName.toUpperCase()} OAuth authentication required`,
    data: dbAccount,
    accountInfo: result.accountInfo,
    tokenInfo: result.tokenInfo,
    requiresAuthCode: testResult.authFlowRequired,
    authUrl: testResult.authUrl
  };
}

/**
 * Unified method to handle both broker connection and account activation
 * Eliminates duplicate logic between connectBroker and activateAccount
 */
async function handleBrokerOperation(
  req: AuthenticatedRequest,
  res: Response,
  options: UnifiedBrokerOperationOptions = {}
): Promise<void> {
  const { accountId, enableDetailedLogging = false, responseFormat = 'connect' } = options;
  const isActivation = !!accountId;

  try {
    // Step 1: Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Step 2: Get broker name and credentials
    let brokerName: string;
    let credentials: any;

    if (isActivation) {
      // For activation: get from database
      const account = await userDatabase.getConnectedAccountById(accountId);
      if (!account) {
        res.status(404).json({
          success: false,
          message: 'Account not found',
        });
        return;
      }

      // Be defensive about broker name shape in DB (broker_name vs brokerName vs broker_display_name)
      const rawBrokerName = (account as any).broker_name ?? (account as any).brokerName ?? (account as any).broker_display_name;
      if (!rawBrokerName) {
        res.status(500).json({ success: false, message: 'Broker name missing for this account. Please reconnect the broker.' });
        return;
      }
      brokerName = String(rawBrokerName);

      credentials = await userDatabase.getAccountCredentials(accountId);
      if (!credentials) {
        res.status(500).json({
          success: false,
          message: 'Failed to retrieve account credentials',
        });
        return;
      }
    } else {
      // For new connection: get from request body
      const body = req.body;
      brokerName = body.brokerName;
      credentials = body.credentials;
      // Normalize credentials for specific brokers
      if (brokerName === 'fyers' && credentials) {
        // Unified broker expects appId/secretId; accept clientId/secretKey from UI/API
        credentials = {
          ...credentials,
          appId: credentials.appId || credentials.clientId,
          secretId: credentials.secretId || credentials.secretKey,
        };
      }

      if (!brokerName || !credentials) {
        res.status(400).json({
          success: false,
          message: 'Broker name and credentials are required',
        });
        return;
      }
    }

    console.log(`🔄 ${isActivation ? 'Activating' : 'Connecting'} ${brokerName} account for user ${userId}`);

    // Step 3: Perform the operation using unified method
    const result = await connectAndSaveAccount(userId, brokerName, credentials, {
      ...(accountId && { accountId }),
      enableDetailedLogging
    });

    // Step 4: Handle response based on result and format
    if (result.success && result.data) {
      if (result.requiresAuthCode && result.authUrl) {
        // OAuth flow required
        handleOAuthResponse(res, result, userId, brokerName, credentials, responseFormat);
      } else {
        // Direct success
        handleSuccessResponse(res, result, responseFormat, accountId);
      }
    } else {
      // Operation failed
      handleErrorResponse(res, result, responseFormat);
    }

  } catch (error: any) {
    console.error(`🚨 ${isActivation ? 'Activation' : 'Connection'} error:`, error);
    // For connect failures, return 400 with broker message to aid debugging
    const statusCode = isActivation ? 500 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || `Failed to ${isActivation ? 'activate' : 'connect'} broker account`,
    });
  }
}

/**
 * Helper function to handle OAuth response formatting
 */
function handleOAuthResponse(
  res: Response,
  result: any,
  userId: string,
  brokerName: string,
  credentials: any,
  responseFormat: 'connect' | 'activate'
): void {
  console.log('🔄 OAuth flow required for', brokerName);

  // Generate secure state token for OAuth
  const stateToken = crypto.randomBytes(32).toString('hex');

  // Store OAuth state for secure callback handling
  oauthStateManager.storeState(
    stateToken,
    userId,
    brokerName,
    result.data.id.toString(),
    credentials,
    credentials.redirectUri
  );

  // Append state token to OAuth URL for security
  const secureAuthUrl = `${result.authUrl}&state=${stateToken}`;

  if (responseFormat === 'connect') {
    // Minimal OAuth response for new connection
    res.status(200).json({
      success: true,
      message: 'OAuth authentication required',
      data: {
        authUrl: secureAuthUrl,
        requiresAuthCode: true,
        accountStatus: ACCOUNT_STATUS.PROCEED_TO_OAUTH,
        authenticationStep: AUTHENTICATION_STEP.OAUTH_REQUIRED,
        stateToken
      }
    });
  } else {
    // Activate flow: return top-level authUrl (matches main branch + frontend expectations)
    res.status(200).json({
      success: false,
      message: 'OAuth authentication required',
      authUrl: secureAuthUrl,
      authenticationStep: AUTHENTICATION_STEP.OAUTH_REQUIRED,
      accountStatus: ACCOUNT_STATUS.PROCEED_TO_OAUTH,
      stateToken
    });
  }
}

/**
 * Helper function to handle success response formatting
 */
function handleSuccessResponse(
  res: Response,
  result: any,
  responseFormat: 'connect' | 'activate',
  accountId?: string
): void {
  if (responseFormat === 'connect') {
    // Connect broker response format
    const accountResponse = {
      id: result.data.id,
      brokerName: result.data.broker_name,
      accountId: result.data.account_id,
      userId: result.data.user_id.toString(),
      userName: result.data.user_name,
      email: result.data.email,
      brokerDisplayName: result.data.broker_display_name,
      exchanges: JSON.parse(result.data.exchanges || '[]'),
      products: JSON.parse(result.data.products || '[]'),
      isActive: result.data.account_status === ACCOUNT_STATUS.ACTIVE,
      accountStatus: result.data.account_status,
      tokenExpiryTime: result.data.token_expiry_time,
      createdAt: result.data.created_at,
    };

    res.status(200).json({
      success: true,
      message: result.message,
      data: accountResponse
    });
  } else {
    // Activate account response format
    const response: ActivateAccountResponse = createActivationResponse(
      true,
      result.message,
      {
        accountId: accountId!,
        isActive: true,
        authStep: AUTHENTICATION_STEP.ACTIVE as any,
        additionalData: {
          brokerName: result.data.broker_name,
          userName: result.data.user_name,
          exchanges: JSON.parse(result.data.exchanges || '[]'),
          products: JSON.parse(result.data.products || '[]')
        }
      }
    );

    res.status(200).json(response);
  }
}

/**
 * Helper function to handle error response formatting
 */
function handleErrorResponse(
  res: Response,
  result: any,
  responseFormat: 'connect' | 'activate'
): void {
  if (responseFormat === 'connect') {
    // Connect broker error format
    res.status(400).json({
      success: false,
      message: result.message || 'Failed to connect to broker'
    });
  } else {
    // Activate account error format
    const errorCode = ApiErrorCode.BROKER_ERROR;
    const response: ActivateAccountResponse = createActivationResponse(
      false,
      result.message || 'Failed to activate account',
      undefined,
      {
        code: errorCode,
        message: result.message || 'Failed to activate account',
        details: result.message || 'Failed to activate account'
      }
    );

    res.status(400).json(response);
  }
}

export const connectBroker = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<void> => {
  await handleBrokerOperation(req, res, {
    responseFormat: 'connect',
    enableDetailedLogging: true
  });
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

    // Complete OAuth authentication using unified broker service
    const brokerName = credentials.brokerName || req.body.brokerName || 'fyers';
    try {
      const factory = UnifiedBrokerFactory.getInstance();
      const brokerService = factory.createBroker(brokerName);
      const result = await brokerService.completeOAuth(authCode, credentials);

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
          // In-memory broker account cache removed
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

    // Get connected accounts from database (now resolved via broker-specific status resolvers)
    try {
      const dbAccounts = await userDatabase.getConnectedAccountsByUserId(userId);

      const accountsWithValidatedStatus = await Promise.all(
        dbAccounts.map(async (dbAccount: any) => {
          console.log(`🔄 Checking account status for ${dbAccount.broker_name} account ${dbAccount.account_id}`);

          const effective = resolveAccountEffectiveStatus(dbAccount);

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
            isActive: effective.isActive,
            accountStatus: effective.accountStatus,
            tokenExpiryTime: dbAccount.token_expiry_time,
            isTokenExpired: effective.isTokenExpired,
            shouldShowActivateButton: effective.shouldShowActivateButton,
            shouldShowDeactivateButton: effective.shouldShowDeactivateButton,
            createdAt: dbAccount.created_at,
          };

          console.log('🔍 DEBUG: Returning account data:', accountData);
          return accountData;
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
      res.status(401).json({ success: false, message: 'User not authenticated or account ID missing' });
      return;
    }

    // Get account and credentials from database
    const account = await userDatabase.getConnectedAccountById(accountId);
    if (!account) {
      res.status(404).json({ success: false, message: 'Account not found' });
      return;
    }

    const credentials = await userDatabase.getAccountCredentials(account.id);
    if (!credentials) {
      res.status(200).json({
        success: true,
        data: {
          accountId: account.id,
          brokerName: account.broker_name,
          isActive: false,
          sessionInfo: {
            lastChecked: new Date().toISOString(),
            status: 'inactive',
            message: 'No credentials found; authentication required'
          }
        }
      });
      return;
    }

    // Stateless session validation via unified broker service
    const factory = UnifiedBrokerFactory.getInstance();
    const brokerService = factory.createBroker(account.broker_name);
    const validationResult = await brokerService.validateSession(credentials);

    const isActive = validationResult.isValid;
    const status = isActive ? 'active' : (validationResult.accountStatus === 'REFRESH_REQUIRED' ? 'expired' : 'inactive');
    const message = validationResult.message || (isActive ? 'Session is valid and active' : 'Session inactive');

    res.status(200).json({
      success: true,
      data: {
        accountId: account.id,
        brokerName: account.broker_name,
        isActive,
        sessionInfo: {
          lastChecked: new Date().toISOString(),
          status,
          message
        },
      },
    });
  } catch (error: any) {
    console.error('🚨 Check session status error:', error);
    res.status(500).json({ success: false, message: 'Failed to check session status' });
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

      // Stateless: perform broker-specific disconnect via service (optional)
      try {
        const service = UnifiedBrokerFactory.getInstance().createBroker(account.broker_name);
        await service.disconnect();
        console.log('✅ Successfully logged out from broker:', account.broker_name);
      } catch (logoutError: any) {
        console.error('⚠️ Logout error (continuing with removal):', logoutError.message);
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

      // In-memory broker account cache removed

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
  const { accountId } = req.params;
  await handleBrokerOperation(req, res, {
    accountId,
    responseFormat: 'activate',
    enableDetailedLogging: false
  });
};

// Deactivate an account (just change status in database)
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

    // Simply update the account status to INACTIVE in the database
    await userDatabase.updateConnectedAccount(accountId, {
      account_status: ACCOUNT_STATUS.INACTIVE
    });

    console.log(`✅ Account ${accountId} (${account.broker_name}) marked as inactive in database`);

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

    // Stateless disconnect: call broker service disconnect (optional)
    try {
      const service = UnifiedBrokerFactory.getInstance().createBroker(brokerName);
      await service.disconnect();
    } catch (e) {
      console.warn('⚠️ Disconnect warning:', (e as any).message);
    }

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

    // Fetch symbol metadata from database for broker handlers
    let symbolMetadata = null;
    try {
      const { symbolDatabaseService } = require('../services/symbolDatabaseService');
      if (symbolDatabaseService && symbolDatabaseService.isReady()) {
        symbolMetadata = await symbolDatabaseService.getSymbolByTradingSymbol(symbol, exchange || 'NSE');
      }
    } catch (error: any) {
      console.log(`⚠️ Could not fetch symbol metadata for ${symbol}: ${error.message}`);
    }

    // Create unified order request template
    const baseOrderRequest = {
      symbol: symbol, // Use symbol as provided by UI
      action: action as 'BUY' | 'SELL',
      quantity: parseInt(quantity),
      orderType: orderType as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
      ...(price ? { price: parseFloat(price) } : {}),
      triggerPrice: triggerPrice ? parseFloat(triggerPrice) : undefined,
      exchange: exchange || 'NSE',
      productType: rawProductType,
      validity: 'DAY' as 'DAY' | 'IOC' | 'GTD', // RAVI TODO why is it hardcoded?
      remarks: remarks || `Multi-account order placed via CopyTrade Pro`,
      symbolMetadata: symbolMetadata, // MongoDB object for broker handlers
    };

    // Place orders on all selected accounts
    const successfulOrders = [];
    const failedOrders = [];

    for (const account of accounts) {
      try {
        console.log(`🔄 Placing order on ${account.broker_name} account ${account.account_id}...`);

        // Proceed regardless of cached connection; we'll connect per request using DB credentials

        // Convert standardized symbol to broker-specific format if metadata is available
        let finalSymbol = symbol;
        let finalExchange = exchange || 'NSE';
        try {
          if (symbolMetadata) {
            const converted = convertSymbolForBroker(symbolMetadata, account.broker_name);
            if (converted?.tradingSymbol) {
              finalSymbol = converted.tradingSymbol;
              finalExchange = converted.exchange || finalExchange;
            }
          }
        } catch (convErr: any) {
          console.log(`⚠️ Symbol conversion failed for broker ${account.broker_name}, using input symbol: ${convErr?.message || convErr}`);
        }

        // Create account-specific order request
        const orderRequest = {
          ...baseOrderRequest,
          symbol: finalSymbol,
          exchange: finalExchange,
          accountId: account.account_id,
          remarks: `${baseOrderRequest.remarks} - Account: ${account.account_id}`
        };

        // Place order using unified broker interface
        const orderResponse = await placeBrokerOrder(userId, account.broker_name, account.id.toString(), orderRequest);

        if (orderResponse.success) {
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
          orderType: orderType as string
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

// Refresh order status for all pending orders
export const refreshAllOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const userId = req.user?.id;

    const context: any = {
      requestId,
      userId,
      operation: 'REFRESH_ALL_ORDER_STATUS',
      component: 'BROKER_CONTROLLER'
    };

    // Validate authentication
    const authValidation = OrderStatusErrorHandler.validateAuthentication(userId);
    if (!authValidation.isValid) {
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.AUTHENTICATION_ERROR,
        context
      );
    }

    logger.info('Manual order status refresh requested', context);

    const result = await orderStatusService.refreshAllOrderStatus(userId!);
    const duration = Date.now() - startTime;
    context.duration = duration;

    if (result.success) {
      return OrderStatusErrorHandler.sendSuccessResponse(res, result, context);
    } else {
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.INTERNAL_ERROR,
        context,
        result.message || 'Failed to refresh order status'
      );
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorContext: any = {
      requestId,
      userId: req.user?.id,
      operation: 'REFRESH_ALL_ORDER_STATUS',
      component: 'BROKER_CONTROLLER',
      duration
    };

    return OrderStatusErrorHandler.sendErrorResponse(
      res,
      OrderStatusErrorCode.INTERNAL_ERROR,
      errorContext,
      'Failed to refresh order status',
      { originalError: error.message }
    );
  }
};

// Refresh order status for a specific order
export const refreshOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const userId = req.user?.id;
    const { orderId } = req.params;

    const context: any = {
      requestId,
      userId,
      orderId,
      operation: 'REFRESH_ORDER_STATUS',
      component: 'BROKER_CONTROLLER'
    };

    // Validate authentication
    const authValidation = OrderStatusErrorHandler.validateAuthentication(userId);
    if (!authValidation.isValid) {
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.AUTHENTICATION_ERROR,
        context
      );
    }

    // Validate order ID
    const orderIdValidation = OrderStatusErrorHandler.validateOrderId(orderId);
    if (!orderIdValidation.isValid) {
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.MISSING_ORDER_ID,
        context
      );
    }

    logger.info('Manual order status refresh requested for specific order', context);

    const result = await orderStatusService.refreshOrderStatus(orderId, userId!);
    const duration = Date.now() - startTime;
    context.duration = duration;

    if (result.success) {
      return OrderStatusErrorHandler.sendSuccessResponse(res, result, context);
    } else {
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.INTERNAL_ERROR,
        context,
        result.message || 'Failed to refresh order status'
      );
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    const errorContext: any = {
      requestId,
      userId: req.user?.id,
      orderId: req.params?.orderId,
      operation: 'REFRESH_ORDER_STATUS',
      component: 'BROKER_CONTROLLER',
      duration
    };

    return OrderStatusErrorHandler.sendErrorResponse(
      res,
      OrderStatusErrorCode.INTERNAL_ERROR,
      errorContext,
      'Failed to refresh order status',
      { originalError: error.message }
    );
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
    const orderHistory = await userDatabase.getOrderHistoryById(orderId);
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

    // Account status validation is handled by UI

    try {
      // Cancel order using stateless unified broker service
      const credentials = await userDatabase.getAccountCredentials(account.id);
      const brokerService = UnifiedBrokerFactory.getInstance().createBroker(account.broker_name);
      await brokerService.connect(credentials).catch(() => {});

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
    const orderHistory = await userDatabase.getOrderHistoryById(orderId);
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

    // Account status validation is handled by UI

    try {
      // Modify order using stateless unified broker service
      const credentials = await userDatabase.getAccountCredentials(account.id);
      const brokerService = UnifiedBrokerFactory.getInstance().createBroker(account.broker_name);
      await brokerService.connect(credentials).catch(() => {});

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
/**
 * Consolidated order status check - single unified endpoint for checking order status
 * Supports both internal order IDs and broker order IDs
 */
/**
 * Consolidated order status controller method - the single unified endpoint for checking order status
 * Supports both internal order IDs and broker order IDs
 * Implements proper input validation, user ownership verification, and fresh status retrieval
 * Requirements: 1.1, 1.3, 3.2, 4.2
 */
export const checkOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const operationId = `checkOrderStatus_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const userId = req.user?.id;
    const { orderId, brokerName } = req.body;

    const context: any = {
      requestId,
      operationId,
      userId,
      orderId,
      brokerName,
      operation: 'CHECK_ORDER_STATUS',
      component: 'BROKER_CONTROLLER',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      sessionId: req.headers['x-session-id'] as string,
      url: req.originalUrl,
      method: req.method
    };

    // Start comprehensive performance tracking
    orderStatusLogger.startPerformanceTracking(operationId, 'checkOrderStatus', context);

    // Enhanced logging for request start with structured data
    logger.info('Consolidated order status check initiated', context, {
      requestBody: { orderId, brokerName },
      headers: {
        userAgent: req.headers['user-agent'],
        contentType: req.headers['content-type'],
        origin: req.headers['origin']
      }
    });

    // Comprehensive input validation using standardized error handler with enhanced logging
    logger.debug('Starting input validation', context, {
      hasUserId: !!userId,
      hasOrderId: !!orderId,
      hasBrokerName: !!brokerName,
      orderIdLength: orderId?.length,
      brokerNameValue: brokerName
    });

    const authValidation = OrderStatusErrorHandler.validateAuthentication(userId);
    if (!authValidation.isValid) {
      logger.warn('Authentication validation failed', context, {
        validationResult: authValidation,
        errorType: 'AUTHENTICATION_ERROR'
      });
      orderStatusLogger.endPerformanceTracking(operationId, false, 'AUTHENTICATION_ERROR');
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.AUTHENTICATION_ERROR,
        context
      );
    }

    const orderIdValidation = OrderStatusErrorHandler.validateOrderId(orderId);
    if (!orderIdValidation.isValid) {
      logger.warn('Order ID validation failed', context, {
        validationResult: orderIdValidation,
        providedOrderId: orderId,
        errorType: 'MISSING_ORDER_ID'
      });
      orderStatusLogger.endPerformanceTracking(operationId, false, 'MISSING_ORDER_ID');
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.MISSING_ORDER_ID,
        context
      );
    }

    const brokerNameValidation = OrderStatusErrorHandler.validateBrokerName(brokerName);
    if (!brokerNameValidation.isValid) {
      logger.warn('Broker name validation failed', context, {
        validationResult: brokerNameValidation,
        providedBrokerName: brokerName,
        errorType: 'INVALID_BROKER_NAME'
      });
      orderStatusLogger.endPerformanceTracking(operationId, false, 'INVALID_BROKER_NAME');
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.INVALID_BROKER_NAME,
        context
      );
    }

    logger.debug('Input validation completed successfully', context);

    const trimmedOrderId = orderId.trim();
    context.orderId = trimmedOrderId;

    // Log database lookup start with performance tracking
    const dbLookupStartTime = Date.now();
    logger.info('Searching for order in database', {
      ...context,
      operation: 'DATABASE_LOOKUP'
    }, {
      searchOrderId: trimmedOrderId,
      searchMethods: ['getOrderHistoryById', 'getOrderHistoryByBrokerOrderId']
    });

    // Try to find order in database first by internal ID (string format)
    let orderHistory;
    let dbLookupMethod = '';
    try {
      // First attempt: search by internal order ID
      dbLookupMethod = 'getOrderHistoryById';
      logger.debug('Attempting database lookup by internal ID', context, {
        method: dbLookupMethod,
        searchId: trimmedOrderId
      });

      orderHistory = await userDatabase.getOrderHistoryById(trimmedOrderId);

      // If not found by internal ID, try broker order ID
      if (!orderHistory) {
        dbLookupMethod = 'getOrderHistoryByBrokerOrderId';
        logger.debug('Attempting database lookup by broker order ID', context, {
          method: dbLookupMethod,
          searchId: trimmedOrderId
        });
        orderHistory = await userDatabase.getOrderHistoryByBrokerOrderId(trimmedOrderId);
      }

      const dbLookupDuration = Date.now() - dbLookupStartTime;

      // Log database operation result
      orderStatusLogger.logDatabaseOperation(context, 'orderLookup', !!orderHistory, {
        queryTime: dbLookupDuration,
        method: dbLookupMethod,
        found: !!orderHistory,
        searchId: trimmedOrderId
      });

      logger.info('Database lookup completed', context, {
        found: !!orderHistory,
        method: dbLookupMethod,
        duration: dbLookupDuration,
        orderId: orderHistory?.id,
        brokerOrderId: orderHistory?.broker_order_id
      });

    } catch (dbError: any) {
      const dbLookupDuration = Date.now() - dbLookupStartTime;

      logger.error('Database error during order lookup', context, {
        errorMessage: dbError.message,
        method: dbLookupMethod,
        duration: dbLookupDuration,
        searchId: trimmedOrderId
      });

      // Log database operation failure
      orderStatusLogger.logDatabaseOperation(context, 'orderLookup', false, {
        queryTime: dbLookupDuration,
        method: dbLookupMethod,
        error: dbError,
        retryable: true
      });

      orderStatusLogger.endPerformanceTracking(operationId, false, 'DATABASE_ERROR');
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.DATABASE_ERROR,
        context,
        'Failed to retrieve order from database'
      );
    }

    if (!orderHistory) {
      logger.warn('Order not found in database', context, {
        searchId: trimmedOrderId,
        searchMethods: ['getOrderHistoryById', 'getOrderHistoryByBrokerOrderId'],
        errorType: 'ORDER_NOT_FOUND'
      });
      orderStatusLogger.endPerformanceTracking(operationId, false, 'ORDER_NOT_FOUND');
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.ORDER_NOT_FOUND,
        context
      );
    }

    // Update context with order details for enhanced logging
    context.brokerName = orderHistory.broker_name;
    context.accountId = orderHistory.account_id?.toString();
    context.symbol = orderHistory.symbol;
    context.quantity = orderHistory.quantity;
    context.price = orderHistory.price;
    context.orderType = orderHistory.order_type;
    context.productType = orderHistory.product_type;
    context.orderNumber = orderHistory.broker_order_id;

    logger.info('Order found in database', context, {
      orderDetails: {
        internalId: orderHistory.id.toString(),
        brokerOrderId: orderHistory.broker_order_id,
        symbol: orderHistory.symbol,
        action: orderHistory.action,
        quantity: orderHistory.quantity,
        price: orderHistory.price,
        currentStatus: orderHistory.status,
        brokerName: orderHistory.broker_name,
        accountId: orderHistory.account_id,
        createdAt: orderHistory.created_at
      }
    });

    // User ownership verification before returning order status with enhanced logging
    logger.debug('Validating order ownership', context, {
      orderOwnerId: orderHistory.user_id.toString(),
      requestUserId: userId!.toString(),
      ownershipMatch: orderHistory.user_id.toString() === userId!.toString()
    });

    const ownershipValidation = OrderStatusErrorHandler.validateOrderOwnership(
      orderHistory.user_id.toString(),
      userId!.toString()
    );
    if (!ownershipValidation.isValid) {
      logger.warn('Order ownership validation failed', context, {
        orderOwnerId: orderHistory.user_id.toString(),
        requestUserId: userId!.toString(),
        validationResult: ownershipValidation,
        errorType: 'ACCESS_DENIED'
      });
      orderStatusLogger.endPerformanceTracking(operationId, false, 'ACCESS_DENIED');
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.ACCESS_DENIED,
        context
      );
    }

    // Validate broker name matches order if provided with enhanced logging
    logger.debug('Validating broker name match', context, {
      orderBrokerName: orderHistory.broker_name,
      requestBrokerName: brokerName,
      brokerMatch: orderHistory.broker_name === brokerName
    });

    const brokerMatchValidation = OrderStatusErrorHandler.validateBrokerMatch(
      orderHistory.broker_name,
      brokerName
    );
    if (!brokerMatchValidation.isValid) {
      logger.warn('Broker name validation failed', context, {
        orderBrokerName: orderHistory.broker_name,
        requestBrokerName: brokerName,
        validationResult: brokerMatchValidation,
        errorType: 'BROKER_MISMATCH'
      });
      orderStatusLogger.endPerformanceTracking(operationId, false, 'BROKER_MISMATCH');
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        OrderStatusErrorCode.BROKER_MISMATCH,
        context,
        `Order belongs to ${orderHistory.broker_name}, not ${brokerName}`
      );
    }

    logger.debug('All validations passed successfully', context);

    // Log broker API call initiation with comprehensive context
    const brokerApiStartTime = Date.now();
    logger.info('Order found, retrieving fresh status from broker', {
      ...context,
      operation: 'BROKER_API_CALL'
    }, {
      orderDetails: {
        internalId: orderHistory.id.toString(),
        brokerOrderId: orderHistory.broker_order_id,
        currentStatus: orderHistory.status,
        symbol: orderHistory.symbol,
        brokerName: orderHistory.broker_name,
        accountId: orderHistory.account_id?.toString()
      }
    });

    // Log the order status request for audit trail
    orderStatusLogger.logOrderStatusRequest({
      ...context,
      apiEndpoint: 'getOrderStatus'
    });

    // Get fresh status from broker APIs with error handling and performance tracking
    try {
      // Stateless: instantiate broker service and validate/connect using DB credentials
      const credentials = await userDatabase.getAccountCredentials(orderHistory.account_id);
      if (!credentials) {
        logger.warn('No credentials found for account', context, {
          brokerName: orderHistory.broker_name,
          accountId: orderHistory.account_id?.toString(),
          errorType: 'AUTHENTICATION_ERROR'
        });
        orderStatusLogger.endPerformanceTracking(operationId, false, 'AUTHENTICATION_ERROR');
        return OrderStatusErrorHandler.sendErrorResponse(
          res,
          OrderStatusErrorCode.AUTHENTICATION_ERROR,
          context,
          'Credentials not found; please activate the account.'
        );
      }

      const factory = UnifiedBrokerFactory.getInstance();
      const brokerService = factory.createBroker(orderHistory.broker_name);

      // Connect for brokers that need it; proceed if validation indicates refresh required/inactive accordingly
      const connectResult = await brokerService.connect(credentials);
      if (!connectResult.success && connectResult.authenticationStep === 'OAUTH_REQUIRED') {
        logger.warn('OAuth required for account before fetching order status', context);
        orderStatusLogger.endPerformanceTracking(operationId, false, 'AUTHENTICATION_ERROR');
        return OrderStatusErrorHandler.sendErrorResponse(
          res,
          OrderStatusErrorCode.AUTHENTICATION_ERROR,
          context,
          'Account requires OAuth authentication. Please activate the account.'
        );
      }

      logger.debug('Broker service instantiated successfully', context, {
        brokerName: orderHistory.broker_name,
        serviceType: brokerService.constructor.name
      });

      // Import comprehensive error handler for enhanced error handling
      const { comprehensiveErrorHandler } = await import('../services/comprehensiveErrorHandler');

      const brokerContext: any = {
        userId: userId!,
        brokerName: orderHistory.broker_name,
        accountId: orderHistory.account_id?.toString() || 'unknown',
        operation: 'checkOrderStatus',
        timestamp: new Date(),
        requestId,
        operationId
      };

      // Log broker API call start with detailed context
      logger.info('Calling broker API for order status', context, {
        brokerOrderId: orderHistory.broker_order_id,
        brokerName: orderHistory.broker_name,
        accountId: orderHistory.account_id?.toString(),
        retryConfig: {
          maxRetries: 2,
          baseDelay: 1000,
          maxDelay: 5000
        }
      });

      // Get fresh status from broker API with comprehensive error handling and performance tracking
      const apiCallStartTime = Date.now();
      const freshStatus = await comprehensiveErrorHandler.executeWithRetry(
        async () => {
          logger.debug('Executing broker API call', context, {
            brokerOrderId: orderHistory.broker_order_id,
            attempt: 'executing'
          });

          return await brokerService.getOrderStatus(
            userId!,
            orderHistory.broker_order_id
          );
        },
        brokerContext,
        {
          maxRetries: 2,
          baseDelay: 1000,
          maxDelay: 5000
        }
      );

      const apiCallDuration = Date.now() - apiCallStartTime;
      context.responseTime = apiCallDuration;

      logger.info('Broker API call completed', context, {
        duration: apiCallDuration,
        hasResponse: !!freshStatus,
        responseType: typeof freshStatus,
        responseStatus: freshStatus?.stat || freshStatus?.status,
        brokerOrderId: orderHistory.broker_order_id
      });

      let statusChanged = false;
      let updatedOrderHistory = orderHistory;

      // Process broker API response with comprehensive logging
      if (freshStatus && freshStatus.stat === 'Ok') {
        logger.info('Broker API returned successful response', context, {
          brokerResponse: {
            status: freshStatus.status,
            executedQuantity: freshStatus.executedQuantity,
            averagePrice: freshStatus.averagePrice,
            rejectionReason: freshStatus.rejectionReason,
            updateTime: freshStatus.updateTime
          },
          currentOrderStatus: orderHistory.status,
          statusWillChange: freshStatus.status !== orderHistory.status
        });

        // Log successful order status response
        orderStatusLogger.logOrderStatusSuccess(context, freshStatus);

        let dbUpdateStartTime = Date.now();
        try {
          // Import the enhanced order status update service
          const { orderStatusUpdateService } = await import('../services/orderStatusUpdateService');
          logger.info('Initiating comprehensive order status update', context, {
            updateData: {
              orderId: orderHistory.id.toString(),
              newStatus: freshStatus.status,
              executedQuantity: freshStatus.executedQuantity || 0,
              averagePrice: freshStatus.averagePrice || 0,
              rejectionReason: freshStatus.rejectionReason
            },
            updateOptions: {
              broadcastUpdate: true,
              requireAcknowledgment: false,
              maxBroadcastRetries: 3,
              skipIfUnchanged: true
            }
          });

          const updateResult = await orderStatusUpdateService.updateOrderStatusComprehensive(
            orderHistory.id.toString(),
            {
              status: freshStatus.status,
              executedQuantity: freshStatus.executedQuantity || 0,
              averagePrice: freshStatus.averagePrice || 0,
              rejectionReason: freshStatus.rejectionReason,
              updateTime: freshStatus.updateTime ? new Date(freshStatus.updateTime) : new Date(),
              brokerResponse: freshStatus
            },
            userId!,
            {
              broadcastUpdate: true,
              requireAcknowledgment: false,
              maxBroadcastRetries: 3,
              skipIfUnchanged: true
            }
          );

          const dbUpdateDuration = Date.now() - dbUpdateStartTime;

          if (updateResult.success && updateResult.updated) {
            statusChanged = true;
            updatedOrderHistory = updateResult.orderHistory || orderHistory;

            logger.info('Order status updated comprehensively', {
              ...context,
              operation: 'COMPREHENSIVE_UPDATE'
            }, {
              updateResult: {
                orderInternalId: orderHistory.id,
                previousStatus: orderHistory.status,
                newStatus: freshStatus.status,
                dbUpdateDuration,
                broadcastSuccess: updateResult.broadcastResult?.success || false,
                retriesUsed: updateResult.broadcastResult?.retriesUsed || 0
              }
            });

            // Log database operation success
            orderStatusLogger.logDatabaseOperation(context, 'updateOrderStatus', true, {
              queryTime: dbUpdateDuration,
              recordsAffected: 1,
              previousStatus: orderHistory.status,
              newStatus: freshStatus.status
            });

            // Log WebSocket broadcast result with detailed information
            if (updateResult.broadcastResult) {
              const broadcastData = {
                orderId: orderHistory.id.toString(),
                status: freshStatus.status,
                recipientCount: 1,
                type: 'orderStatusUpdate',
                broadcastDuration: (updateResult.broadcastResult as any).duration || 0
              };

              if (updateResult.broadcastResult.success) {
                logger.info('Order update broadcasted successfully via WebSocket', {
                  ...context,
                  operation: 'WEBSOCKET_BROADCAST_SUCCESS'
                }, {
                  broadcastResult: {
                    retriesUsed: updateResult.broadcastResult.retriesUsed || 0,
                    duration: (updateResult.broadcastResult as any).duration,
                    recipientUserId: userId!.toString()
                  }
                });

                // Log WebSocket broadcast success
                orderStatusLogger.logWebSocketBroadcast(context, broadcastData);
              } else {
                logger.warn('Failed to broadcast order update via WebSocket', {
                  ...context,
                  operation: 'WEBSOCKET_BROADCAST_ERROR'
                }, {
                  broadcastError: {
                    error: updateResult.broadcastResult.error,
                    retriesUsed: updateResult.broadcastResult.retriesUsed || 0,
                    duration: (updateResult.broadcastResult as any).duration
                  }
                });
              }
            }
          } else if (!updateResult.success) {
            logger.error('Failed to update order status comprehensively', {
              ...context,
              operation: 'COMPREHENSIVE_UPDATE_ERROR'
            }, {
              updateError: updateResult.error,
              dbUpdateDuration
            });

            // Log database operation failure
            orderStatusLogger.logDatabaseOperation(context, 'updateOrderStatus', false, {
              queryTime: dbUpdateDuration,
              error: updateResult.error,
              retryable: true
            });

            orderStatusLogger.endPerformanceTracking(operationId, false, 'DATABASE_UPDATE_ERROR');
            return OrderStatusErrorHandler.sendErrorResponse(
              res,
              OrderStatusErrorCode.DATABASE_UPDATE_ERROR,
              context,
              'Failed to update order status in database'
            );
          } else {
            // No changes detected, use current order
            updatedOrderHistory = orderHistory;
            logger.debug('No order status changes detected, skipping update', {
              ...context,
              operation: 'NO_CHANGES_DETECTED'
            }, {
              currentStatus: orderHistory.status,
              brokerStatus: freshStatus.status,
              dbUpdateDuration
            });
          }
        } catch (updateError: any) {
          const dbUpdateDuration = Date.now() - dbUpdateStartTime;

          logger.error('Error during comprehensive order status update', context, {
            errorMessage: updateError.message,
            errorType: updateError.name,
            dbUpdateDuration,
            stackTrace: updateError.stack
          });

          // Log database operation failure
          orderStatusLogger.logDatabaseOperation(context, 'updateOrderStatus', false, {
            queryTime: dbUpdateDuration,
            error: updateError,
            retryable: true
          });

          orderStatusLogger.endPerformanceTracking(operationId, false, 'DATABASE_UPDATE_ERROR');
          return OrderStatusErrorHandler.sendErrorResponse(
            res,
            OrderStatusErrorCode.DATABASE_UPDATE_ERROR,
            context,
            'Failed to update order status in database'
          );
        }
      } else {
        // Handle cases where broker API didn't return successful response
        logger.warn('Broker API did not return successful response', context, {
          brokerResponse: freshStatus,
          hasResponse: !!freshStatus,
          responseStatus: freshStatus?.stat,
          errorMessage: freshStatus?.emsg
        });

        if (freshStatus) {
          // Log the error response from broker
          orderStatusLogger.logOrderStatusError(context, {
            message: freshStatus.emsg || 'Broker API returned unsuccessful response',
            errorType: 'BROKER_RESPONSE_ERROR',
            originalError: freshStatus
          });
        }
      }

      const totalDuration = Date.now() - startTime;
      const brokerApiDuration = Date.now() - brokerApiStartTime;
      context.duration = totalDuration;

      // Prepare success response data with comprehensive logging
      const responseData = {
        orderId: updatedOrderHistory.id.toString(),
        brokerOrderId: updatedOrderHistory.broker_order_id,
        status: freshStatus?.status || updatedOrderHistory.status,
        symbol: updatedOrderHistory.symbol,
        quantity: updatedOrderHistory.quantity,
        filledQuantity: freshStatus?.executedQuantity || 0,
        price: updatedOrderHistory.price,
        averagePrice: freshStatus?.averagePrice || 0,
        timestamp: freshStatus?.updateTime || updatedOrderHistory.created_at,
        brokerName: updatedOrderHistory.broker_name,
        rejectionReason: freshStatus?.rejectionReason || null,
        statusChanged,
        previousStatus: statusChanged ? orderHistory.status : null
      };

      logger.info('Order status check completed successfully', context, {
        responseData,
        performanceMetrics: {
          totalDuration,
          brokerApiDuration,
          statusChanged,
          finalStatus: responseData.status
        }
      });

      // End performance tracking with success
      orderStatusLogger.endPerformanceTracking(operationId, true);

      // Send standardized success response
      return OrderStatusErrorHandler.sendSuccessResponse(res, responseData, context);

    } catch (brokerError: any) {
      const totalDuration = Date.now() - startTime;
      const brokerApiDuration = Date.now() - brokerApiStartTime;
      context.duration = totalDuration;
      context.responseTime = brokerApiDuration;

      logger.error('Broker API error during order status check', context, {
        errorMessage: brokerError.message,
        errorType: brokerError.name,
        errorCode: brokerError.code,
        brokerName: orderHistory?.broker_name,
        brokerOrderId: orderHistory?.broker_order_id,
        performanceMetrics: {
          totalDuration,
          brokerApiDuration
        },
        stackTrace: brokerError.stack
      });

      // Log broker error for audit trail
      orderStatusLogger.logOrderStatusError(context, {
        message: brokerError.message,
        errorType: 'BROKER_API_ERROR',
        originalError: brokerError,
        retryable: true
      });

      // Categorize broker error using standardized error handler
      const { code, message } = OrderStatusErrorHandler.categorizeBrokerError(
        brokerError,
        orderHistory?.broker_name || 'unknown'
      );

      orderStatusLogger.endPerformanceTracking(operationId, false, 'BROKER_API_ERROR');
      return OrderStatusErrorHandler.sendErrorResponse(
        res,
        code,
        context,
        message,
        { originalError: brokerError.message }
      );
    }

  } catch (error: any) {
    const totalDuration = Date.now() - startTime;
    const errorContext: any = {
      requestId,
      operationId,
      userId: req.user?.id,
      orderId: req.body?.orderId,
      brokerName: req.body?.brokerName,
      operation: 'CHECK_ORDER_STATUS',
      component: 'BROKER_CONTROLLER',
      duration: totalDuration,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      url: req.originalUrl,
      method: req.method
    };

    logger.error('Unexpected error during order status check', errorContext, {
      errorMessage: error.message,
      errorType: error.name,
      errorCode: error.code,
      stackTrace: error.stack,
      performanceMetrics: {
        totalDuration
      }
    });

    // Log unexpected error for audit trail
    orderStatusLogger.logOrderStatusError(errorContext, {
      message: error.message,
      errorType: 'UNEXPECTED_ERROR',
      originalError: error,
      retryable: false
    });

    orderStatusLogger.endPerformanceTracking(operationId, false, 'UNEXPECTED_ERROR');
    return OrderStatusErrorHandler.sendErrorResponse(
      res,
      OrderStatusErrorCode.INTERNAL_ERROR,
      errorContext,
      'Internal server error occurred',
      { originalError: error.message }
    );
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

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }
    if (!brokerName) {
      res.status(400).json({ success: false, message: 'Missing required parameters: brokerName' });
      return;
    }

    // Helper to load order history from DB for one account
    const loadOrderHistoryForAccount = async (dbAccountId: string) => {
      try {
        const orders = await userDatabase.getOrderHistoryByUserIdWithFilters(userId!, undefined, undefined, {
          account_id: dbAccountId,
          broker_name: brokerName
        });
        return { accountId: dbAccountId, brokerName, orders };
      } catch (e) {
        console.error(`🚨 Failed to get order book for account ${dbAccountId}:`, (e as any).message);
        return { accountId: dbAccountId, brokerName, orders: [], error: 'Failed to fetch orders for this account' };
      }
    };

    if (accountId) {
      const result = await loadOrderHistoryForAccount(accountId as string);
      res.status(200).json({ success: true, data: result });
      return;
    }

    // No accountId: fetch for all accounts for this broker for this user
    const accounts = await userDatabase.getConnectedAccountsByUserId(userId);
    const brokerAccounts = accounts.filter((a: any) => a.broker_name === brokerName);
    const results = await Promise.all(brokerAccounts.map((a: any) => loadOrderHistoryForAccount(a.id.toString())));

    res.status(200).json({ success: true, data: { brokerName, accounts: results, totalAccounts: results.length } });
  } catch (error: any) {
    console.error('🚨 Get order book error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get order book' });
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
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const missingParams: string[] = [];
    if (!brokerName) missingParams.push('brokerName');
    if (!exchange) missingParams.push('exchange');
    if (!symbol) missingParams.push('symbol');

    if (missingParams.length > 0) {
      res.status(400).json({ success: false, message: `Missing required parameters: ${missingParams.join(', ')}` });
      return;
    }

    // Stateless: instantiate broker service and use DB credentials for the first account of this broker
    const accounts = await userDatabase.getConnectedAccountsByUserId(userId);
    const brokerAccounts = accounts.filter((a: any) => a.broker_name === brokerName);
    if (brokerAccounts.length === 0) {
      res.status(404).json({ success: false, message: `No accounts found for broker ${brokerName}` });
      return;
    }
    const chosen = accountId ? brokerAccounts.find((a: any) => a.id.toString() === String(accountId)) : brokerAccounts[0];
    if (!chosen) {
      res.status(404).json({ success: false, message: `Account ${accountId} not found for broker ${brokerName}` });
      return;
    }

    const credentials = await userDatabase.getAccountCredentials(chosen.id);
    const factory = UnifiedBrokerFactory.getInstance();
    const rawService = factory.createBroker(brokerName);
    const trackedService = createTrackedBrokerService(rawService, userId, brokerName, chosen.account_id);

    // For brokers that require connect before search, call connect; ignore OAuth-required case for search
    await rawService.connect(credentials).catch(() => {});

    console.log(`🔍 Searching symbol ${symbol} on ${exchange} via ${brokerName} account ${chosen.account_id}`);
    const searchResults = await trackedService.searchSymbols(`${symbol}:${exchange}`);

    res.status(200).json({
      success: true,
      data: {
        ...searchResults,
        searchedVia: {
          accountId: chosen.account_id,
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




