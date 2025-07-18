import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Server as HttpServer } from 'http';

// Simple logger for now
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args),
  debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${message}`, ...args),
};

interface AuthenticatedSocket extends Socket {
  userId?: string;
  lastActivity?: Date;
  connectionHealth?: number;
}

interface ConnectionHealth {
  socketId: string;
  userId: string;
  connectedAt: Date;
  lastActivity: Date;
  healthScore: number;
  reconnectCount: number;
  lastError?: string;
}

class WebSocketService {
  private io: Server | null = null;
  private userSockets: Map<string, Set<string>> = new Map();
  private connectionHealth: Map<string, ConnectionHealth> = new Map();
  private isInitialized: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  /**
   * Initialize Socket.IO server
   */
  initialize(server: HttpServer): void {
    if (this.isInitialized) {
      logger.warn('Socket.IO service already initialized');
      return;
    }

    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || ["http://localhost:5173", "http://localhost:5174"],
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io/',
      // Enhanced connection options for better reliability
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      allowUpgrades: true,
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', this.handleConnection.bind(this));

    // Start health monitoring
    this.startHealthMonitoring();

    this.isInitialized = true;
    logger.info('Socket.IO service initialized with enhanced connection management');
  }

  /**
   * Authenticate Socket.IO connection
   */
  authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void): void {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        logger.warn('Socket.IO connection rejected: No token provided');
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      socket.userId = decoded.id; // JWT contains 'id', not 'userId'

      logger.info(`Socket.IO client authenticated: User ${decoded.id}`);
      next();
    } catch (error: any) {
      logger.warn('Socket.IO connection rejected: Invalid token', error?.message);
      next(new Error('Authentication error: Invalid token'));
    }
  }

  /**
   * Handle new Socket.IO connection
   */
  handleConnection(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    logger.info(`Socket.IO client connected: User ${userId} (${socket.id})`);

    if (!userId) {
      logger.error('Socket connection without userId');
      socket.disconnect();
      return;
    }

    // Initialize connection health tracking
    this.initializeConnectionHealth(socket, userId);

    // Add socket to user tracking
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Set up enhanced event handlers
    this.setupSocketEventHandlers(socket);

    // Send welcome message with connection health info
    socket.emit('connection', {
      status: 'connected',
      message: 'Real-time updates enabled',
      timestamp: new Date().toISOString(),
      connectionId: socket.id,
      healthMonitoring: true
    });

    logger.debug(`WebSocket connection established for user ${userId}`);
  }



  /**
   * Initialize connection health tracking
   */
  private initializeConnectionHealth(socket: AuthenticatedSocket, userId: string): void {
    const now = new Date();
    const health: ConnectionHealth = {
      socketId: socket.id,
      userId,
      connectedAt: now,
      lastActivity: now,
      healthScore: 100,
      reconnectCount: 0
    };

    this.connectionHealth.set(socket.id, health);
    socket.lastActivity = now;
    socket.connectionHealth = 100;

    logger.debug(`Connection health initialized for socket ${socket.id}`);
  }

  /**
   * Set up enhanced socket event handlers
   */
  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    // Handle disconnection
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle ping/pong for connection health
    socket.on('ping', () => {
      this.updateConnectionActivity(socket.id);
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });

    // Handle connection health check
    socket.on('health_check', () => {
      const health = this.connectionHealth.get(socket.id);
      socket.emit('health_response', {
        socketId: socket.id,
        healthScore: health?.healthScore || 0,
        lastActivity: health?.lastActivity,
        uptime: health ? Date.now() - health.connectedAt.getTime() : 0
      });
    });

    // Handle reconnection attempts
    socket.on('reconnect_attempt', (data: { attempt: number }) => {
      const health = this.connectionHealth.get(socket.id);
      if (health) {
        health.reconnectCount = data.attempt;
        this.connectionHealth.set(socket.id, health);
      }
      logger.info(`Reconnection attempt ${data.attempt} for socket ${socket.id}`);
    });

    // Handle Greeks subscription events
    socket.on('subscribe_greeks', (data: { symbols: string[], updateFrequency?: number }) => {
      this.handleGreeksSubscription(socket, data);
    });

    socket.on('unsubscribe_greeks', () => {
      this.handleGreeksUnsubscription(socket);
    });

    socket.on('request_portfolio_greeks', () => {
      this.handlePortfolioGreeksRequest(socket);
    });

    // Handle derivatives data subscription events
    socket.on('subscribe_derivatives_data', (data: { symbols: string[], underlyings: string[] }) => {
      this.handleDerivativesDataSubscription(socket, data);
    });

    socket.on('unsubscribe_derivatives_data', (data: { symbols?: string[], underlyings?: string[] }) => {
      this.handleDerivativesDataUnsubscription(socket, data);
    });

    // Handle error events
    socket.on('error', (error: Error) => {
      this.handleSocketError(socket, error);
    });

    // Update activity on any event
    socket.onAny(() => {
      this.updateConnectionActivity(socket.id);
    });
  }

  /**
   * Update connection activity timestamp
   */
  private updateConnectionActivity(socketId: string): void {
    const health = this.connectionHealth.get(socketId);
    if (health) {
      health.lastActivity = new Date();
      this.connectionHealth.set(socketId, health);
    }
  }

  /**
   * Handle socket errors
   */
  private handleSocketError(socket: AuthenticatedSocket, error: Error): void {
    logger.error(`Socket error for ${socket.id}:`, error.message);
    
    const health = this.connectionHealth.get(socket.id);
    if (health) {
      health.lastError = error.message;
      health.healthScore = Math.max(0, health.healthScore - 10);
      this.connectionHealth.set(socket.id, health);
    }

    // Emit error to client for handling
    socket.emit('connection_error', {
      message: 'Connection error occurred',
      canRetry: true,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);

    logger.info(`Health monitoring started with ${this.HEALTH_CHECK_INTERVAL}ms interval`);
  }

  /**
   * Perform health check on all connections
   */
  private performHealthCheck(): void {
    const now = new Date();
    const staleConnections: string[] = [];

    for (const [socketId, health] of this.connectionHealth.entries()) {
      const timeSinceActivity = now.getTime() - health.lastActivity.getTime();
      
      // Consider connection stale if no activity for 2 minutes
      if (timeSinceActivity > 120000) {
        health.healthScore = Math.max(0, health.healthScore - 5);
        
        // Mark for cleanup if health is too low
        if (health.healthScore < 20) {
          staleConnections.push(socketId);
        }
      } else {
        // Improve health score for active connections
        health.healthScore = Math.min(100, health.healthScore + 1);
      }

      this.connectionHealth.set(socketId, health);
    }

    // Clean up stale connections
    staleConnections.forEach(socketId => {
      const socket = this.io?.sockets.sockets.get(socketId);
      if (socket) {
        logger.warn(`Disconnecting stale connection: ${socketId}`);
        socket.disconnect(true);
      }
      this.connectionHealth.delete(socketId);
    });

    if (staleConnections.length > 0) {
      logger.info(`Cleaned up ${staleConnections.length} stale connections`);
    }
  }

  /**
   * Handle Greeks subscription request
   */
  private handleGreeksSubscription(socket: AuthenticatedSocket, data: { symbols: string[], updateFrequency?: number }): void {
    const userId = socket.userId;
    if (!userId) return;

    try {
      // Import and use the real-time Greeks service
      const { realTimeGreeksService } = require('./realTimeGreeksService');
      realTimeGreeksService.subscribeToGreeks(userId, data.symbols, data.updateFrequency);
      
      socket.emit('greeks_subscription_success', {
        symbols: data.symbols,
        updateFrequency: data.updateFrequency,
        timestamp: new Date().toISOString()
      });

      logger.info(`Greeks subscription created for user ${userId} with ${data.symbols.length} symbols`);
    } catch (error: any) {
      logger.error(`Error creating Greeks subscription for user ${userId}:`, error);
      socket.emit('greeks_subscription_error', {
        message: 'Failed to subscribe to Greeks updates',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle Greeks unsubscription request
   */
  private handleGreeksUnsubscription(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    if (!userId) return;

    try {
      const { realTimeGreeksService } = require('./realTimeGreeksService');
      realTimeGreeksService.unsubscribeFromGreeks(userId);
      
      socket.emit('greeks_unsubscription_success', {
        timestamp: new Date().toISOString()
      });

      logger.info(`Greeks subscription removed for user ${userId}`);
    } catch (error: any) {
      logger.error(`Error removing Greeks subscription for user ${userId}:`, error);
      socket.emit('greeks_unsubscription_error', {
        message: 'Failed to unsubscribe from Greeks updates',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle portfolio Greeks request
   */
  private handlePortfolioGreeksRequest(socket: AuthenticatedSocket): void {
    const userId = socket.userId;
    if (!userId) return;

    try {
      const { realTimeGreeksService } = require('./realTimeGreeksService');
      const portfolioGreeks = realTimeGreeksService.getPortfolioGreeks(userId);
      
      socket.emit('portfolio_greeks_response', {
        portfolioGreeks,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Portfolio Greeks sent to user ${userId}`);
    } catch (error: any) {
      logger.error(`Error getting portfolio Greeks for user ${userId}:`, error);
      socket.emit('portfolio_greeks_error', {
        message: 'Failed to get portfolio Greeks',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle derivatives data subscription request
   */
  private handleDerivativesDataSubscription(socket: AuthenticatedSocket, data: { symbols: string[], underlyings: string[] }): void {
    const userId = socket.userId;
    if (!userId) return;

    try {
      // Join rooms for derivatives data updates
      data.symbols.forEach(symbol => {
        socket.join(`derivatives:${symbol}`);
      });
      
      data.underlyings.forEach(underlying => {
        socket.join(`underlying:${underlying}`);
      });

      socket.emit('derivatives_subscription_success', {
        symbols: data.symbols,
        underlyings: data.underlyings,
        timestamp: new Date().toISOString()
      });

      logger.info(`Derivatives data subscription created for user ${userId}`);
    } catch (error: any) {
      logger.error(`Error creating derivatives data subscription for user ${userId}:`, error);
      socket.emit('derivatives_subscription_error', {
        message: 'Failed to subscribe to derivatives data',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle derivatives data unsubscription request
   */
  private handleDerivativesDataUnsubscription(socket: AuthenticatedSocket, data: { symbols?: string[], underlyings?: string[] }): void {
    const userId = socket.userId;
    if (!userId) return;

    try {
      // Leave rooms for derivatives data updates
      if (data.symbols) {
        data.symbols.forEach(symbol => {
          socket.leave(`derivatives:${symbol}`);
        });
      }
      
      if (data.underlyings) {
        data.underlyings.forEach(underlying => {
          socket.leave(`underlying:${underlying}`);
        });
      }

      socket.emit('derivatives_unsubscription_success', {
        symbols: data.symbols,
        underlyings: data.underlyings,
        timestamp: new Date().toISOString()
      });

      logger.info(`Derivatives data unsubscription processed for user ${userId}`);
    } catch (error: any) {
      logger.error(`Error processing derivatives data unsubscription for user ${userId}:`, error);
      socket.emit('derivatives_unsubscription_error', {
        message: 'Failed to unsubscribe from derivatives data',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const userId = socket.userId;
    logger.info(`Socket.IO client disconnected: User ${userId} (${socket.id}) - ${reason}`);

    // Clean up Greeks subscriptions
    if (userId) {
      try {
        const { realTimeGreeksService } = require('./realTimeGreeksService');
        realTimeGreeksService.cleanup(userId);
      } catch (error) {
        // Service might not be available during shutdown
        logger.debug(`Could not cleanup Greeks service for user ${userId}`);
      }
    }

    // Clean up connection health tracking
    this.connectionHealth.delete(socket.id);

    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(socket.id);

      // Remove user entry if no more connections
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }



  /**
   * Send message to all clients of a specific user
   */
  sendToUser(userId: string, event: string, data: any): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Broadcast derivatives data update to all subscribed clients
   */
  broadcastDerivativesUpdate(symbol: string, data: any): void {
    if (!this.io) return;
    this.io.to(`derivatives:${symbol}`).emit('derivatives_data_update', {
      symbol,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast underlying price update to all subscribed clients
   */
  broadcastUnderlyingUpdate(underlying: string, data: any): void {
    if (!this.io) return;
    this.io.to(`underlying:${underlying}`).emit('underlying_price_update', {
      underlying,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send Greeks update to specific user
   */
  sendGreeksUpdate(userId: string, updates: any[]): void {
    if (!this.io) return;
    this.sendToUser(userId, 'greeks_update', {
      updates,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send portfolio Greeks update to specific user
   */
  sendPortfolioGreeksUpdate(userId: string, portfolioGreeks: any): void {
    if (!this.io) return;
    this.sendToUser(userId, 'portfolio_greeks_update', {
      portfolioGreeks,
      timestamp: new Date().toISOString()
    });
  }



  /**
   * Get connection statistics with health information
   */
  getStats() {
    const totalConnections = Array.from(this.userSockets.values())
      .reduce((sum, socketSet) => sum + socketSet.size, 0);

    const healthStats = Array.from(this.connectionHealth.values());
    const averageHealth = healthStats.length > 0 
      ? healthStats.reduce((sum, h) => sum + h.healthScore, 0) / healthStats.length 
      : 0;

    const healthyConnections = healthStats.filter(h => h.healthScore >= 80).length;
    const degradedConnections = healthStats.filter(h => h.healthScore >= 50 && h.healthScore < 80).length;
    const unhealthyConnections = healthStats.filter(h => h.healthScore < 50).length;

    return {
      isInitialized: this.isInitialized,
      totalUsers: this.userSockets.size,
      totalConnections,
      connectedSockets: this.io ? this.io.sockets.sockets.size : 0,
      users: Array.from(this.userSockets.keys()),
      health: {
        averageHealthScore: Math.round(averageHealth),
        healthyConnections,
        degradedConnections,
        unhealthyConnections,
        totalTracked: healthStats.length
      },
      monitoring: {
        healthCheckInterval: this.HEALTH_CHECK_INTERVAL,
        maxReconnectAttempts: this.MAX_RECONNECT_ATTEMPTS,
        isMonitoring: this.healthCheckInterval !== null
      }
    };
  }

  /**
   * Get detailed connection health for a specific user
   */
  getUserConnectionHealth(userId: string): ConnectionHealth[] {
    const userSockets = this.userSockets.get(userId);
    if (!userSockets) return [];

    return Array.from(userSockets)
      .map(socketId => this.connectionHealth.get(socketId))
      .filter((health): health is ConnectionHealth => health !== undefined);
  }

  /**
   * Force disconnect unhealthy connections
   */
  cleanupUnhealthyConnections(): number {
    let cleanedUp = 0;
    const unhealthyThreshold = 30;

    for (const [socketId, health] of this.connectionHealth.entries()) {
      if (health.healthScore < unhealthyThreshold) {
        const socket = this.io?.sockets.sockets.get(socketId);
        if (socket) {
          logger.warn(`Force disconnecting unhealthy connection: ${socketId} (health: ${health.healthScore})`);
          socket.disconnect(true);
          cleanedUp++;
        }
        this.connectionHealth.delete(socketId);
      }
    }

    return cleanedUp;
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): Server | null {
    return this.io;
  }

  /**
   * Cleanup stale connections and resources
   */
  cleanupStaleResources(): number {
    let cleanedCount = 0;
    const now = new Date();
    const staleThreshold = 300000; // 5 minutes

    // Clean up stale connection health entries
    for (const [socketId, health] of this.connectionHealth.entries()) {
      const timeSinceActivity = now.getTime() - health.lastActivity.getTime();
      
      if (timeSinceActivity > staleThreshold) {
        // Check if socket still exists
        const socket = this.io?.sockets.sockets.get(socketId);
        if (!socket) {
          this.connectionHealth.delete(socketId);
          cleanedCount++;
        }
      }
    }

    // Clean up orphaned user socket entries
    for (const [userId, socketIds] of this.userSockets.entries()) {
      const validSocketIds = new Set<string>();
      
      for (const socketId of socketIds) {
        const socket = this.io?.sockets.sockets.get(socketId);
        if (socket) {
          validSocketIds.add(socketId);
        } else {
          cleanedCount++;
        }
      }
      
      if (validSocketIds.size === 0) {
        this.userSockets.delete(userId);
      } else if (validSocketIds.size !== socketIds.size) {
        this.userSockets.set(userId, validSocketIds);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} stale WebSocket resources`);
    }

    return cleanedCount;
  }

  /**
   * Force cleanup of all resources for a user
   */
  cleanupUserResources(userId: string): number {
    const socketIds = this.userSockets.get(userId);
    if (!socketIds) return 0;

    let cleanedCount = 0;
    
    // Disconnect all user sockets
    for (const socketId of socketIds) {
      const socket = this.io?.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        cleanedCount++;
      }
      
      // Remove connection health tracking
      this.connectionHealth.delete(socketId);
    }
    
    // Remove user from tracking
    this.userSockets.delete(userId);
    
    logger.info(`Cleaned up ${cleanedCount} resources for user ${userId}`);
    return cleanedCount;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const connectionHealthSize = this.connectionHealth.size;
    const userSocketsSize = this.userSockets.size;
    const totalTrackedSockets = Array.from(this.userSockets.values())
      .reduce((sum, socketSet) => sum + socketSet.size, 0);
    
    return {
      connectionHealthEntries: connectionHealthSize,
      userSocketMappings: userSocketsSize,
      totalTrackedSockets,
      actualConnectedSockets: this.io ? this.io.sockets.sockets.size : 0,
      memoryEstimate: {
        connectionHealth: connectionHealthSize * 200, // Rough estimate in bytes
        userSockets: totalTrackedSockets * 50,
        total: (connectionHealthSize * 200) + (totalTrackedSockets * 50)
      }
    };
  }

  /**
   * Shutdown Socket.IO service
   */
  shutdown(): void {
    if (this.io) {
      logger.info('Shutting down Socket.IO service');

      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Cleanup all resources
      this.cleanupStaleResources();

      // Disconnect all clients gracefully
      this.io.sockets.emit('server_shutdown', {
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
      });

      // Close all connections
      this.io.close();
      this.userSockets.clear();
      this.connectionHealth.clear();
      this.isInitialized = false;
      
      logger.info('Socket.IO service shutdown complete');
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

export default websocketService;
