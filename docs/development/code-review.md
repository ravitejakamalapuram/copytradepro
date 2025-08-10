# 🛠️ **CODE REVIEW IMPLEMENTATION GUIDE**

This file contains detailed implementation examples and code snippets for code review best practices.

---

## 🚨 **PHASE 1: SECURITY FIXES - IMPLEMENTATION EXAMPLES**

### **1.1 Remove Hardcoded Credentials**

**Current Issue:**
```javascript
// test_broker_apis.js - SECURITY RISK!
const SHOONYA_CREDENTIALS = {
  userId: 'FN135006',
  password: 'rAVI@1994', // Real password exposed!
  totpKey: 'P4325AWTC4E66D57E3A547H567A5T3GF'
};
```

**Solution:**
```javascript
// test_broker_apis.js - FIXED
const SHOONYA_CREDENTIALS = {
  userId: process.env.TEST_SHOONYA_USER_ID || 'TEST_USER',
  password: process.env.TEST_SHOONYA_PASSWORD || 'TEST_PASS',
  totpKey: process.env.TEST_SHOONYA_TOTP_KEY || 'TEST_TOTP_KEY',
  vendorCode: process.env.TEST_SHOONYA_VENDOR_CODE || 'TEST_VENDOR',
  apiSecret: process.env.TEST_SHOONYA_API_SECRET || 'TEST_SECRET',
  imei: process.env.TEST_SHOONYA_IMEI || 'TEST_IMEI'
};

// .env.test
TEST_SHOONYA_USER_ID=DUMMY_USER
TEST_SHOONYA_PASSWORD=DUMMY_PASS
TEST_SHOONYA_TOTP_KEY=DUMMY_TOTP_KEY
```

**Git Pre-commit Hook:**
```bash
#!/bin/sh
# .git/hooks/pre-commit
echo "Checking for hardcoded credentials..."

# Check for potential credential patterns
if git diff --cached --name-only | xargs grep -l "password.*=" | grep -v ".env"; then
    echo "❌ Potential hardcoded credentials found!"
    echo "Please use environment variables instead."
    exit 1
fi

echo "✅ No hardcoded credentials detected."
```

### **1.2 JWT Secret Validation**

**Current Issue:**
```typescript
// websocketService.ts - WEAK FALLBACK
const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
```

**Solution:**
```typescript
// utils/validateEnv.ts - NEW FILE
export function validateJWTSecret(): string {
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  
  if (jwtSecret === 'your-secret-key' || jwtSecret === 'default-secret') {
    throw new Error('JWT_SECRET cannot be a default value');
  }
  
  return jwtSecret;
}

// websocketService.ts - FIXED
import { validateJWTSecret } from '../utils/validateEnv';

const JWT_SECRET = validateJWTSecret();

authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    socket.userId = decoded.id;
    
    next();
  } catch (error: any) {
    next(new Error('Authentication error: Invalid token'));
  }
}
```

### **1.3 Token Blacklisting Implementation**

```typescript
// services/TokenBlacklist.ts - NEW FILE
export class TokenBlacklist {
  private blacklistedTokens = new Set<string>();
  private tokenExpiry = new Map<string, number>();

  blacklistToken(token: string, expiryTime?: number): void {
    this.blacklistedTokens.add(token);
    
    if (expiryTime) {
      this.tokenExpiry.set(token, expiryTime);
      // Auto-cleanup expired tokens
      setTimeout(() => {
        this.blacklistedTokens.delete(token);
        this.tokenExpiry.delete(token);
      }, expiryTime - Date.now());
    }
  }

  isBlacklisted(token: string): boolean {
    return this.blacklistedTokens.has(token);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [token, expiry] of this.tokenExpiry.entries()) {
      if (expiry <= now) {
        this.blacklistedTokens.delete(token);
        this.tokenExpiry.delete(token);
      }
    }
  }
}

// middleware/auth.ts - UPDATED
import { TokenBlacklist } from '../services/TokenBlacklist';

const tokenBlacklist = new TokenBlacklist();

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'Access token required' });
    return;
  }

  // Check if token is blacklisted
  if (tokenBlacklist.isBlacklisted(token)) {
    res.status(401).json({ success: false, message: 'Token has been revoked' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
};

// controllers/authController.ts - UPDATED LOGOUT
export const logout = (req: AuthenticatedRequest, res: Response): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    // Extract expiry from token
    const decoded = jwt.decode(token) as any;
    const expiryTime = decoded.exp * 1000; // Convert to milliseconds
    
    tokenBlacklist.blacklistToken(token, expiryTime);
  }

  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
};
```

---

## 🏗️ **PHASE 2: ARCHITECTURE - IMPLEMENTATION EXAMPLES**

### **2.1 Service Layer Implementation**

```typescript
// services/BrokerService.ts - NEW FILE
import { Logger } from '../utils/logger';
import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import { EnhancedUnifiedBrokerManager } from './enhancedUnifiedBrokerManager';

export interface ConnectionResult {
  success: boolean;
  accountId?: string;
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH';
  authUrl?: string;
  message: string;
}

export class BrokerService {
  constructor(
    private brokerManager: EnhancedUnifiedBrokerManager,
    private database: IDatabaseAdapter,
    private logger: Logger
  ) {}

  async connectBroker(
    userId: string, 
    brokerName: string, 
    credentials: any
  ): Promise<ConnectionResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Starting broker connection', { 
        userId, 
        brokerName,
        timestamp: new Date().toISOString()
      });

      // Validate credentials format
      await this.validateCredentials(brokerName, credentials);

      // Check for existing connection
      const existingConnection = await this.checkExistingConnection(userId, brokerName);
      if (existingConnection) {
        this.logger.warn('Connection already exists', { userId, brokerName });
        return {
          success: false,
          message: 'Connection already exists for this broker'
        };
      }

      // Connect to broker
      const result = await this.brokerManager.connectToBroker(userId, brokerName, credentials);

      // Store connection in database
      if (result.success) {
        await this.storeConnection(userId, brokerName, result);
        
        this.logger.info('Broker connection successful', {
          userId,
          brokerName,
          accountId: result.accountInfo?.accountId,
          duration: Date.now() - startTime
        });
      }

      return {
        success: result.success,
        accountId: result.accountInfo?.accountId,
        accountStatus: result.accountInfo?.accountStatus || 'INACTIVE',
        authUrl: result.authUrl,
        message: result.message
      };

    } catch (error: any) {
      this.logger.error('Broker connection failed', {
        userId,
        brokerName,
        error: error.message,
        stack: error.stack,
        duration: Date.now() - startTime
      });

      return {
        success: false,
        accountStatus: 'INACTIVE',
        message: `Connection failed: ${error.message}`
      };
    }
  }

  private async validateCredentials(brokerName: string, credentials: any): Promise<void> {
    const validators = {
      shoonya: (creds: any) => {
        const required = ['userId', 'password', 'totpKey', 'vendorCode', 'apiSecret', 'imei'];
        for (const field of required) {
          if (!creds[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
      },
      fyers: (creds: any) => {
        const required = ['clientId', 'secretKey', 'redirectUri'];
        for (const field of required) {
          if (!creds[field]) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
      }
    };

    const validator = validators[brokerName as keyof typeof validators];
    if (!validator) {
      throw new Error(`Unsupported broker: ${brokerName}`);
    }

    validator(credentials);
  }

  private async checkExistingConnection(userId: string, brokerName: string): Promise<boolean> {
    const accounts = await this.database.getConnectedAccountsByUserId(userId);
    return accounts.some(account => account.broker_name === brokerName);
  }

  private async storeConnection(userId: string, brokerName: string, result: any): Promise<void> {
    await this.database.createConnectedAccount({
      user_id: userId,
      broker_name: brokerName,
      account_id: result.accountInfo.accountId,
      user_name: result.accountInfo.userName,
      email: result.accountInfo.email || '',
      broker_display_name: result.accountInfo.brokerDisplayName,
      exchanges: result.accountInfo.exchanges || [],
      products: result.accountInfo.products || [],
      credentials: result.credentials,
      account_status: result.accountInfo.accountStatus,
      token_expiry_time: result.accountInfo.tokenExpiryTime
    });
  }
}
```

### **2.2 Error Handling Standardization**

```typescript
// errors/AppError.ts - NEW FILE
export enum ErrorCode {
  // Authentication Errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  
  // Broker Errors
  BROKER_CONNECTION_FAILED = 'BROKER_CONNECTION_FAILED',
  BROKER_NOT_SUPPORTED = 'BROKER_NOT_SUPPORTED',
  INVALID_BROKER_CREDENTIALS = 'INVALID_BROKER_CREDENTIALS',
  
  // Validation Errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  
  // System Errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR'
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly context?: any;

  constructor(
    message: string,
    statusCode: number,
    errorCode: ErrorCode,
    isOperational = true,
    context?: any
  ) {
    super(message);
    
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.context = context;
    
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errorCode: ErrorCode, context?: any): AppError {
    return new AppError(message, 400, errorCode, true, context);
  }

  static unauthorized(message: string, context?: any): AppError {
    return new AppError(message, 401, ErrorCode.UNAUTHORIZED, true, context);
  }

  static forbidden(message: string, context?: any): AppError {
    return new AppError(message, 403, ErrorCode.UNAUTHORIZED, true, context);
  }

  static notFound(message: string, context?: any): AppError {
    return new AppError(message, 404, ErrorCode.VALIDATION_ERROR, true, context);
  }

  static internal(message: string, context?: any): AppError {
    return new AppError(message, 500, ErrorCode.INTERNAL_SERVER_ERROR, false, context);
  }
}

// middleware/errorHandler.ts - UPDATED
import { AppError, ErrorCode } from '../errors/AppError';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  // Convert known errors to AppError
  if (!(error instanceof AppError)) {
    if (error.name === 'ValidationError') {
      error = AppError.badRequest('Validation failed', ErrorCode.VALIDATION_ERROR);
    } else if (error.name === 'JsonWebTokenError') {
      error = AppError.unauthorized('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      error = AppError.unauthorized('Token expired');
    } else {
      error = AppError.internal('Something went wrong');
    }
  }

  const appError = error as AppError;

  // Log error
  logger.error('Request error', {
    message: appError.message,
    statusCode: appError.statusCode,
    errorCode: appError.errorCode,
    stack: appError.stack,
    url: req.url,
    method: req.method,
    userId: (req as any).user?.id,
    timestamp: new Date().toISOString(),
    context: appError.context
  });

  // Send error response
  const response: any = {
    success: false,
    error: {
      code: appError.errorCode,
      message: appError.message
    }
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = appError.stack;
    response.error.context = appError.context;
  }

  res.status(appError.statusCode).json(response);
};
```

---

## 🧪 **PHASE 3: TESTING - IMPLEMENTATION EXAMPLES**

### **3.1 Jest Configuration**

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/tests/**',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'],
  testTimeout: 10000
};
```

### **3.2 Unit Test Example**

```typescript
// services/__tests__/BrokerService.test.ts
import { BrokerService } from '../BrokerService';
import { EnhancedUnifiedBrokerManager } from '../enhancedUnifiedBrokerManager';
import { IDatabaseAdapter } from '../../interfaces/IDatabaseAdapter';
import { logger } from '../../utils/logger';
import { AppError, ErrorCode } from '../../errors/AppError';

// Mock dependencies
jest.mock('../enhancedUnifiedBrokerManager');
jest.mock('../../utils/logger');

describe('BrokerService', () => {
  let brokerService: BrokerService;
  let mockBrokerManager: jest.Mocked<EnhancedUnifiedBrokerManager>;
  let mockDatabase: jest.Mocked<IDatabaseAdapter>;

  beforeEach(() => {
    mockBrokerManager = {
      connectToBroker: jest.fn(),
      disconnect: jest.fn(),
      validateSession: jest.fn()
    } as any;

    mockDatabase = {
      getConnectedAccountsByUserId: jest.fn(),
      createConnectedAccount: jest.fn()
    } as any;

    brokerService = new BrokerService(mockBrokerManager, mockDatabase, logger);
  });

  describe('connectBroker', () => {
    const userId = 'user123';
    const brokerName = 'shoonya';
    const validCredentials = {
      userId: 'TEST123',
      password: 'testpass',
      totpKey: 'testtotp',
      vendorCode: 'testvendor',
      apiSecret: 'testsecret',
      imei: 'testimei'
    };

    it('should connect broker successfully', async () => {
      // Arrange
      mockDatabase.getConnectedAccountsByUserId.mockResolvedValue([]);
      mockBrokerManager.connectToBroker.mockResolvedValue({
        success: true,
        message: 'Connected successfully',
        accountInfo: {
          accountId: 'ACC123',
          accountStatus: 'ACTIVE',
          userName: 'Test User',
          email: 'test@example.com',
          brokerDisplayName: 'Shoonya',
          exchanges: ['NSE'],
          products: ['CNC']
        }
      });

      // Act
      const result = await brokerService.connectBroker(userId, brokerName, validCredentials);

      // Assert
      expect(result.success).toBe(true);
      expect(result.accountId).toBe('ACC123');
      expect(result.accountStatus).toBe('ACTIVE');
      expect(mockDatabase.createConnectedAccount).toHaveBeenCalledWith({
        user_id: userId,
        broker_name: brokerName,
        account_id: 'ACC123',
        user_name: 'Test User',
        email: 'test@example.com',
        broker_display_name: 'Shoonya',
        exchanges: ['NSE'],
        products: ['CNC'],
        credentials: validCredentials,
        account_status: 'ACTIVE',
        token_expiry_time: undefined
      });
    });

    it('should fail with invalid credentials', async () => {
      // Arrange
      const invalidCredentials = { userId: 'TEST123' }; // Missing required fields

      // Act
      const result = await brokerService.connectBroker(userId, brokerName, invalidCredentials);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing required field');
      expect(mockBrokerManager.connectToBroker).not.toHaveBeenCalled();
    });

    it('should handle existing connection', async () => {
      // Arrange
      mockDatabase.getConnectedAccountsByUserId.mockResolvedValue([
        { broker_name: brokerName } as any
      ]);

      // Act
      const result = await brokerService.connectBroker(userId, brokerName, validCredentials);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection already exists');
      expect(mockBrokerManager.connectToBroker).not.toHaveBeenCalled();
    });
  });
});
```

This implementation guide provides concrete examples for the most critical tasks. Each example includes:

1. **Current problematic code** (where applicable)
2. **Fixed implementation** with proper error handling
3. **Supporting utilities** and infrastructure
4. **Test examples** with proper mocking and assertions

The guide can be extended with more examples as we work through each phase of the implementation.