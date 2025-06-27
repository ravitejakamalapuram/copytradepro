# CopyTrade Pro - Production Deployment Guide

## 🏗️ Architecture Overview

CopyTrade Pro uses a **unified deployment architecture** where:
- **Frontend**: React + TypeScript + Vite (builds to static files)
- **Backend**: Node.js + Express + TypeScript (serves API + static files)
- **Database**: SQLite (file-based, persistent storage)
- **Real-time**: Socket.IO for live order updates
- **Deployment**: Single Render.com web service (full-stack)

## 🚀 Render.com Deployment

### Prerequisites

1. GitHub repository with the code
2. Render.com account
3. Environment variables configured

### Deployment Configuration

The application uses a **single web service** that:

1. Builds both frontend and backend
2. Serves frontend static files through Node.js
3. Provides API endpoints
4. Handles client-side routing (SPA)

### Build Process

The deployment follows this build sequence:

```bash
# 1. Install backend dependencies (production only)
cd backend && npm ci --only=production

# 2. Install frontend dependencies and build
cd ../frontend && npm ci && npm run build

# 3. Copy frontend build to backend public directory
cd ../backend && mkdir -p public && cp -r ../frontend/dist/* public/

# 4. Build backend TypeScript
npm run build
```

### File Structure After Build

```
backend/
├── dist/           # Compiled TypeScript backend
├── public/         # Frontend static files (from frontend/dist)
├── data/           # SQLite database directory
└── node_modules/   # Backend dependencies only
```

## 🔧 Environment Variables

#### Backend Environment Variables (Required)
```bash
NODE_ENV=production
PORT=3001
JWT_SECRET=your-super-secure-jwt-secret-key-here-minimum-32-characters
ENCRYPTION_KEY=your-32-character-encryption-key-here
FRONTEND_URL=https://your-frontend-domain.onrender.com
ALLOWED_ORIGINS=https://your-frontend-domain.onrender.com
DATABASE_PATH=/opt/render/project/src/data/trading.db
LOG_LEVEL=info
ENABLE_REQUEST_LOGGING=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Frontend Environment Variables
```bash
VITE_API_URL=https://your-backend-domain.onrender.com/api
VITE_APP_NAME=CopyTrade Pro
VITE_APP_VERSION=1.0.0
VITE_NODE_ENV=production
VITE_ENABLE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
```

### 2. Deploy Using render.yaml (Recommended)

1. Push your code to GitHub
2. Connect your GitHub repository to Render.com
3. Render will automatically detect the `render.yaml` file
4. Review and deploy both services

### 3. Manual Deployment (Alternative)

#### Backend Service
1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Start Command**: `cd backend && npm start`
   - **Environment**: Node
   - **Plan**: Starter or higher
   - **Health Check Path**: `/health`

#### Frontend Service
1. Create a new Static Site on Render.com
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`
   - **Environment**: Static Site

### 4. Post-Deployment Configuration

#### Update Frontend API URL
After backend deployment, update the frontend environment variable:
```bash
VITE_API_URL=https://your-actual-backend-url.onrender.com/api
```

#### Update Backend CORS
After frontend deployment, update the backend environment variables:
```bash
FRONTEND_URL=https://your-actual-frontend-url.onrender.com
ALLOWED_ORIGINS=https://your-actual-frontend-url.onrender.com
```

### 5. Verification

#### Backend Health Check
Visit: `https://your-backend-url.onrender.com/health`

Expected response:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456,
  "environment": "production",
  "version": "1.0.0",
  "services": {
    "database": "SQLite",
    "websocket": "Socket.IO",
    "orderMonitoring": "Active"
  }
}
```

#### Frontend Access
Visit: `https://your-frontend-url.onrender.com`

## Environment Variables Reference

### Required Backend Variables
- `NODE_ENV`: Set to "production"
- `JWT_SECRET`: Secure random string (min 32 chars)
- `ENCRYPTION_KEY`: 32-character encryption key for database

### Optional Backend Variables
- `PORT`: Server port (default: 3001)
- `DATABASE_PATH`: SQLite database file path
- `LOG_LEVEL`: Logging level (info, debug, warn, error)
- `RATE_LIMIT_WINDOW_MS`: Rate limiting window
- `RATE_LIMIT_MAX_REQUESTS`: Max requests per window

### Broker API Variables (Optional)
```bash
# Shoonya Broker
SHOONYA_VENDOR_CODE=your-vendor-code
SHOONYA_IMEI=your-imei
SHOONYA_API_KEY=your-api-key
SHOONYA_AUTH_TOKEN=your-auth-token

# Fyers Broker
FYERS_CLIENT_ID=your-client-id
FYERS_SECRET_KEY=your-secret-key
FYERS_REDIRECT_URI=https://your-backend-domain.onrender.com/api/broker/fyers/callback
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are in package.json
   - Check TypeScript compilation errors

2. **Database Issues**
   - Ensure data directory has write permissions
   - Check DATABASE_PATH environment variable
   - Verify SQLite file creation

3. **CORS Errors**
   - Verify FRONTEND_URL and ALLOWED_ORIGINS
   - Check frontend VITE_API_URL configuration
   - Ensure both services are deployed

4. **WebSocket Connection Issues**
   - Check if Render.com supports WebSocket connections
   - Verify Socket.IO configuration
   - Check browser console for connection errors

### Logs and Monitoring

- Backend logs: Available in Render.com dashboard
- Health check: Monitor `/health` endpoint
- Database: SQLite file persists across deployments

## Security Considerations

1. **Environment Variables**: Never commit secrets to Git
2. **JWT Secret**: Use a strong, random secret key
3. **Database Encryption**: Use a secure encryption key
4. **CORS**: Restrict to specific domains only
5. **Rate Limiting**: Configure appropriate limits

## Performance Optimization

1. **Database**: SQLite is suitable for small to medium loads
2. **Caching**: Consider adding Redis for session storage
3. **CDN**: Use Render.com's CDN for static assets
4. **Monitoring**: Set up health checks and alerts

## Scaling Considerations

- **Database**: Consider PostgreSQL for higher loads
- **File Storage**: Use external storage for large files
- **Load Balancing**: Render.com handles this automatically
- **Caching**: Add Redis for improved performance
