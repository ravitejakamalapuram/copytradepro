/**
 * Order Error Classification Service
 * Classifies broker API errors and determines retry strategies
 */

export interface OrderErrorClassification {
  errorType: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
  isRetryable: boolean;
  userMessage: string;
  retryDelay: number;
  maxRetries: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class OrderErrorClassifier {
  private static instance: OrderErrorClassifier;

  private constructor() {}

  public static getInstance(): OrderErrorClassifier {
    if (!OrderErrorClassifier.instance) {
      OrderErrorClassifier.instance = new OrderErrorClassifier();
    }
    return OrderErrorClassifier.instance;
  }

  /**
   * Classify Fyers API errors
   */
  public classifyFyersError(error: any): OrderErrorClassification {
    const errorMessage = error.message || error.toString();
    const errorCode = error.code || error.s;

    // Network/Connection errors
    if (this.isNetworkError(errorMessage)) {
      return {
        errorType: 'NETWORK',
        isRetryable: true,
        userMessage: 'Network connection issue. Order will be retried automatically.',
        retryDelay: 2000,
        maxRetries: 3,
        severity: 'MEDIUM'
      };
    }

    // Authentication errors
    if (this.isAuthError(errorMessage, errorCode)) {
      return {
        errorType: 'AUTH',
        isRetryable: false,
        userMessage: 'Authentication expired. Please reactivate your Fyers account.',
        retryDelay: 0,
        maxRetries: 0,
        severity: 'HIGH'
      };
    }

    // Validation errors (non-retryable)
    if (this.isValidationError(errorMessage)) {
      return {
        errorType: 'VALIDATION',
        isRetryable: false,
        userMessage: this.getValidationErrorMessage(errorMessage),
        retryDelay: 0,
        maxRetries: 0,
        severity: 'LOW'
      };
    }

    // Market/Trading errors
    if (this.isMarketError(errorMessage)) {
      return {
        errorType: 'MARKET',
        isRetryable: false,
        userMessage: this.getMarketErrorMessage(errorMessage),
        retryDelay: 0,
        maxRetries: 0,
        severity: 'MEDIUM'
      };
    }

    // Rate limiting (retryable with longer delay)
    if (this.isRateLimitError(errorMessage, errorCode)) {
      return {
        errorType: 'BROKER',
        isRetryable: true,
        userMessage: 'Rate limit exceeded. Order will be retried after a delay.',
        retryDelay: 5000,
        maxRetries: 2,
        severity: 'MEDIUM'
      };
    }

    // Server errors (retryable)
    if (this.isServerError(errorMessage, errorCode)) {
      return {
        errorType: 'BROKER',
        isRetryable: true,
        userMessage: 'Broker server error. Order will be retried automatically.',
        retryDelay: 3000,
        maxRetries: 2,
        severity: 'HIGH'
      };
    }

    // Default classification for unknown errors
    return {
      errorType: 'SYSTEM',
      isRetryable: false,
      userMessage: `Order failed: ${errorMessage}`,
      retryDelay: 0,
      maxRetries: 0,
      severity: 'MEDIUM'
    };
  }

  private isNetworkError(message: string): boolean {
    const networkKeywords = [
      'network', 'connection', 'timeout', 'unreachable',
      'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'
    ];
    return networkKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isAuthError(message: string, code: any): boolean {
    const authKeywords = [
      'token', 'unauthorized', 'authentication', 'expired',
      'invalid token', 'access denied', 'login required'
    ];
    const authCodes = [-17, 401, 403];
    
    return authKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    ) || authCodes.includes(Number(code));
  }

  private isValidationError(message: string): boolean {
    const validationKeywords = [
      'invalid inputs', 'invalid quantity', 'invalid symbol',
      'invalid price', 'invalid order type', 'missing required',
      'validation failed', 'invalid entry', 'invalid product type',
      'invalid exchange', 'invalid validity', 'symbol not found',
      'invalid lot size', 'quantity should be multiple of',
      'price is not in tick size', 'invalid time in force'
    ];
    return validationKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isMarketError(message: string): boolean {
    const marketKeywords = [
      'market closed', 'trading hours', 'circuit limit',
      'price band', 'lot size', 'margin', 'insufficient funds',
      'position limit', 'order rejected by exchange',
      'trading not allowed', 'session expired', 'market not open',
      'pre-market', 'post-market', 'halt', 'suspended',
      'freeze', 'upper circuit', 'lower circuit', 'no buyers',
      'no sellers', 'illiquid', 'volatility', 'risk management'
    ];
    return marketKeywords.some(keyword =>
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private isRateLimitError(message: string, code: any): boolean {
    const rateLimitKeywords = ['rate limit', 'too many requests', 'request limit'];
    const rateLimitCodes = [429];
    
    return rateLimitKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    ) || rateLimitCodes.includes(Number(code));
  }

  private isServerError(message: string, code: any): boolean {
    const serverKeywords = [
      'internal server error', 'service unavailable',
      'server error', 'unexpected error'
    ];
    const serverCodes = [500, 502, 503, 504];
    
    return serverKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    ) || serverCodes.includes(Number(code));
  }

  private getValidationErrorMessage(message: string): string {
    if (message.toLowerCase().includes('invalid quantity') || message.toLowerCase().includes('lot size')) {
      return 'Invalid quantity. Please check the lot size and minimum quantity requirements. Quantity should be a multiple of lot size.';
    }
    if (message.toLowerCase().includes('invalid symbol') || message.toLowerCase().includes('symbol not found')) {
      return 'Invalid symbol. Please verify the symbol format and exchange. Use format like "RELIANCE-EQ" for NSE or "RELIANCE" for BSE.';
    }
    if (message.toLowerCase().includes('invalid price') || message.toLowerCase().includes('tick size')) {
      return 'Invalid price. Please check price bands and tick size. Price should be within allowed range and in correct tick size.';
    }
    if (message.toLowerCase().includes('invalid product type')) {
      return 'Invalid product type. Please use valid product types: CNC (Cash), MIS (Intraday), NRML (Normal).';
    }
    if (message.toLowerCase().includes('invalid exchange')) {
      return 'Invalid exchange. Please use valid exchanges: NSE, BSE, MCX, NCDEX.';
    }
    if (message.toLowerCase().includes('invalid order type')) {
      return 'Invalid order type. Please use valid order types: MARKET, LIMIT, SL-LIMIT, SL-MARKET.';
    }
    return `Validation error: ${message}. Please check your order parameters and try again.`;
  }

  private getMarketErrorMessage(message: string): string {
    if (message.toLowerCase().includes('market closed') || message.toLowerCase().includes('trading hours')) {
      return 'Market is closed. Orders can only be placed during trading hours (9:15 AM to 3:30 PM for equity).';
    }
    if (message.toLowerCase().includes('insufficient funds')) {
      return 'Insufficient funds in your account to place this order. Please add funds or reduce order size.';
    }
    if (message.toLowerCase().includes('margin')) {
      return 'Insufficient margin to place this order. Please add margin or reduce position size.';
    }
    if (message.toLowerCase().includes('circuit limit') || message.toLowerCase().includes('price band')) {
      return 'Stock has hit circuit limit or price band. Orders outside the allowed price range are rejected.';
    }
    if (message.toLowerCase().includes('halt') || message.toLowerCase().includes('suspended')) {
      return 'Trading in this stock is currently halted or suspended. Please try again later.';
    }
    if (message.toLowerCase().includes('position limit')) {
      return 'Position limit exceeded. You cannot take additional positions in this stock.';
    }
    if (message.toLowerCase().includes('pre-market') || message.toLowerCase().includes('post-market')) {
      return 'Order placed outside regular trading hours. It will be processed when market opens.';
    }
    return `Market error: ${message}. Please check market conditions and try again.`;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  public calculateRetryDelay(baseDelay: number, retryCount: number): number {
    return Math.min(baseDelay * Math.pow(2, retryCount), 30000); // Max 30 seconds
  }

  /**
   * Generate a unique error code for tracking
   */
  public generateErrorCode(errorType: string, timestamp: number): string {
    return `${errorType}_${timestamp}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get actionable guidance for resolving the error
   */
  public getActionableGuidance(classification: OrderErrorClassification): string[] {
    const guidance: string[] = [];

    switch (classification.errorType) {
      case 'NETWORK':
        guidance.push('Check your internet connection');
        guidance.push('Try placing the order again');
        guidance.push('If problem persists, contact support');
        break;

      case 'AUTH':
        guidance.push('Go to Accounts page and reactivate your broker account');
        guidance.push('Check if your broker credentials are still valid');
        guidance.push('Ensure your broker account is not suspended');
        break;

      case 'VALIDATION':
        guidance.push('Review your order parameters (symbol, quantity, price)');
        guidance.push('Check lot size requirements for the stock');
        guidance.push('Verify symbol format (e.g., RELIANCE-EQ for NSE)');
        guidance.push('Ensure price is within tick size and price bands');
        break;

      case 'MARKET':
        guidance.push('Check if market is open for trading');
        guidance.push('Verify you have sufficient funds/margin');
        guidance.push('Check if the stock is halted or suspended');
        guidance.push('Review position limits and risk management rules');
        break;

      case 'BROKER':
        if (classification.isRetryable) {
          guidance.push('Order will be automatically retried');
          guidance.push('You can also manually retry from order history');
        } else {
          guidance.push('Contact your broker for assistance');
          guidance.push('Check broker platform for any announcements');
        }
        break;

      case 'SYSTEM':
        guidance.push('Try placing the order again');
        guidance.push('If problem persists, contact technical support');
        guidance.push('Check system status page for any ongoing issues');
        break;

      default:
        guidance.push('Review order details and try again');
        guidance.push('Contact support if the issue continues');
    }

    return guidance;
  }

  /**
   * Get estimated resolution time for the error
   */
  public getEstimatedResolutionTime(classification: OrderErrorClassification): string {
    switch (classification.errorType) {
      case 'NETWORK':
        return 'Usually resolves within 1-2 minutes';
      case 'AUTH':
        return 'Immediate after reactivating account';
      case 'VALIDATION':
        return 'Immediate after correcting order parameters';
      case 'MARKET':
        return 'Depends on market conditions (minutes to hours)';
      case 'BROKER':
        return classification.isRetryable ? 'Automatic retry in progress' : 'Contact broker for timeline';
      case 'SYSTEM':
        return 'Usually resolves within 5-10 minutes';
      default:
        return 'Unknown - contact support';
    }
  }
}
