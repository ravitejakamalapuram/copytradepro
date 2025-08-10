# PM2 Usage Guide for CopyTrade Pro

## Overview

PM2 is a production process manager for Node.js applications. It provides features like process monitoring, automatic restarts, load balancing, and log management.

## Installation

### Install PM2 Globally

```bash
npm install -g pm2
# or
yarn global add pm2
```

## Quick Start Commands

### Using NPM Scripts (Recommended)

```bash
# Start in production mode
npm run pm2:start

# Start in development mode
npm run pm2:dev

# Stop the application
npm run pm2:stop

# Restart the application
npm run pm2:restart

# Reload (zero-downtime restart)
npm run pm2:reload

# View logs
npm run pm2:logs

# Check status
npm run pm2:status

# Monitor in real-time
npm run pm2:monit

# Delete from PM2
npm run pm2:delete
```

### Direct PM2 Commands

```bash
# Start with ecosystem config
pm2 start ecosystem.config.js --env production

# Start with different environments
pm2 start ecosystem.config.js --env development
pm2 start ecosystem.config.js --env staging
pm2 start ecosystem.config.js --env production

# Basic process management
pm2 stop copytrade-pro
pm2 restart copytrade-pro
pm2 reload copytrade-pro
pm2 delete copytrade-pro

# View information
pm2 list                    # List all processes
pm2 show copytrade-pro     # Detailed info about the app
pm2 logs copytrade-pro     # View logs
pm2 logs --lines 100       # View last 100 log lines
pm2 flush                  # Clear all logs

# Monitoring
pm2 monit                  # Real-time monitoring dashboard
pm2 status                 # Process status
```

## Environment Configurations

Your ecosystem.config.js supports multiple environments:

### Development

```bash
pm2 start ecosystem.config.js --env development
# Uses: NODE_ENV=development, PORT=3001
```

### Staging

```bash
pm2 start ecosystem.config.js --env staging
# Uses: NODE_ENV=staging, PORT=3002
```

### Production

```bash
pm2 start ecosystem.config.js --env production
# Uses: NODE_ENV=production, PORT=3001
```

## Key Features Configured

### 🔄 Auto-Restart

- **Max Restarts**: 10 attempts before giving up
- **Min Uptime**: 10 seconds before considering stable
- **Restart Delay**: 4 seconds between restart attempts
- **Memory Limit**: Restarts if memory exceeds 500MB

### 📝 Logging

- **Combined Logs**: `./logs/combined.log`
- **Output Logs**: `./logs/out.log`
- **Error Logs**: `./logs/error.log`
- **Log Format**: Timestamped with timezone

### 🏥 Health Monitoring

- **Health Check**: HTTP endpoint at `/health`
- **Grace Period**: 3 seconds for health check response
- **Memory Monitoring**: Node.js max old space size set to 512MB

### ⚡ Performance

- **Single Instance**: Fork mode (not cluster)
- **Source Maps**: Enabled for better error tracking
- **Graceful Shutdown**: Proper cleanup on process termination

## Production Deployment Workflow

### 1. Build and Deploy

```bash
# Complete build and start
npm run pm2:start

# Or step by step
npm run build
pm2 start ecosystem.config.js --env production
```

### 2. Zero-Downtime Updates

```bash
# Build new version
npm run build

# Reload without downtime
npm run pm2:reload
```

### 3. Monitor and Maintain

```bash
# Check status
npm run pm2:status

# View logs
npm run pm2:logs

# Real-time monitoring
npm run pm2:monit
```

## Advanced PM2 Features

### Process Persistence

```bash
# Save current PM2 processes
pm2 save

# Auto-resurrect processes on system restart
pm2 startup
# Follow the instructions provided by the command

# Restore saved processes
pm2 resurrect
```

### Log Management

```bash
# Rotate logs (install pm2-logrotate)
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

### Cluster Mode (Optional)

To use cluster mode for better performance:

```javascript
// In ecosystem.config.js
instances: 'max',        // Use all CPU cores
exec_mode: 'cluster'     // Enable cluster mode
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Kill processes on port 3001
npm run kill-port

# Or manually
lsof -ti:3001 | xargs kill -9
```

#### 2. Application Won't Start

```bash
# Check logs for errors
pm2 logs copytrade-pro --lines 50

# Check if build is complete
ls -la backend/dist/

# Verify environment files
ls -la backend/dist/.env*
```

#### 3. Memory Issues

```bash
# Monitor memory usage
pm2 monit

# Check if memory limit is appropriate
# Adjust max_memory_restart in ecosystem.config.js
```

#### 4. Health Check Failures

```bash
# Test health endpoint manually
curl http://localhost:3001/health

# Check if backend is properly built
node backend/dist/index.js
```

### Log Analysis

```bash
# View real-time logs
pm2 logs copytrade-pro --lines 0

# Search logs for errors
pm2 logs copytrade-pro | grep -i error

# View specific log files
tail -f logs/error.log
tail -f logs/out.log
```

## Best Practices

### 1. Always Build Before Starting

```bash
npm run build && pm2 start ecosystem.config.js --env production
```

### 2. Use Environment-Specific Configs

- Development: Lower memory limits, more verbose logging
- Production: Higher memory limits, error-only logging

### 3. Monitor Regularly

```bash
# Set up monitoring dashboard
pm2 monit

# Check status periodically
pm2 status
```

### 4. Log Rotation

Install and configure pm2-logrotate to prevent log files from growing too large.

### 5. Process Persistence

Always save your PM2 configuration and set up startup scripts for production servers.

## Integration with CI/CD

### Example Deployment Script

```bash
#!/bin/bash
# deploy.sh

echo "🚀 Deploying CopyTrade Pro..."

# Build the application
npm run build

# Stop existing process (if running)
pm2 stop copytrade-pro 2>/dev/null || true

# Start with production config
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

echo "✅ Deployment complete!"
```

This guide covers all the essential aspects of using PM2 with your CopyTrade Pro application. The ecosystem.config.js file is now optimized for production use with proper logging, monitoring, and restart policies.
