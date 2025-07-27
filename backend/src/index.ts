import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';

// Import unified broker system
import { initializeUnifiedBroker } from '@copytrade/unified-broker';

import authRoutes from './routes/auth';
import brokerRoutes from './routes/broker';
import portfolioRoutes from './routes/portfolio';
import advancedOrdersRoutes from './routes/advancedOrders';
import marketDataRoutes from './routes/marketData';
import logsRoutes from './routes/logs';
import monitoringRoutes from './routes/monitoring';
import { errorHandler } from './middleware/errorHandler';
import { loggingMiddleware, errorLoggingMiddleware } from './middleware/loggingMiddleware';
import { performanceMonitoring, requestIdMiddleware } from './middleware/performanceMonitoring';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import websocketService from './services/websocketService';
import orderStatusService from './services/orderStatusService';
import { realTimeDataService } from './services/realTimeDataService';
// Auto-initialize services on import
import './services/nseCSVService';
import './services/bseCSVService';
import './services/symbolDatabaseService';
import { getDatabase, DatabaseFactory } from './services/databaseFactory';
import { initializeBrokerAccountCache } from './controllers/brokerController';
import { productionMonitoringService } from './services/productionMonitoringService';

// Load environment variables
dotenv.config();

// Validate environment variables
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware with CSP configuration for frontend
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes default
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      `http://localhost:${PORT}`, // Allow the production server origin
      `http://127.0.0.1:${PORT}`, // Allow localhost variations
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use(requestIdMiddleware);

// Performance monitoring middleware
app.use(performanceMonitoring);

// Enhanced logging middleware
app.use(loggingMiddleware);

// Morgan logging middleware (keep for compatibility)
const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
if (process.env.ENABLE_REQUEST_LOGGING !== 'false') {
  app.use(morgan(logFormat));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  try {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: 'MongoDB',
        websocket: 'Socket.IO',
        orderMonitoring: 'Active'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// API Health check endpoint
app.get('/api/health', (_req, res) => {
  try {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      services: {
        database: 'MongoDB',
        websocket: 'Socket.IO',
        orderMonitoring: 'Active'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/broker', brokerRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/advanced-orders', advancedOrdersRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/notifications', require('./routes/notifications').default);



// Serve static files from frontend build (in production)
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, '../public');

  // Serve static files
  app.use(express.static(publicPath, {
    maxAge: '1y', // Cache static assets for 1 year
    etag: true,
    lastModified: true,
  }));

  // Handle client-side routing - serve index.html for all non-API routes
  app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
    // Skip API routes and static assets
    if (req.path.startsWith('/api/') ||
        req.path.startsWith('/health') ||
        req.path.includes('.')) {
      return next();
    }

    // Serve index.html for all other routes (SPA routing)
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
      if (err) {
        // Error serving index.html - using console.error as this is in production static file serving
        res.status(500).json({
          success: false,
          message: 'Error serving application',
        });
      }
    });
  });
} else {
  // 404 handler for development mode only
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
    });
  });
}

// Error logging middleware
app.use(errorLoggingMiddleware);

// Global error handler
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO
websocketService.initialize(server);

// Initialize real-time data service
const io = websocketService.getIO();
if (io) {
  realTimeDataService.initialize(io);
}

// Initialize database and start services
async function startServer() {
  try {
    // Check if port is already in use
    const isPortInUse = await checkPortInUse(PORT as number);
    if (isPortInUse) {
      logger.warn('Port is already in use, attempting to kill existing processes', {
        component: 'SERVER_STARTUP',
        operation: 'PORT_CHECK',
        port: PORT
      });
      await killExistingProcesses();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    }

    // Initialize database
    logger.info('Initializing database', {
      component: 'SERVER_STARTUP',
      operation: 'DATABASE_INIT'
    });
    await getDatabase();
    logger.info('Database initialized', {
      component: 'SERVER_STARTUP',
      operation: 'DATABASE_INIT_SUCCESS',
      databaseType: DatabaseFactory.getDatabaseType().toUpperCase()
    });

    // Initialize unified broker system with explicit control
    logger.info('Initializing unified broker system', {
      component: 'SERVER_STARTUP',
      operation: 'UNIFIED_BROKER_INIT'
    });
    const registry = initializeUnifiedBroker();

    // Initialize broker plugins explicitly with the same registry instance
    logger.info('Initializing broker plugins', {
      component: 'SERVER_STARTUP',
      operation: 'BROKER_PLUGINS_INIT'
    });

    // Import and register plugins manually to ensure same registry
    const { ShoonyaServiceAdapter } = require('@copytrade/broker-shoonya');
    const { FyersServiceAdapter } = require('@copytrade/broker-fyers');

    try {
      // Register Shoonya plugin directly
      const shoonyaPlugin = {
        name: 'shoonya',
        version: '1.0.0',
        createInstance: () => new ShoonyaServiceAdapter()
      };
      registry.registerPlugin(shoonyaPlugin);
      logger.info('Shoonya broker plugin registered directly', {
        component: 'SERVER_STARTUP',
        operation: 'REGISTER_SHOONYA_PLUGIN'
      });
    } catch (error) {
      logger.error('Failed to register Shoonya broker', {
        component: 'SERVER_STARTUP',
        operation: 'REGISTER_SHOONYA_PLUGIN_ERROR'
      }, error);
    }

    try {
      // Register Fyers plugin directly
      const fyersPlugin = {
        name: 'fyers',
        version: '1.0.0',
        createInstance: () => new FyersServiceAdapter()
      };
      registry.registerPlugin(fyersPlugin);
      logger.info('Fyers broker plugin registered directly', {
        component: 'SERVER_STARTUP',
        operation: 'REGISTER_FYERS_PLUGIN'
      });
    } catch (error) {
      logger.error('Failed to register Fyers broker', {
        component: 'SERVER_STARTUP',
        operation: 'REGISTER_FYERS_PLUGIN_ERROR'
      }, error);
    }

    // Final status check
    const availableBrokers = registry.getAvailableBrokers();
    logger.info('Unified broker system ready', {
      component: 'SERVER_STARTUP',
      operation: 'UNIFIED_BROKER_READY',
      brokerCount: availableBrokers.length,
      availableBrokers
    });

    // Initialize broker account cache
    await initializeBrokerAccountCache();

    // Start order status monitoring
    orderStatusService.startMonitoring().catch((error: any) => {
      logger.error('Failed to start order status monitoring', {
        component: 'SERVER_STARTUP',
        operation: 'ORDER_STATUS_MONITORING_ERROR'
      }, error);
    });

    // Start production monitoring service
    logger.info('Starting production monitoring service', {
      component: 'SERVER_STARTUP',
      operation: 'PRODUCTION_MONITORING_START'
    });
    productionMonitoringService.start();
    logger.info('Production monitoring service started', {
      component: 'SERVER_STARTUP',
      operation: 'PRODUCTION_MONITORING_STARTED'
    });

    // Start server with error handling - bind to 0.0.0.0 for EC2 access
    server.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: ${DatabaseFactory.getDatabaseType().toUpperCase()}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔄 Socket.IO enabled for real-time updates`);
      console.log(`📊 Order status monitoring active`);
      console.log(`📈 NSE & BSE CSV Databases initialized with daily auto-updates`);
      console.log(`⚡ Real-time price streaming active`);
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error('Port is already in use', {
          component: 'SERVER_STARTUP',
          operation: 'SERVER_ERROR',
          port: PORT,
          errorCode: error.code
        }, error);
        process.exit(1);
      } else {
        logger.error('Server error occurred', {
          component: 'SERVER_STARTUP',
          operation: 'SERVER_ERROR'
        }, error);
        process.exit(1);
      }
    });

  } catch (error) {
    logger.error('Failed to start server', {
      component: 'SERVER_STARTUP',
      operation: 'STARTUP_ERROR'
    }, error);
    process.exit(1);
  }
}

// Helper function to check if port is in use
async function checkPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`lsof -ti:${port}`, (error: any, stdout: string) => {
      resolve(!!stdout.trim());
    });
  });
}

// Helper function to kill existing processes
async function killExistingProcesses(): Promise<void> {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec(`pkill -f 'node.*index' || pkill -f 'ts-node.*index' || pkill -f 'nodemon' || true`, () => {
      resolve();
    });
  });
}

// Start the server
startServer();

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info('Graceful shutdown initiated', {
    component: 'SERVER_SHUTDOWN',
    operation: 'GRACEFUL_SHUTDOWN',
    signal
  });

  try {
    // Stop services
    websocketService.shutdown();
    orderStatusService.stopMonitoring();
    productionMonitoringService.stop();

    // Close database connection
    await DatabaseFactory.closeConnection();

    // Close server
    server.close(() => {
      logger.info('Server closed successfully', {
        component: 'SERVER_SHUTDOWN',
        operation: 'SERVER_CLOSED'
      });
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during shutdown', {
      component: 'SERVER_SHUTDOWN',
      operation: 'SHUTDOWN_ERROR'
    }, error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
