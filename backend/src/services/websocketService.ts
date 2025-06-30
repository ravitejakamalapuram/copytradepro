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
}

class WebSocketService {
  private io: Server | null = null;
  private userSockets: Map<string, Set<string>> = new Map();
  private isInitialized: boolean = false;

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
      path: '/socket.io/'
    });

    // Authentication middleware
    this.io.use(this.authenticateSocket.bind(this));

    this.io.on('connection', this.handleConnection.bind(this));

    this.isInitialized = true;
    logger.info('Socket.IO service initialized');
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

    // Add socket to user tracking
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Set up event handlers (order monitoring removed - using manual refresh only)

    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, reason);
    });

    // Send welcome message
    socket.emit('connection', {
      status: 'connected',
      message: 'Real-time updates enabled',
      timestamp: new Date().toISOString()
    });

    // WebSocket connected successfully (order monitoring removed)
  }



  /**
   * Handle client disconnection
   */
  handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    const userId = socket.userId;
    logger.info(`Socket.IO client disconnected: User ${userId} (${socket.id}) - ${reason}`);

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
   * Get Socket.IO server instance
   */
  getIO(): Server | null {
    return this.io;
  }

  /**
   * Shutdown Socket.IO service
   */
  shutdown(): void {
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

export default websocketService;
