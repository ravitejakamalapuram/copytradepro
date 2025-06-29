import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';

import authRoutes from './routes/auth';
import brokerRoutes from './routes/broker';
import portfolioRoutes from './routes/portfolio';
import advancedOrdersRoutes from './routes/advancedOrders';
import marketDataRoutes from './routes/marketData';
import { errorHandler } from './middleware/errorHandler';
import { validateEnv } from './utils/validateEnv';
import websocketService from './services/websocketService';
import orderStatusService from './services/orderStatusService';
import { symbolDatabaseService } from './services/symbolDatabaseService';
import { realTimeDataService } from './services/realTimeDataService';

// Load environment variables
dotenv.config();

// Validate environment variables
validateEnv();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

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
  : [process.env.FRONTEND_URL || 'http://localhost:5173'];

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

// Logging middleware
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
        database: 'SQLite',
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

// Start order status monitoring
orderStatusService.startMonitoring().catch((error: any) => {
  console.error('Failed to start order status monitoring:', error);
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🔄 Socket.IO enabled for real-time updates`);
  console.log(`📊 Order status monitoring active`);
  console.log(`📈 NSE Symbol Database initialized with daily auto-updates`);
  console.log(`⚡ Real-time price streaming active`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  websocketService.shutdown();
  orderStatusService.stopMonitoring();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  websocketService.shutdown();
  orderStatusService.stopMonitoring();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
