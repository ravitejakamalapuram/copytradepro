import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface ShoonyaOrderUpdate {
  norenordno: string;      // Order number
  status: string;          // Order status (COMPLETE, REJECTED, etc.)
  tsym: string;           // Trading symbol
  qty: string;            // Quantity
  fillshares: string;     // Filled quantity
  avgprc: string;         // Average price
  rejreason?: string;     // Rejection reason if any
  exch_tm: string;        // Exchange timestamp
  uid: string;            // User ID
  actid: string;          // Account ID
}

export interface WebSocketMessage {
  t: string;              // Message type
  uid?: string;           // User ID
  actid?: string;         // Account ID
  [key: string]: any;     // Additional fields
}

export class ShoonyaWebSocketService extends EventEmitter {
  private ws: WebSocket | null = null;
  private sessionToken: string | null = null;
  private userId: string | null = null;
  private isConnected: boolean = false;
  private isAuthenticated: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private subscribedUsers: Set<string> = new Set();
  private webSocketEnabled: boolean = true; // Can be disabled if persistent issues

  // Shoonya WebSocket endpoint
  private readonly wsUrl = 'wss://api.shoonya.com/NorenWSTP/';

  constructor() {
    super();
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.on('connected', () => {
      console.log('✅ Shoonya WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    });

    this.on('disconnected', () => {
      console.log('❌ Shoonya WebSocket disconnected');
      this.isConnected = false;
      this.isAuthenticated = false;
      this.stopHeartbeat();
      this.handleReconnection();
    });

    this.on('authenticated', () => {
      console.log('🔐 Shoonya WebSocket authenticated');
      this.isAuthenticated = true;
      // Re-subscribe to all users after authentication
      this.resubscribeAllUsers();
    });

    this.on('order_update', (orderUpdate: ShoonyaOrderUpdate) => {
      console.log('📊 Received order update:', {
        orderNumber: orderUpdate.norenordno,
        status: orderUpdate.status,
        symbol: orderUpdate.tsym,
        userId: orderUpdate.uid
      });
    });

    this.on('error', (error: Error) => {
      console.error('🚨 Shoonya WebSocket error:', error.message);
    });
  }

  /**
   * Connect to Shoonya WebSocket
   */
  async connect(sessionToken: string, userId: string): Promise<void> {
    if (!this.webSocketEnabled) {
      console.log('⚠️ WebSocket disabled due to persistent connection issues');
      return;
    }

    if (this.isConnected) {
      console.log('⚠️ Already connected to Shoonya WebSocket');
      return;
    }

    this.sessionToken = sessionToken;
    this.userId = userId;

    try {
      console.log('🔄 Connecting to Shoonya WebSocket...');

      // Create WebSocket with improved options
      this.ws = new WebSocket(this.wsUrl, {
        timeout: 60000, // 60 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Origin': 'https://shoonya.com',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        handshakeTimeout: 30000, // 30 second handshake timeout
        perMessageDeflate: false // Disable compression to avoid issues
      });

      this.ws.on('open', () => {
        console.log('🔗 WebSocket connection opened');
        this.emit('connected');
        this.authenticate();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', (code: number, reason: string) => {
        console.log(`🔌 WebSocket closed: ${code} - ${reason}`);
        this.emit('disconnected');
      });

      this.ws.on('error', (error: Error) => {
        console.error('🚨 WebSocket error:', error);

        // Handle specific error types
        if (error.message.includes('504') || error.message.includes('Gateway Timeout')) {
          console.log('🔄 Server temporarily unavailable (504), will retry...');
        } else if (error.message.includes('503') || error.message.includes('Service Unavailable')) {
          console.log('🔄 Service temporarily unavailable (503), will retry...');
        } else if (error.message.includes('502') || error.message.includes('Bad Gateway')) {
          console.log('🔄 Bad gateway (502), will retry...');
        }

        this.emit('error', error);
      });

    } catch (error: any) {
      console.error('🚨 Failed to connect to Shoonya WebSocket:', error.message);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Authenticate with Shoonya WebSocket
   */
  private authenticate(): void {
    if (!this.sessionToken || !this.userId) {
      console.error('❌ Missing session token or user ID for authentication');
      return;
    }

    const authMessage = {
      t: 'c',                    // Connect/Auth message type
      uid: this.userId,
      actid: this.userId,
      susertoken: this.sessionToken,
      source: 'API'
    };

    this.sendMessage(authMessage);
    console.log('🔐 Sent authentication message');
  }

  /**
   * Subscribe to order updates for a user
   */
  subscribeToOrderUpdates(userId: string): void {
    if (!this.isAuthenticated) {
      console.warn('⚠️ Not authenticated, queuing subscription for user:', userId);
      this.subscribedUsers.add(userId);
      return;
    }

    const subscribeMessage = {
      t: 'o',                    // Order subscription message type
      uid: userId,
      actid: userId
    };

    this.sendMessage(subscribeMessage);
    this.subscribedUsers.add(userId);
    console.log(`📊 Subscribed to order updates for user: ${userId}`);
  }

  /**
   * Unsubscribe from order updates for a user
   */
  unsubscribeFromOrderUpdates(userId: string): void {
    if (!this.isAuthenticated) {
      console.warn('⚠️ Not authenticated, cannot unsubscribe');
      return;
    }

    const unsubscribeMessage = {
      t: 'u',                    // Unsubscribe message type
      uid: userId,
      actid: userId
    };

    this.sendMessage(unsubscribeMessage);
    this.subscribedUsers.delete(userId);
    console.log(`📊 Unsubscribed from order updates for user: ${userId}`);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as WebSocketMessage;
      
      switch (message.t) {
        case 'ck':
          // Connection acknowledgment
          console.log('✅ Connection acknowledged');
          this.emit('authenticated');
          break;

        case 'om':
          // Order message - real-time order update
          this.handleOrderUpdate(message as any);
          break;

        case 'hb':
          // Heartbeat response
          console.log('💓 Heartbeat received');
          break;

        default:
          console.log('📨 Unknown message type:', message.t, message);
          break;
      }

    } catch (error: any) {
      console.error('🚨 Failed to parse WebSocket message:', error.message);
      console.error('📨 Raw message:', data.toString());
    }
  }

  /**
   * Handle order update messages
   */
  private handleOrderUpdate(orderUpdate: ShoonyaOrderUpdate): void {
    // Validate order update
    if (!orderUpdate.norenordno || !orderUpdate.status) {
      console.warn('⚠️ Invalid order update received:', orderUpdate);
      return;
    }

    // Emit order update event
    this.emit('order_update', orderUpdate);
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(message: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket not connected, cannot send message');
      return;
    }

    try {
      const messageStr = JSON.stringify(message);
      this.ws.send(messageStr);
      console.log('📤 Sent message:', messageStr);
    } catch (error: any) {
      console.error('🚨 Failed to send WebSocket message:', error.message);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isAuthenticated) {
        this.sendMessage({ t: 'h' }); // Heartbeat message
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Re-subscribe all users after reconnection
   */
  private resubscribeAllUsers(): void {
    for (const userId of this.subscribedUsers) {
      this.subscribeToOrderUpdates(userId);
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached, disabling WebSocket for this session');
      console.log('🔄 Falling back to REST API polling for order updates');
      this.webSocketEnabled = false;
      return;
    }

    this.reconnectAttempts++;

    // Exponential backoff with jitter for 504 errors
    const baseDelay = this.reconnectDelay;
    const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000; // Add up to 1 second of jitter
    const delay = Math.min(exponentialDelay + jitter, 60000); // Cap at 60 seconds

    console.log(`🔄 Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${Math.round(delay)}ms`);

    setTimeout(() => {
      if (this.sessionToken && this.userId) {
        this.connect(this.sessionToken, this.userId);
      }
    }, delay);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('🔌 Disconnecting from Shoonya WebSocket...');
    
    this.stopHeartbeat();
    this.subscribedUsers.clear();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isAuthenticated = false;
    this.sessionToken = null;
    this.userId = null;
  }

  /**
   * Get connection status
   */
  getStatus(): {
    isConnected: boolean;
    isAuthenticated: boolean;
    subscribedUsers: number;
    reconnectAttempts: number;
    webSocketEnabled: boolean;
  } {
    return {
      isConnected: this.isConnected,
      isAuthenticated: this.isAuthenticated,
      subscribedUsers: this.subscribedUsers.size,
      reconnectAttempts: this.reconnectAttempts,
      webSocketEnabled: this.webSocketEnabled
    };
  }

  /**
   * Re-enable WebSocket (useful after network issues are resolved)
   */
  enableWebSocket(): void {
    this.webSocketEnabled = true;
    this.reconnectAttempts = 0;
    console.log('✅ WebSocket re-enabled');
  }

  /**
   * Disable WebSocket (force REST API fallback)
   */
  disableWebSocket(): void {
    this.webSocketEnabled = false;
    if (this.ws) {
      this.ws.close();
    }
    console.log('⚠️ WebSocket disabled, using REST API fallback');
  }
}

// Create singleton instance
const shoonyaWebSocketService = new ShoonyaWebSocketService();

export default shoonyaWebSocketService;
