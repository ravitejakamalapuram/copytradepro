/**
 * Interface for all broker service implementations.
 * Each broker integration must implement this contract.
 */
export interface IBrokerService {
  /**
   * Log in to the broker with the given credentials.
   * @param credentials - Broker-specific login credentials.
   */
  login(credentials: any): Promise<any>;
  /**
   * Log out from the broker.
   * @param userId - Optional user/account ID.
   */
  logout(userId?: string): Promise<any>;
  /**
   * Place an order with the broker.
   * @param orderData - The order details.
   */
  placeOrder(orderData: any): Promise<any>;
  /**
   * Get the order book for a user/account.
   * @param userId - The user/account ID.
   */
  getOrderBook(userId: string): Promise<any>;
  /**
   * Get the status of a specific order.
   * @param userId - The user/account ID.
   * @param orderNumber - The broker's order number.
   */
  getOrderStatus(userId: string, orderNumber: string): Promise<any>;
  /**
   * Get all open/current positions for a user/account.
   * @param userId - The user/account ID.
   */
  getPositions(userId: string): Promise<any>;
  /**
   * Search for a symbol or scrip on the broker.
   * @param exchange - The exchange (e.g., NSE, BSE).
   * @param searchText - The symbol or text to search for.
   */
  searchScrip(exchange: string, searchText: string): Promise<any>;
  /**
   * Get live quotes for a symbol/token.
   * @param exchange - The exchange.
   * @param token - The symbol/token.
   */
  getQuotes(exchange: string, token: string): Promise<any>;
  /**
   * Check if the broker session is currently logged in.
   */
  isLoggedIn(): boolean;
  /**
   * Get the current session token, if available.
   */
  getSessionToken?(): string | null;
  /**
   * Validate if the current session is still active.
   * @param userId - The user/account ID.
   */
  validateSession(userId: string): Promise<boolean>;
  /**
   * Get the user/account ID, if available.
   */
  getUserId?(): string | null;
  /**
   * Extract account info from a login response and credentials.
   * @param loginResponse - The broker's login response.
   * @param credentials - The credentials used for login.
   */
  extractAccountInfo(loginResponse: any, credentials: any): {
    accountId: string;
    userName: string;
    email: string;
    brokerDisplayName: string;
    exchanges: string[];
    products: any[];
  };
  /**
   * Optionally map a broker-specific order status to a standard status.
   * @param status - The broker's order status.
   */
  mapOrderStatus?(status: string): string;
  /**
   * Extract order info from a broker's order response and input.
   * @param orderResponse - The broker's order response.
   * @param orderInput - The order input data.
   */
  extractOrderInfo(orderResponse: any, orderInput: any): { brokerOrderId: string };
} 