/**
 * Shoonya Service Adapter
 * Adapts the existing ShoonyaService to implement IBrokerService interface
 * Uses comprehensive error handler for consistent error processing
 */

import { IBrokerService, BrokerCredentials, LoginResponse, OrderRequest, OrderResponse, OrderStatus } from '@copytrade/unified-broker';
import { ShoonyaService } from './shoonyaService';
import { ShoonyaCredentials } from './types';
import { ShoonyaSymbolFormatter } from './symbolFormatter';

// Import standardized symbol services
// TODO: These should be properly exported from shared packages
// import { BrokerSymbolConverterFactory } from '../../../backend/src/services/brokerSymbolConverters/BrokerSymbolConverterFactory';
// import { symbolDatabaseService } from '../../../backend/src/services/symbolDatabaseService';

export class ShoonyaServiceAdapter extends IBrokerService {
  private shoonyaService: ShoonyaService;

  constructor() {
    super('shoonya');
    this.shoonyaService = new ShoonyaService();
  }

  async login(credentials: BrokerCredentials): Promise<LoginResponse> {
    try {
      const shoonyaCredentials = credentials as ShoonyaCredentials;
      const response = await this.shoonyaService.login(shoonyaCredentials);
      
      if (response.stat === 'Ok') {
        this.setConnected(true, response.actid);
        return this.createSuccessResponse('Login successful', {
          accountId: response.actid,
          userName: response.uname,
          email: response.email,
          exchanges: response.exarr,
          products: response.prarr
        });
      } else {
        return this.createErrorResponse(response.emsg || 'Login failed', response);
      }
    } catch (error: any) {
      return this.createErrorResponse(error.message || 'Login failed', error);
    }
  }

  async logout(): Promise<boolean> {
    try {
      const result = await this.shoonyaService.logout();
      this.setConnected(false);
      return result;
    } catch (error) {
      console.error('Logout failed:', error);
      return false;
    }
  }

  async validateSession(accountId?: string): Promise<boolean> {
    try {
      return await this.shoonyaService.validateSession(accountId || this.accountId || '');
    } catch (error) {
      return false;
    }
  }

  async placeOrder(orderRequest: OrderRequest): Promise<OrderResponse> {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Map unified order type to Shoonya-specific format
        let shoonyaPriceType: 'LMT' | 'MKT' | 'SL-LMT' | 'SL-MKT';
        switch (orderRequest.orderType) {
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

        // Map unified product type to Shoonya format
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
        const shoonyaProductType = productTypeMap[orderRequest.productType] || orderRequest.productType;

        // Convert symbol using pre-fetched symbolMetadata only
        let formattedData: { tradingSymbol: string; exchange: string };

        // Check if symbolMetadata is provided in the order request
        const symbolMetadata = (orderRequest as any).symbolMetadata;

        if (symbolMetadata) {
          // Use pre-fetched symbol metadata (no database call needed)
          formattedData = {
            tradingSymbol: symbolMetadata.tradingSymbol,
            exchange: symbolMetadata.exchange || 'NSE'
          };

          console.log(`🔄 Shoonya using pre-fetched symbol metadata: ${orderRequest.symbol} -> ${formattedData.tradingSymbol} (${formattedData.exchange})`);
        } else {
          // Use symbol as-is when no metadata provided
          formattedData = {
            tradingSymbol: orderRequest.symbol,
            exchange: orderRequest.exchange || 'NSE'
          };

          console.log(`🔄 Shoonya using symbol as-is: ${orderRequest.symbol} -> ${formattedData.tradingSymbol} (${formattedData.exchange})`);
        }

        // Transform to Shoonya-specific order format
        const shoonyaOrderRequest = {
          userId: orderRequest.accountId || this.accountId || '',
          buyOrSell: orderRequest.action === 'BUY' ? 'B' as const : 'S' as const,
          productType: shoonyaProductType,
          exchange: formattedData.exchange,
          tradingSymbol: formattedData.tradingSymbol,
          quantity: orderRequest.quantity,
          discloseQty: 0,
          priceType: shoonyaPriceType,
          price: orderRequest.price || 0,
          triggerPrice: orderRequest.triggerPrice || 0,
          retention: 'DAY' as const,
          remarks: orderRequest.remarks || `Order placed via CopyTrade Pro for account ${orderRequest.accountId || this.accountId}`
        };

        const response = await this.shoonyaService.placeOrder(shoonyaOrderRequest);

        if (response.stat === 'Ok') {
          return this.createSuccessResponse('Order placed successfully', {
            orderId: response.norenordno,
            message: response.result,
            brokerOrderId: response.norenordno,
            status: 'PLACED'
          });
        } else {
          return this.createErrorResponse(
            response.emsg || 'Order placement failed',
            {
              originalError: response.emsg,
              attempt: attempt
            }
          );
        }
      } catch (error: any) {
        lastError = error;
        
        return this.createErrorResponse(error.message, {
          originalError: error.message,
          attempt: attempt
        });
      }
    }

    // If we get here, all retries failed
    return this.createErrorResponse(
      lastError?.message || 'Order placement failed after multiple attempts',
      {
        originalError: lastError?.message,
        maxRetriesExceeded: true
      }
    );
  }

  async getOrderStatus(accountId: string, orderId: string): Promise<OrderStatus> {
    const startTime = performance.now();
    const operationId = `getOrderStatus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced logging context
    const logContext = {
      userId: accountId,
      brokerName: 'shoonya',
      accountId: accountId,
      operation: 'getOrderStatus',
      orderId: orderId,
      timestamp: new Date(),
      operationId
    };

    // Log operation start
    console.log(`[${new Date().toISOString()}] [INFO] [ORDER_STATUS_ADAPTER] Starting order status retrieval`, {
      ...logContext,
      component: 'SHOONYA_SERVICE_ADAPTER'
    });

    // Note: Comprehensive error handler would be imported here in a real implementation
    // const { comprehensiveErrorHandler } = await import('../../../../backend/src/services/comprehensiveErrorHandler');
    const comprehensiveErrorHandler: any = null; // Placeholder for now
    
    const context = {
      userId: accountId,
      brokerName: 'shoonya',
      accountId: accountId,
      operation: 'getOrderStatus',
      timestamp: new Date()
    };

    try {
      // Use comprehensive error handler with retry logic if available
      let response: any;
      
      if (comprehensiveErrorHandler) {
        response = await comprehensiveErrorHandler.executeWithRetry(
          async () => {
            console.log(`📊 Getting order status for order ${orderId}`);
            
            // Check rate limiting before making request
            const rateLimitCheck = comprehensiveErrorHandler!.checkRateLimit(
              accountId, 'shoonya', 'getOrderStatus'
            );
            
            if (!rateLimitCheck.allowed) {
              const waitTime = rateLimitCheck.waitTime || 0;
              
              // Log rate limit hit
              console.log(`[${new Date().toISOString()}] [WARN] [RATE_LIMIT] Rate limit exceeded`, {
                ...logContext,
                waitTime: Math.ceil(waitTime / 1000),
                component: 'RATE_LIMITER'
              });
              
              const error = new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
              (error as any).code = 'RATE_LIMITED';
              throw error;
            }
            
            return await this.shoonyaService.getOrderStatus(accountId, orderId);
          },
          context,
          {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 10000
          }
        );
      } else {
        // Fallback to direct execution with basic retry logic
        let lastError: any = null;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            console.log(`[${new Date().toISOString()}] [DEBUG] [RETRY] Order status attempt ${attempt}/${maxRetries}`, {
              ...logContext,
              attempt,
              maxRetries
            });
            
            response = await this.shoonyaService.getOrderStatus(accountId, orderId);
            break; // Success, exit retry loop
          } catch (error: any) {
            lastError = error;
            
            console.log(`[${new Date().toISOString()}] [WARN] [RETRY] Order status attempt ${attempt} failed`, {
              ...logContext,
              attempt,
              errorMessage: error.message,
              errorType: error.errorType
            });
            
            if (attempt === maxRetries) {
              throw error; // Last attempt failed, throw error
            }
            
            // Wait before retry (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      const responseTime = performance.now() - startTime;
      
      // Handle successful response from Shoonya API
      if (response && response.stat === 'Ok') {
        const transformedStatus = this.transformShoonyaOrderStatus(response);
        
        // Log successful transformation
        console.log(`[${new Date().toISOString()}] [INFO] [ORDER_STATUS_ADAPTER] Order status retrieved successfully`, {
          ...logContext,
          responseTime: Math.round(responseTime),
          orderStatus: transformedStatus.status,
          symbol: response.tsym,
          quantity: response.qty,
          filledQuantity: response.fillshares,
          component: 'SHOONYA_SERVICE_ADAPTER'
        });
        
        console.log(`✅ Order status retrieved successfully: ${transformedStatus.status}`);
        return transformedStatus;
      } 
      
      // Handle API error response (stat: 'Not_Ok')
      if (response && response.stat === 'Not_Ok') {
        // Get user-friendly error message from comprehensive handler
        const userFriendlyMessage = comprehensiveErrorHandler ? 
          comprehensiveErrorHandler.getUserFriendlyMessage(
            { message: response.emsg, code: response.errorType },
            context
          ) : response.emsg;
        
        // Log API error response
        console.log(`[${new Date().toISOString()}] [ERROR] [ORDER_STATUS_ADAPTER] API error response`, {
          ...logContext,
          responseTime: Math.round(responseTime),
          errorMessage: response.emsg,
          errorType: response.errorType,
          userFriendlyMessage,
          component: 'SHOONYA_SERVICE_ADAPTER'
        });
        
        const error = new Error(userFriendlyMessage);
        (error as any).errorType = response.errorType;
        (error as any).originalError = response.emsg;
        (error as any).brokerResponse = response;
        (error as any).retryable = response.retryable;
        (error as any).suggestedActions = response.suggestedActions;
        throw error;
      }
      
      // Unexpected response format
      console.warn('⚠️ Unexpected Shoonya order status response format:', response);
      
      // Log unexpected response
      console.log(`[${new Date().toISOString()}] [WARN] [ORDER_STATUS_ADAPTER] Unexpected response format`, {
        ...logContext,
        responseTime: Math.round(responseTime),
        responseType: typeof response,
        hasStatField: response && 'stat' in response,
        component: 'SHOONYA_SERVICE_ADAPTER'
      });
      
      const error = new Error('Unexpected response format from Shoonya API');
      (error as any).errorType = 'BROKER_ERROR';
      (error as any).originalError = 'Unexpected response format';
      (error as any).brokerResponse = response;
      throw error;
      
    } catch (error: any) {
      const responseTime = performance.now() - startTime;
      
      // Get comprehensive error information
      const userFriendlyMessage = comprehensiveErrorHandler ? 
        comprehensiveErrorHandler.getUserFriendlyMessage(error, context) : error.message;
      const suggestedActions = comprehensiveErrorHandler ?
        comprehensiveErrorHandler.getSuggestedActions(error, context) : ['Try again later'];
      const isRetryable = comprehensiveErrorHandler ?
        comprehensiveErrorHandler.isRetryable(error, context) : false;
      
      // Log comprehensive error information
      console.log(`[${new Date().toISOString()}] [ERROR] [ORDER_STATUS_ADAPTER] Order status operation failed`, {
        ...logContext,
        responseTime: Math.round(responseTime),
        errorMessage: error.message,
        errorType: error.errorType,
        userFriendlyMessage,
        retryable: isRetryable,
        suggestedActions,
        originalError: error.originalError,
        component: 'SHOONYA_SERVICE_ADAPTER'
      });
      
      // Create enhanced error with comprehensive information
      const enhancedError = new Error(userFriendlyMessage);
      (enhancedError as any).originalError = error.message;
      (enhancedError as any).retryable = isRetryable;
      (enhancedError as any).suggestedActions = suggestedActions;
      (enhancedError as any).context = context;
      (enhancedError as any).responseTime = responseTime;
      (enhancedError as any).operationId = operationId;
      
      console.error(`🚨 Enhanced order status error for ${orderId}:`, {
        userMessage: userFriendlyMessage,
        retryable: isRetryable,
        suggestedActions,
        responseTime: Math.round(responseTime)
      });
      
      throw enhancedError;
    }
  }

  async getOrderHistory(accountId: string): Promise<OrderStatus[]> {
    const maxRetries = 3;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📊 Getting order history for account ${accountId} (attempt ${attempt}/${maxRetries})`);
        
        // Use getOrderBook for order history in Shoonya
        const response = await this.shoonyaService.getOrderBook(accountId);

        if (!Array.isArray(response)) {
          console.warn('Shoonya order history response is not an array, returning empty array');
          return [];
        }

        const transformedOrders = response.map((order: any) => this.transformShoonyaOrderStatus(order));
        console.log(`✅ Retrieved ${transformedOrders.length} orders from history`);
        return transformedOrders;
        
      } catch (error: any) {
        lastError = error;
        
        const enhancedError = new Error(error.message);
        (enhancedError as any).originalError = error.message;
        (enhancedError as any).attempt = attempt;
        throw enhancedError;
      }
    }

    // If we get here, all retries failed
    const finalError = new Error(lastError?.message || 'Failed to get order history after multiple attempts');
    (finalError as any).originalError = lastError?.message;
    (finalError as any).maxRetriesExceeded = true;
    throw finalError;
  }





  async searchSymbols(query: string, exchange: string): Promise<any[]> {
    try {
      // Shoonya doesn't have a searchSymbols method, return empty array for now
      console.warn('searchSymbols not implemented for Shoonya');
      return [];
    } catch (error: any) {
      throw new Error(`Failed to search symbols: ${error.message}`);
    }
  }

  async getPositions(accountId: string): Promise<any[]> {
    try {
      const response = await this.shoonyaService.getPositions(accountId);
      return Array.isArray(response) ? response : [];
    } catch (error: any) {
      throw new Error(`Failed to get positions: ${error.message}`);
    }
  }

  async getQuote(symbol: string, exchange: string): Promise<any> {
    try {
      // For Shoonya, we need to search for the symbol first to get the token
      const searchResults = await this.shoonyaService.searchScrip(exchange, symbol);
      if (searchResults && searchResults.length > 0) {
        const token = searchResults[0].token;
        return await this.shoonyaService.getQuotes(exchange, token);
      }
      return null;
    } catch (error: any) {
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  // Shoonya-specific methods that can be accessed if needed
  getShoonyaService(): ShoonyaService {
    return this.shoonyaService;
  }

  getUserId(): string | undefined {
    const userId = this.shoonyaService.getUserId();
    return userId || undefined;
  }

  // Legacy error handling methods removed - now using comprehensive error handler

  // Legacy delay methods removed - now using comprehensive error handler retry logic

  /**
   * Transform Shoonya order status response to unified format
   */
  private transformShoonyaOrderStatus(shoonyaResponse: any): OrderStatus {
    // Map Shoonya status to unified status
    const statusMap: { [key: string]: string } = {
      'OPEN': 'PLACED',
      'COMPLETE': 'EXECUTED',
      'CANCELLED': 'CANCELLED',
      'REJECTED': 'REJECTED',
      'TRIGGER_PENDING': 'PENDING',
      'PARTIALLY_FILLED': 'PARTIALLY_FILLED',
      // Additional mappings for other possible Shoonya statuses
      'NEW': 'PLACED',
      'PENDING': 'PENDING',
      'FILLED': 'EXECUTED',
      'PARTIAL': 'PARTIALLY_FILLED'
    };

    const shoonyaStatus = shoonyaResponse.status || 'UNKNOWN';
    const unifiedStatus = statusMap[shoonyaStatus] || shoonyaStatus;

    // Parse numeric values with proper error handling
    const quantity = this.parseNumericValue(shoonyaResponse.qty, 0);
    const filledQuantity = this.parseNumericValue(shoonyaResponse.fillshares, 0);
    const price = this.parseNumericValue(shoonyaResponse.prc, 0);
    const averagePrice = this.parseNumericValue(shoonyaResponse.avgprc, 0);

    // Parse timestamp with fallback
    let timestamp: Date;
    try {
      if (shoonyaResponse.norentm) {
        // Shoonya timestamp format might need parsing
        timestamp = new Date(shoonyaResponse.norentm);
        if (isNaN(timestamp.getTime())) {
          timestamp = new Date();
        }
      } else {
        timestamp = new Date();
      }
    } catch (error) {
      timestamp = new Date();
    }

    const transformedStatus: OrderStatus = {
      orderId: shoonyaResponse.norenordno || shoonyaResponse.orderNumber || '',
      status: unifiedStatus,
      quantity: quantity,
      filledQuantity: filledQuantity,
      price: price,
      averagePrice: averagePrice,
      timestamp: timestamp
    };

    console.log('🔄 Transformed Shoonya order status:', {
      original: {
        status: shoonyaStatus,
        qty: shoonyaResponse.qty,
        fillshares: shoonyaResponse.fillshares,
        prc: shoonyaResponse.prc,
        avgprc: shoonyaResponse.avgprc
      },
      transformed: {
        status: transformedStatus.status,
        quantity: transformedStatus.quantity,
        filledQuantity: transformedStatus.filledQuantity,
        price: transformedStatus.price,
        averagePrice: transformedStatus.averagePrice
      }
    });

    return transformedStatus;
  }

  /**
   * Parse numeric values safely with fallback
   */
  private parseNumericValue(value: any, fallback: number): number {
    if (value === null || value === undefined || value === '') {
      return fallback;
    }
    
    const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
    return isNaN(parsed) ? fallback : parsed;
  }

  // Legacy error handling methods removed - now using comprehensive error handler


}
