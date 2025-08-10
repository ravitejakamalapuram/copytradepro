# Broker Account Addition - Low Level Design

## Overview

This document provides a comprehensive low-level design of the broker account addition flows in the CopyTrade application. The system supports multiple brokers with different authentication mechanisms (direct credentials vs OAuth) and maintains a unified interface for account management.

## Architecture Components

### 1. Frontend Layer
- **AccountSetup.tsx**: Main UI component for broker account addition
- **OAuthDialog.tsx**: Modal for OAuth authentication flows
- **AccountStatusContext**: React context for account state management
- **accountService.ts**: Frontend service for API communication
- **brokerService.ts**: Frontend service for broker operations

### 2. Backend API Layer
- **broker.ts (routes)**: Express routes for broker operations
- **brokerController.ts**: Main controller handling broker requests
- **sessionHealthController.ts**: Account session management

### 3. Business Logic Layer
- Stateless connection pattern using **UnifiedBrokerFactory** from **@copytrade/unified-broker**
- **@copytrade/unified-broker**: External package for broker abstraction

### 4. Data Layer
- **mongoDatabase.ts**: MongoDB implementation
- **trackedDatabaseCompatibility.ts**: Database wrapper with logging
- **IDatabaseAdapter.ts**: Database interface abstraction

## Account Addition Flow Types

### Type 1: Direct Authentication (Shoonya)
```
User Input → Credentials Validation → Broker Login → Account Storage → Success
```

### Type 2: OAuth Authentication (Fyers)
```
User Input → OAuth URL Generation → User Authorization → Auth Code Exchange → Token Storage → Success
```

## Detailed Flow Analysis

### 1. Frontend Initiation

#### Component: AccountSetup.tsx
```typescript
// User selects broker and fills credentials
const handleSubmit = async () => {
  if (formData.brokerName === 'shoonya') {
    const credentials: ShoonyaCredentials = {
      userId, password, totpKey, vendorCode, apiSecret, imei
    };
    result = await brokerService.connectBroker('shoonya', credentials);
  } else if (formData.brokerName === 'fyers') {
    const credentials: FyersCredentials = {
      clientId, secretKey, redirectUri
    };
    result = await brokerService.connectBroker('fyers', credentials);
  }
};
```

#### Service: accountService.ts
```typescript
// Frontend service makes API call
async connectBroker(brokerName: string, credentials: any) {
  const response = await api.post('/broker/connect', {
    brokerName,
    credentials
  });
  return response.data;
}
```

### 2. Backend Processing

#### Route: broker.ts
```typescript
// Express route with validation
router.post('/connect', authenticateToken, connectBrokerValidation, connectBroker);
```

#### Controller: brokerController.ts
```typescript
export const connectBroker = async (req: Request, res: Response) => {
  const { brokerName, credentials } = req.body;
  const userId = req.user?.id;

  // Use enhanced unified broker manager
  const result = await enhancedUnifiedBrokerManager.connectToBroker(
    userId, 
    brokerName, 
    credentials
  );

  if (result.success) {
    // Handle different broker types
    if (result.requiresOAuth) {
      // OAuth flow (Fyers)
      return handleOAuthFlow(result, res);
    } else {
      // Direct flow (Shoonya)
      return handleDirectFlow(result, res);
    }
  }
};
```

### 3. Broker-Specific Processing

#### Enhanced Unified Broker Manager
```typescript
async connectToBroker(userId: string, brokerName: string, credentials: any) {
  // Get broker service from factory
  const brokerService = this.brokerFactory.createBroker(brokerName);
  
  // Attempt login through unified interface
  const loginResult = await brokerService.login(credentials);
  
  // Return standardized response
  return {
    success: loginResult.success,
    accountInfo: loginResult.accountInfo,
    tokenInfo: loginResult.tokenInfo,
    requiresOAuth: loginResult.requiresOAuth,
    authUrl: loginResult.authUrl
  };
}
```

### 4. Database Storage

#### Account Creation Flow
```typescript
// For successful connections
const dbAccount = await userDatabase.createConnectedAccount({
  user_id: userId,
  broker_name: brokerName,
  account_id: result.accountInfo.accountId,
  user_name: result.accountInfo.userName,
  email: result.accountInfo.email,
  broker_display_name: brokerName.toUpperCase(),
  exchanges: result.accountInfo.exchanges,
  products: result.accountInfo.products,
  credentials: encryptedCredentials,
  account_status: result.accountStatus,
  token_expiry_time: result.tokenInfo?.expiryTime,
  refresh_token_expiry_time: refreshTokenExpiry
});
```

#### Database Schema (MongoDB)
```typescript
interface ConnectedAccountDocument {
  user_id: ObjectId;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string; // JSON array
  products: string; // JSON array
  encrypted_credentials: string; // AES-256-CBC encrypted
  account_status: 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH';
  token_expiry_time: Date | null;
  refresh_token_expiry_time: Date | null;
  created_at: Date;
  updated_at: Date;
}
```

## Authentication Flow Details

### Shoonya (Direct Authentication)
1. **Frontend**: User enters credentials (userId, password, totpKey, etc.)
2. **Backend**: Validates credentials with Shoonya API
3. **Success**: Account marked as 'ACTIVE', tokens stored
4. **Storage**: Credentials encrypted and stored in database
5. **Response**: Account details returned to frontend

### Fyers (OAuth Authentication)
1. **Frontend**: User enters app credentials (clientId, secretKey, redirectUri)
2. **Backend**: Generates OAuth URL with state token
3. **Database**: Temporary account created with 'PROCEED_TO_OAUTH' status
4. **Frontend**: OAuthDialog opens with auth URL
5. **User**: Completes OAuth flow in browser
6. **Callback**: Auth code received via callback URL
7. **Backend**: Exchanges auth code for access/refresh tokens
8. **Update**: Account updated with tokens and marked 'ACTIVE'

## Security Considerations

### Credential Encryption
```typescript
// AES-256-CBC encryption for stored credentials
private encrypt(text: string): string {
  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}
```

### Token Management
- **Access Tokens**: Short-lived, used for API calls
- **Refresh Tokens**: Long-lived, used to refresh access tokens
- **Expiry Tracking**: Database stores expiry times for automatic refresh

## Error Handling

### Frontend Error Display
```typescript
// Toast notifications for user feedback
if (result.success) {
  showToast({
    type: 'success',
    title: 'Broker Connected!',
    message: 'Your broker account has been successfully connected.'
  });
} else {
  setError(result.message || 'Failed to connect broker');
}
```

### Backend Error Logging
```typescript
// Comprehensive error logging with context
return this.executeWithLogging(
  'CREATE_CONNECTED_ACCOUNT',
  'connected_accounts',
  async () => {
    const db = await this.getDb();
    return await db.createConnectedAccount(accountData);
  },
  {
    userId: accountData.user_id?.toString(),
    data: {
      broker_name: accountData.broker_name,
      account_id: accountData.account_id
    }
  }
);
```

## State Management

### Account Status States
- **INACTIVE**: Account exists but not authenticated
- **ACTIVE**: Account authenticated and ready for trading
- **PROCEED_TO_OAUTH**: OAuth flow required (Fyers)

### Frontend State Synchronization
```typescript
// React context provides centralized account state
const AccountStatusContext = createContext<{
  accounts: ConnectedAccount[];
  activateAccount: (accountId: string) => Promise<any>;
  deactivateAccount: (accountId: string) => Promise<boolean>;
  removeAccount: (accountId: string) => Promise<boolean>;
  refreshAccounts: () => Promise<void>;
}>();
```

## API Endpoints

### Core Broker Endpoints
- `POST /broker/connect` - Initial broker connection
- `POST /broker/oauth/complete` - Complete OAuth flow
- `GET /broker/oauth/callback` - OAuth callback handler
- `POST /broker/accounts/{id}/activate` - Activate account
- `POST /broker/accounts/{id}/deactivate` - Deactivate account
- `DELETE /broker/accounts/{id}` - Remove account
- `GET /broker/accounts` - List connected accounts
- `GET /broker/available` - List available brokers

### Request/Response Formats
```typescript
// Connect Request
{
  brokerName: string;
  credentials: ShoonyaCredentials | FyersCredentials;
}

// Connect Response
{
  success: boolean;
  message: string;
  data?: ConnectedAccount;
  authUrl?: string; // For OAuth flows
  requiresAuthCode?: boolean;
}
```

## Performance Considerations

### Caching Strategy
```typescript
// In-memory cache for active broker connections
private connections = new Map<string, BrokerConnection>();

// Cache key format: `${userId}:${brokerName}:${accountId}`
addToBrokerAccountCache(accountId, userId, brokerName, userName);
```

### Database Indexing
```typescript
// MongoDB indexes for performance
ConnectedAccountSchema.index({ user_id: 1, broker_name: 1 });
ConnectedAccountSchema.index({ account_id: 1, broker_name: 1 });
ConnectedAccountSchema.index({ user_id: 1, account_status: 1 });
```

## Future Enhancements

1. **Multi-Factor Authentication**: Additional security layers
2. **Broker Health Monitoring**: Real-time connection status
3. **Automated Token Refresh**: Background token management
4. **Account Linking**: Link multiple accounts from same broker
5. **Audit Trail**: Comprehensive logging of account operations
