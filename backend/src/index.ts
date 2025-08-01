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
import optionsRoutes from './routes/options';
import symbolsRoutes from './routes/symbols';
import symbolLifecycleRoutes from './routes/symbolLifecycleRoutes';
import symbolInitializationRoutes from './routes/symbolInitialization';
import symbolHealthRoutes from './routes/symbolHealth';
import notificationRoutes from './routes/notifications';
import startupRoutes from './routes/startup';
import { errorHandler } from './middleware/errorHandler';
import { loggingMiddleware, errorLoggingMiddleware } from './middleware/loggingMiddleware';
import { performanceMonitoring, requestIdMiddleware } from './middleware/performanceMonitoring';
import { validateEnv } from './utils/validateEnv';
import { logger } from './utils/logger';
import websocketService from './services/websocketService';
import orderStatusService from './services/orderStatusService';
import { realTimeDataService } from './services/realTimeDataService';
import { optionsDataService } from './services/optionsDataService';
// Auto-initialize services on import
import './services/symbolDatabaseService';
import { getDatabase, DatabaseFactory } from './services/databaseFactory';
import { initializeBrokerAccountCache } from './controllers/brokerController';
import { productionMonitoringService } from './services/productionMonitoringService';
import { symbolLifecycleManager } from './services/symbolLifecycleManager';
import { startupSymbolInitializationService } from './services/startupSymbolInitializationService';
import { symbolMonitoringService } from './services/symbolMonitoringService';
// Removed unused import: symbolAlertingService
import { notificationService } from './services/notificationService';
import { startupStatusService } from './services/startupStatusService';
import { startupMonitoringService } from './services/startupMonitoringService';
import { requireSymbolData, requireServerReady, addStartupStatusHeaders } from './middleware/symbolDataReadyMiddleware';

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
const isDevelopment = process.env.NODE_ENV !== 'production';

let corsOptions;

if (isDevelopment) {
  // In development, be more permissive with CORS
  corsOptions = {
    origin: true, // Allow all origins in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  };
  
  logger.info('CORS configured for development - allowing all origins', {
    component: 'SERVER_STARTUP',
    operation: 'CORS_CONFIG',
    mode: 'development'
  });
} else {
  // In production, use strict CORS
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        `http://localhost:${PORT}`,
        `http://127.0.0.1:${PORT}`,
      ];

  corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        logger.warn('CORS blocked request from unauthorized origin', {
          component: 'CORS',
          operation: 'ORIGIN_BLOCKED',
          origin,
          allowedOrigins
        });
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  };
  
  logger.info('CORS configured for production', {
    component: 'SERVER_STARTUP',
    operation: 'CORS_CONFIG',
    mode: 'production',
    allowedOrigins
  });
}

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests for all routes
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  
  if (isDevelopment) {
    logger.debug('Handling OPTIONS preflight request', {
      component: 'CORS',
      operation: 'PREFLIGHT',
      origin,
      method: req.method,
      url: req.url,
      headers: req.headers
    });
  }
  
  res.header('Access-Control-Allow-Origin', origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Request-ID');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Add CORS debugging middleware for development
if (isDevelopment) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (req.method !== 'OPTIONS') {
      logger.debug('Processing request with CORS headers', {
        component: 'CORS',
        operation: 'REQUEST',
        method: req.method,
        url: req.url,
        origin,
        userAgent: req.headers['user-agent']
      });
    }
    next();
  });
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use(requestIdMiddleware);

// Performance monitoring middleware
app.use(performanceMonitoring);

// Enhanced logging middleware
app.use(loggingMiddleware);

// Add startup status headers for debugging
app.use(addStartupStatusHeaders);

// Morgan logging middleware (keep for compatibility)
const logFormat = process.env.NODE_ENV === 'production' ? 'combined' : 'dev';
if (process.env.ENABLE_REQUEST_LOGGING !== 'false') {
  app.use(morgan(logFormat));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  try {
    const startupStatus = startupStatusService.getStatus();
    const isHealthy = startupStatus.serverReady && startupStatus.startupPhase !== 'FAILED';
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'OK' : 'STARTING',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      startup: {
        phase: startupStatus.startupPhase,
        serverReady: startupStatus.serverReady,
        symbolDataReady: startupStatus.symbolDataReady,
        fullyReady: startupStatusService.isFullyReady()
      },
      services: {
        database: 'MongoDB',
        websocket: 'Socket.IO',
        orderMonitoring: 'Active',
        symbolData: startupStatus.symbolDataReady ? 'Ready' : 'Initializing'
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
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
    const startupStatus = startupStatusService.getStatus();
    const isHealthy = startupStatus.serverReady && startupStatus.startupPhase !== 'FAILED';
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'OK' : 'STARTING',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      startup: {
        phase: startupStatus.startupPhase,
        serverReady: startupStatus.serverReady,
        symbolDataReady: startupStatus.symbolDataReady,
        fullyReady: startupStatusService.isFullyReady(),
        symbolInitProgress: startupStatus.symbolInitStatus?.progress || 0,
        currentStep: startupStatus.symbolInitStatus?.currentStep || 'Unknown'
      },
      services: {
        database: 'MongoDB',
        websocket: 'Socket.IO',
        orderMonitoring: 'Active',
        symbolData: startupStatus.symbolDataReady ? 'Ready' : 'Initializing'
      }
    });
  } catch (error) {
    console.error('API health check error:', error);
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Startup status endpoint
app.get('/api/startup-status', (_req, res) => {
  try {
    const status = startupStatusService.getStatus();
    const metrics = startupStatusService.getStartupMetrics();
    
    res.status(200).json({
      success: true,
      status,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Startup status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get startup status',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes with startup status middleware
app.use('/api/auth', requireServerReady, authRoutes);
app.use('/api/broker', requireServerReady, brokerRoutes);
app.use('/api/portfolio', requireSymbolData, portfolioRoutes);
app.use('/api/advanced-orders', requireSymbolData, advancedOrdersRoutes);
app.use('/api/market-data', requireSymbolData, marketDataRoutes);
app.use('/api/logs', requireServerReady, logsRoutes);
app.use('/api/monitoring', requireServerReady, monitoringRoutes);
app.use('/api/options', requireSymbolData, optionsRoutes);
app.use('/api/symbols', requireSymbolData, symbolsRoutes);
app.use('/api/symbol-lifecycle', requireSymbolData, symbolLifecycleRoutes);
app.use('/api/symbol-initialization', requireServerReady, symbolInitializationRoutes);
app.use('/api/symbol-health', requireServerReady, symbolHealthRoutes);
app.use('/api/notifications', requireServerReady, notificationRoutes);
app.use('/api/startup', requireServerReady, startupRoutes);



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
        console.error('Error serving index.html:', err);
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

    // Initialize options data service
    logger.info('Initializing options data service', {
      component: 'SERVER_STARTUP',
      operation: 'OPTIONS_SERVICE_INIT'
    });
    await optionsDataService.initialize();
    logger.info('Options data service initialized', {
      component: 'SERVER_STARTUP',
      operation: 'OPTIONS_SERVICE_INIT_SUCCESS'
    });

    // Initialize symbol lifecycle manager
    logger.info('Initializing symbol lifecycle manager', {
      component: 'SERVER_STARTUP',
      operation: 'SYMBOL_LIFECYCLE_INIT'
    });
    await symbolLifecycleManager.initialize();
    logger.info('Symbol lifecycle manager initialized', {
      component: 'SERVER_STARTUP',
      operation: 'SYMBOL_LIFECYCLE_INIT_SUCCESS'
    });

    // Start server first, then initialize symbol data in background
    // This allows the server to be responsive while symbol data loads
    server.listen(Number(PORT), '0.0.0.0', async () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: ${DatabaseFactory.getDatabaseType().toUpperCase()}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      console.log(`🔄 Socket.IO enabled for real-time updates`);
      console.log(`📊 Order status monitoring active`);
      console.log(`⚡ Real-time price streaming active`);

      // Start startup monitoring
      startupMonitoringService.startMonitoring();
      
      // Mark server as ready
      startupStatusService.markServerReady();
      
      // Start monitoring startup status
      startupStatusService.startMonitoring();

      // Start monitoring services
      logger.info('Starting monitoring services', {
        component: 'SERVER_STARTUP',
        operation: 'MONITORING_INIT'
      });
      
      productionMonitoringService.start();
      symbolMonitoringService.start();
      
      // Initialize notification service
      await notificationService.initialize();
      
      console.log(`📊 Symbol monitoring active`);
      console.log(`🚨 Alert system active`);
      console.log(`📧 Notification system active`);
      console.log(`📈 Starting symbol data initialization in background...`);

      // Mark symbol initialization as started
      startupStatusService.markSymbolInitStarted();

      // Initialize symbol data in background after server starts
      startupSymbolInitializationService.initializeSymbolData()
        .then(() => {
          console.log(`✅ Symbol data initialization completed successfully`);
          startupStatusService.markSymbolInitCompleted();
        })
        .catch((error: any) => {
          console.error(`❌ Symbol data initialization failed: ${error.message}`);
          logger.error('Symbol data initialization failed during startup', {
            component: 'SERVER_STARTUP',
            operation: 'SYMBOL_INIT_BACKGROUND_ERROR'
          }, error);
          startupStatusService.markStartupFailed(error.message);
          // Don't exit the server - it can still function with cached data or manual initialization
        });
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
    exec(`pkill -f 'node.*index' || pkill -f 'ts-node.*index' || pkill -f 'nodemon' || true`, (_error: any) => {
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
