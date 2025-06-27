const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const orderStatusService = require('./orderStatusService');

class WebSocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map(); // Map of userId -> Set of socket IDs
    this.isInitialized = false;
  }

  /**
   * Initialize Socket.IO server
   */
  initialize(server) {
    if (this.isInitialized) {
      logger.warn('Socket.IO service already initialized');
      return;
    }

    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io/'
    });

    // Authentication middleware
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', this.handleConnection.bind(this));
    this.setupOrderStatusListeners();

    this.isInitialized = true;
    logger.info('Socket.IO service initialized');
  }

  /**
   * Authenticate Socket.IO connection
   */
  authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        logger.warn('Socket.IO connection rejected: No token provided');
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.userId;

      logger.info(`Socket.IO client authenticated: User ${decoded.userId}`);
      next();
    } catch (error) {
      logger.warn('Socket.IO connection rejected: Invalid token', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  }

  /**
   * Handle new Socket.IO connection
   */
  handleConnection(socket) {
    const userId = socket.userId;
    logger.info(`Socket.IO client connected: User ${userId} (${socket.id})`);

    // Add socket to user tracking
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Set up event handlers
    socket.on('subscribe_orders', () => {
      this.handleOrderSubscription(socket);
    });

    socket.on('unsubscribe_orders', () => {
      this.handleOrderUnsubscription(socket);
    });

    socket.on('get_monitoring_status', () => {
      this.sendMonitoringStatus(socket);
    });

    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Send welcome message
    socket.emit('connection', {
      status: 'connected',
      message: 'Real-time updates enabled',
      timestamp: new Date().toISOString()
    });

    // Auto-subscribe to orders and send monitoring status
    this.handleOrderSubscription(socket);
    this.sendMonitoringStatus(socket);
  }

  /**
   * Handle incoming messages from clients
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data);
      logger.debug(`WebSocket message from user ${ws.userId}:`, message);

      switch (message.type) {
        case 'ping':
          this.sendToClient(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'subscribe_orders':
          this.handleOrderSubscription(ws, message);
          break;

        case 'unsubscribe_orders':
          this.handleOrderUnsubscription(ws, message);
          break;

        case 'get_monitoring_status':
          this.sendMonitoringStatus(ws);
          break;

        default:
          logger.warn(`Unknown WebSocket message type: ${message.type}`);
      }
    } catch (error) {
      logger.error(`Error handling WebSocket message from user ${ws.userId}:`, error);
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(socket, reason) {
    const userId = socket.userId;
    logger.info(`Socket.IO client disconnected: User ${userId} (${socket.id}) - ${reason}`);

    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(socket.id);

      // Remove user entry if no more connections
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Handle order subscription
   */
  handleOrderSubscription(socket) {
    const userId = socket.userId;

    // Join orders room for this user
    socket.join(`orders:${userId}`);
    socket.subscribedToOrders = true;

    socket.emit('subscription_confirmed', {
      subscription: 'orders',
      message: 'Subscribed to order status updates',
      timestamp: new Date().toISOString()
    });

    logger.debug(`User ${userId} subscribed to order updates`);
  }

  /**
   * Handle order unsubscription
   */
  handleOrderUnsubscription(socket) {
    const userId = socket.userId;

    // Leave orders room
    socket.leave(`orders:${userId}`);
    socket.subscribedToOrders = false;

    socket.emit('subscription_cancelled', {
      subscription: 'orders',
      message: 'Unsubscribed from order status updates',
      timestamp: new Date().toISOString()
    });

    logger.debug(`User ${userId} unsubscribed from order updates`);
  }

  /**
   * Send monitoring status to client
   */
  sendMonitoringStatus(socket) {
    const stats = orderStatusService.getMonitoringStats();

    socket.emit('monitoring_status', {
      data: stats,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Set up listeners for order status events
   */
  setupOrderStatusListeners() {
    // Listen for order status changes
    orderStatusService.on('orderStatusChanged', (event) => {
      this.broadcastOrderStatusChange(event);
    });

    // Listen for order execution updates
    orderStatusService.on('orderExecutionUpdated', (event) => {
      this.broadcastOrderExecutionUpdate(event);
    });
  }

  /**
   * Broadcast order status change to relevant clients
   */
  broadcastOrderStatusChange(event) {
    const data = {
      orderId: event.orderId,
      oldStatus: event.oldStatus,
      newStatus: event.newStatus,
      order: {
        id: event.order.id,
        symbol: event.order.symbol,
        action: event.order.action,
        quantity: event.order.quantity,
        price: event.order.price,
        status: event.order.status,
        broker_name: event.order.broker_name,
        executed_at: event.order.executed_at
      },
      timestamp: event.timestamp.toISOString()
    };

    // Broadcast to all users subscribed to orders
    // In production, you'd filter by user ownership of orders
    this.io.emit('order_status_changed', data);

    logger.debug(`Broadcasted order status change: ${event.order.symbol} ${event.oldStatus} → ${event.newStatus}`);
  }

  /**
   * Broadcast order execution update to relevant clients
   */
  broadcastOrderExecutionUpdate(event) {
    const data = {
      orderId: event.orderId,
      executionData: event.executionData,
      order: {
        id: event.order.id,
        symbol: event.order.symbol,
        executed_quantity: event.order.executed_quantity,
        average_price: event.order.average_price
      },
      timestamp: event.timestamp.toISOString()
    };

    this.io.emit('order_execution_updated', data);

    logger.debug(`Broadcasted order execution update: ${event.order.symbol} - ${event.executionData.executed_quantity} shares`);
  }

  /**
   * Send message to all clients of a specific user
   */
  sendToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }

  /**
   * Send message to user's order subscription
   */
  sendToUserOrders(userId, event, data) {
    this.io.to(`orders:${userId}`).emit(event, data);
  }

  /**
   * Get connection statistics
   */
  getStats() {
    const totalConnections = Array.from(this.userSockets.values())
      .reduce((sum, socketSet) => sum + socketSet.size, 0);

    return {
      isInitialized: this.isInitialized,
      totalUsers: this.userSockets.size,
      totalConnections,
      users: Array.from(this.userSockets.keys()),
      connectedSockets: this.io ? this.io.sockets.sockets.size : 0
    };
  }

  /**
   * Shutdown Socket.IO service
   */
  shutdown() {
    if (this.io) {
      logger.info('Shutting down Socket.IO service');

      // Close all connections
      this.io.close();
      this.userSockets.clear();
      this.isInitialized = false;
    }
  }
}

// Create singleton instance
const websocketService = new WebSocketService();

module.exports = websocketService;
