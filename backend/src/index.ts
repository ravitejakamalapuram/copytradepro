import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

import authRoutes from './routes/auth';
import brokerRoutes from './routes/broker';
import { errorHandler } from './middleware/errorHandler';
import { validateEnv } from './utils/validateEnv';
import websocketService from './services/websocketService';
import orderStatusService from './services/orderStatusService';

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use(morgan('combined'));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/broker', brokerRoutes);

// Demo endpoint to test real-time order status updates
app.post('/api/demo/update-order-status', (req: express.Request, res: express.Response): void => {
  const { orderId, newStatus } = req.body;

  if (!orderId || !newStatus) {
    res.status(400).json({ error: 'orderId and newStatus are required' });
    return;
  }

  // Note: Demo endpoint only broadcasts, real database updates happen in orderStatusService

  // Simulate order status update
  const updateData = {
    orderId: orderId,
    oldStatus: 'PLACED',
    newStatus: newStatus,
    order: {
      id: orderId,
      symbol: 'TCS',
      action: 'BUY',
      quantity: 1,
      price: 0,
      status: newStatus,
      broker_name: 'shoonya',
      executed_at: newStatus === 'EXECUTED' ? new Date().toISOString() : null
    },
    timestamp: new Date().toISOString()
  };

  // Broadcast to all connected clients
  websocketService.broadcastOrderStatusChange(updateData);

  console.log(`🎯 DEMO: Manually triggered order status update: ${orderId} → ${newStatus}`);

  res.json({
    success: true,
    message: `Order ${orderId} status updated to ${newStatus}`,
    data: updateData
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Global error handler
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Initialize Socket.IO
websocketService.initialize(server);

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
