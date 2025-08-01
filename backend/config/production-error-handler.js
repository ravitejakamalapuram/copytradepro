/**
 * Production Error Handler Configuration
 * Comprehensive error handling for production environment
 */

const logger = require('./logging.config');

class ProductionErrorHandler {
  constructor() {
    this.errorCodes = {
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      DATABASE_ERROR: 'DATABASE_ERROR',
      AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
      AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
      SYMBOL_ERROR: 'SYMBOL_ERROR',
      BROKER_ERROR: 'BROKER_ERROR',
      RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
      INTERNAL_ERROR: 'INTERNAL_ERROR'
    };
    
    this.httpStatusCodes = {
      [this.errorCodes.VALIDATION_ERROR]: 400,
      [this.errorCodes.AUTHENTICATION_ERROR]: 401,
      [this.errorCodes.AUTHORIZATION_ERROR]: 403,
      [this.errorCodes.RATE_LIMIT_ERROR]: 429,
      [this.errorCodes.DATABASE_ERROR]: 500,
      [this.errorCodes.SYMBOL_ERROR]: 500,
      [this.errorCodes.BROKER_ERROR]: 502,
      [this.errorCodes.INTERNAL_ERROR]: 500
    };
  }

  // Classify error type
  classifyError(error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return this.errorCodes.VALIDATION_ERROR;
    }
    
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return this.errorCodes.DATABASE_ERROR;
    }
    
    if (error.message?.includes('JWT') || error.message?.includes('token')) {
      return this.errorCodes.AUTHENTICATION_ERROR;
    }
    
    if (error.message?.includes('symbol') || error.message?.includes('Symbol')) {
      return this.errorCodes.SYMBOL_ERROR;
    }
    
    if (error.message?.includes('broker') || error.message?.includes('Broker')) {
      return this.errorCodes.BROKER_ERROR;
    }
    
    if (error.message?.includes('rate limit') || error.status === 429) {
      return this.errorCodes.RATE_LIMIT_ERROR;
    }
    
    return this.errorCodes.INTERNAL_ERROR;
  }

  // Create standardized error response
  createErrorResponse(error, req) {
    const errorType = this.classifyError(error);
    const statusCode = this.httpStatusCodes[errorType] || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Base error response
    const errorResponse = {
      success: false,
      error: {
        code: errorType,
        message: this.getSafeErrorMessage(error, isProduction),
        timestamp: new Date().toISOString(),
        requestId: req.id || this.generateRequestId()
      }
    };
    
    // Add additional details for non-production environments
    if (!isProduction) {
      errorResponse.error.stack = error.stack;
      errorResponse.error.details = error.details || {};
    }
    
    // Add specific error information based on type
    switch (errorType) {
      case this.errorCodes.VALIDATION_ERROR:
        errorResponse.error.fields = this.extractValidationFields(error);
        break;
        
      case this.errorCodes.RATE_LIMIT_ERROR:
        errorResponse.error.retryAfter = error.retryAfter || 60;
        break;
        
      case this.errorCodes.SYMBOL_ERROR:
        errorResponse.error.symbolContext = {
          operation: error.operation,
          symbol: error.symbol
        };
        break;
        
      case this.errorCodes.BROKER_ERROR:
        errorResponse.error.brokerContext = {
          broker: error.broker,
          operation: error.operation
        };
        break;
    }
    
    return { statusCode, errorResponse };
  }

  // Get safe error message for production
  getSafeErrorMessage(error, isProduction) {
    if (!isProduction) {
      return error.message;
    }
    
    // Safe messages for production
    const safeMessages = {
      [this.errorCodes.VALIDATION_ERROR]: 'Invalid input data provided',
      [this.errorCodes.DATABASE_ERROR]: 'Database operation failed',
      [this.errorCodes.AUTHENTICATION_ERROR]: 'Authentication required',
      [this.errorCodes.AUTHORIZATION_ERROR]: 'Access denied',
      [this.errorCodes.SYMBOL_ERROR]: 'Symbol operation failed',
      [this.errorCodes.BROKER_ERROR]: 'Broker service unavailable',
      [this.errorCodes.RATE_LIMIT_ERROR]: 'Rate limit exceeded',
      [this.errorCodes.INTERNAL_ERROR]: 'Internal server error'
    };
    
    const errorType = this.classifyError(error);
    return safeMessages[errorType] || 'An error occurred';
  }

  // Extract validation fields from error
  extractValidationFields(error) {
    const fields = [];
    
    if (error.errors) {
      Object.keys(error.errors).forEach(field => {
        fields.push({
          field,
          message: error.errors[field].message,
          value: error.errors[field].value
        });
      });
    }
    
    return fields;
  }

  // Generate unique request ID
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Log error with context
  logError(error, req, res) {
    const errorType = this.classifyError(error);
    const context = {
      errorType,
      url: req.url,
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user?.id,
      requestId: req.id,
      statusCode: res.statusCode
    };
    
    // Log based on severity
    if (errorType === this.errorCodes.INTERNAL_ERROR || 
        errorType === this.errorCodes.DATABASE_ERROR) {
      logger.error(`${errorType}: ${error.message}`, {
        ...context,
        stack: error.stack
      });
    } else {
      logger.warn(`${errorType}: ${error.message}`, context);
    }
    
    // Log security events
    if (errorType === this.errorCodes.AUTHENTICATION_ERROR || 
        errorType === this.errorCodes.AUTHORIZATION_ERROR) {
      logger.logSecurity(errorType, context);
    }
  }

  // Express error handling middleware
  middleware() {
    return (error, req, res, next) => {
      // Add request ID if not present
      if (!req.id) {
        req.id = this.generateRequestId();
      }
      
      // Log the error
      this.logError(error, req, res);
      
      // Create error response
      const { statusCode, errorResponse } = this.createErrorResponse(error, req);
      
      // Set response headers
      res.status(statusCode);
      res.set({
        'Content-Type': 'application/json',
        'X-Request-ID': req.id,
        'X-Error-Code': errorResponse.error.code
      });
      
      // Send error response
      res.json(errorResponse);
    };
  }

  // Handle async errors
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Create custom error classes
  createCustomErrors() {
    class SymbolError extends Error {
      constructor(message, operation, symbol) {
        super(message);
        this.name = 'SymbolError';
        this.operation = operation;
        this.symbol = symbol;
      }
    }
    
    class BrokerError extends Error {
      constructor(message, broker, operation) {
        super(message);
        this.name = 'BrokerError';
        this.broker = broker;
        this.operation = operation;
      }
    }
    
    class ValidationError extends Error {
      constructor(message, fields) {
        super(message);
        this.name = 'ValidationError';
        this.fields = fields;
      }
    }
    
    return { SymbolError, BrokerError, ValidationError };
  }

  // Handle process-level errors
  setupProcessErrorHandlers() {
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', {
        category: 'system',
        error: error.message,
        stack: error.stack
      });
      
      // Graceful shutdown
      setTimeout(() => {
        process.exit(1);
      }, 1000);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection', {
        category: 'system',
        reason: reason?.toString(),
        promise: promise?.toString()
      });
    });
  }
}

// Create singleton instance
const errorHandler = new ProductionErrorHandler();

// Setup process error handlers
errorHandler.setupProcessErrorHandlers();

// Export error handler and custom errors
module.exports = {
  errorHandler,
  ...errorHandler.createCustomErrors()
};