/**
 * REAL-TIME DATA SERVICE
 * WebSocket-based live price streaming using NSE API
 */

import { Server as SocketIOServer } from 'socket.io';

interface PriceSubscription {
  symbol: string;
  exchange: string;
  userId: string;
  socketId: string;
}

interface LivePrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
  exchange: string;
}

class RealTimeDataService {
  private io: SocketIOServer | null = null;
  private subscriptions = new Map<string, Set<PriceSubscription>>();
  private priceCache = new Map<string, LivePrice>();
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_FREQUENCY = 5000; // 5 seconds for live updates

  constructor() {
    console.log('🔄 Real-time Data Service initialized');
  }

  /**
   * Initialize with Socket.IO server
   */
  initialize(io: SocketIOServer): void {
    this.io = io;
    this.setupSocketHandlers();
    // Price updates disabled per user request
    // this.startPriceUpdates();
    console.log('✅ Real-time data service connected to Socket.IO (price updates disabled)');
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log(`📱 Client connected: ${socket.id}`);

      // Handle symbol subscription
      socket.on('subscribe_symbol', (data: { symbol: string; exchange: string; userId: string }) => {
        this.subscribeToSymbol(data.symbol, data.exchange, data.userId, socket.id);
      });

      // Handle symbol unsubscription
      socket.on('unsubscribe_symbol', (data: { symbol: string; exchange: string }) => {
        this.unsubscribeFromSymbol(data.symbol, data.exchange, socket.id);
      });

      // Handle market indices subscription
      socket.on('subscribe_indices', () => {
        socket.join('market_indices');
        console.log(`📊 Client ${socket.id} subscribed to market indices`);
      });

      // Handle market indices unsubscription
      socket.on('unsubscribe_indices', () => {
        socket.leave('market_indices');
        console.log(`📊 Client ${socket.id} unsubscribed from market indices`);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleClientDisconnect(socket.id);
        console.log(`📱 Client disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Subscribe to symbol price updates
   */
  private subscribeToSymbol(symbol: string, exchange: string, userId: string, socketId: string): void {
    const key = `${symbol}:${exchange}`;
    
    if (!this.subscriptions.has(key)) {
      this.subscriptions.set(key, new Set());
    }

    const subscription: PriceSubscription = { symbol, exchange, userId, socketId };
    this.subscriptions.get(key)!.add(subscription);

    console.log(`📈 Client ${socketId} subscribed to ${symbol} on ${exchange}`);

    // Send cached price immediately if available
    const cachedPrice = this.priceCache.get(key);
    if (cachedPrice && this.io) {
      this.io.to(socketId).emit('price_update', cachedPrice);
    }
  }

  /**
   * Unsubscribe from symbol price updates
   */
  private unsubscribeFromSymbol(symbol: string, exchange: string, socketId: string): void {
    const key = `${symbol}:${exchange}`;
    const subscriptions = this.subscriptions.get(key);
    
    if (subscriptions) {
      // Remove subscriptions for this socket
      const toRemove = Array.from(subscriptions).filter(sub => sub.socketId === socketId);
      toRemove.forEach(sub => subscriptions.delete(sub));

      // Clean up empty subscription sets
      if (subscriptions.size === 0) {
        this.subscriptions.delete(key);
      }

      console.log(`📉 Client ${socketId} unsubscribed from ${symbol} on ${exchange}`);
    }
  }

  /**
   * Handle client disconnect - clean up all subscriptions
   */
  private handleClientDisconnect(socketId: string): void {
    for (const [key, subscriptions] of this.subscriptions.entries()) {
      const toRemove = Array.from(subscriptions).filter(sub => sub.socketId === socketId);
      toRemove.forEach(sub => subscriptions.delete(sub));

      // Clean up empty subscription sets
      if (subscriptions.size === 0) {
        this.subscriptions.delete(key);
      }
    }
  }

  /**
   * Start periodic price updates
   */
  private startPriceUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      await this.updatePrices();
      // Removed market indices updates due to NSE API reliability issues
    }, this.UPDATE_FREQUENCY);

    console.log(`⏰ Started price updates every ${this.UPDATE_FREQUENCY}ms`);
  }

  /**
   * Update prices for all subscribed symbols
   */
  private async updatePrices(): Promise<void> {
    if (!this.io || this.subscriptions.size === 0) return;

    const symbols = Array.from(this.subscriptions.keys());
    
    for (const key of symbols) {
      try {
        const [symbol, exchange] = key.split(':');
        if (!symbol || !exchange) continue;

        // Real-time price updates disabled - NSE service removed
        // This functionality will be replaced with standardized symbol management system
        console.log(`⚠️ Real-time price updates temporarily disabled for ${symbol} - awaiting standardized symbol system integration`);
      } catch (error) {
        console.warn(`⚠️ Failed to update price for ${key}:`, error);
        
        // Emit error event for failed price updates
        const subscriptions = this.subscriptions.get(key);
        if (subscriptions) {
          for (const subscription of subscriptions) {
            this.io.to(subscription.socketId).emit('price_update_error', {
              symbol: key.split(':')[0],
              exchange: key.split(':')[1],
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date(),
              eventId: `price_error_${key}_${Date.now()}`
            });
          }
        }
      }

      // Rate limiting - small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Update and broadcast market indices - DISABLED
   * Removed due to NSE API reliability issues causing timeouts
   */
  private async updateMarketIndices(): Promise<void> {
    // Functionality disabled due to NSE API reliability issues
    console.log('📊 Market indices updates disabled due to API reliability issues');
    return;
  }

  /**
   * Broadcast market status updates - DISABLED
   * Disabled due to NSE API reliability issues causing timeouts
   */
  async broadcastMarketStatus(): Promise<void> {
    console.log('📢 Market status broadcast disabled due to API reliability issues');
    return;
  }

  /**
   * Get current subscription stats
   */
  getStats(): any {
    return {
      service: 'Real-time Data Service',
      status: 'active',
      connectedClients: this.io?.sockets.sockets.size || 0,
      activeSubscriptions: this.subscriptions.size,
      cachedPrices: this.priceCache.size,
      updateFrequency: this.UPDATE_FREQUENCY,
      lastUpdate: new Date().toISOString()
    };
  }

  /**
   * Stop the service
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.subscriptions.clear();
    this.priceCache.clear();
    
    console.log('🛑 Real-time data service stopped');
  }
}

export const realTimeDataService = new RealTimeDataService();
export default realTimeDataService;
