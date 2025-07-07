# 🚀 Plugin Architecture Deployment Guide

**Complete guide for deploying the new plugin-based trading system to production**

## 📋 Overview

This guide covers deploying the plugin-based architecture to various environments including development, staging, and production.

## 🏗️ Architecture Overview

```
Production Environment
├── Core Trading API (@copytradepro/unified-trading-api)
├── Plugin Manager (Built-in)
├── Broker Plugins
│   ├── @copytradepro/broker-shoonya
│   ├── @copytradepro/broker-fyers
│   └── Future plugins...
├── Main Application
├── Database (MongoDB/PostgreSQL)
└── Redis (Optional - for caching)
```

## 🌍 Environment Setup

### **Development Environment**

```bash
# 1. Clone the repository
git clone https://github.com/copytradepro/trading-platform.git
cd trading-platform

# 2. Install core dependencies
npm install

# 3. Install broker plugins
npm install @copytradepro/broker-shoonya
npm install @copytradepro/broker-fyers

# 4. Set up environment variables
cp .env.example .env.development

# 5. Start development server
npm run dev
```

### **Staging Environment**

```bash
# 1. Set up staging environment
export NODE_ENV=staging

# 2. Install production dependencies
npm ci --production

# 3. Build the application
npm run build

# 4. Set up staging database
npm run db:migrate:staging

# 5. Start staging server
npm run start:staging
```

### **Production Environment**

```bash
# 1. Set up production environment
export NODE_ENV=production

# 2. Install production dependencies only
npm ci --production --ignore-scripts

# 3. Build optimized application
npm run build:production

# 4. Run database migrations
npm run db:migrate:production

# 5. Start production server with PM2
pm2 start ecosystem.config.js --env production
```

## 📦 Package Management

### **Core Package Deployment**

```json
{
  "name": "copytrade-platform",
  "version": "2.0.0",
  "dependencies": {
    "@copytradepro/unified-trading-api": "^2.0.0",
    "@copytradepro/broker-shoonya": "^1.0.0",
    "@copytradepro/broker-fyers": "^1.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

### **Plugin Version Management**

```bash
# Check plugin versions
npm list @copytradepro/broker-shoonya
npm list @copytradepro/broker-fyers

# Update specific plugin
npm update @copytradepro/broker-shoonya

# Install specific version
npm install @copytradepro/broker-fyers@1.2.0
```

## 🔧 Configuration Management

### **Environment Variables**

```bash
# .env.production
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=mongodb://username:password@host:port/database
REDIS_URL=redis://username:password@host:port

# Core API Configuration
API_TIMEOUT=30000
API_RETRY_ATTEMPTS=3
API_LOG_LEVEL=info

# Plugin Configuration
PLUGIN_AUTO_START=true
PLUGIN_HEALTH_CHECK_INTERVAL=30000

# Broker Credentials (encrypted)
SHOONYA_API_KEY=encrypted_api_key
SHOONYA_VENDOR_CODE=encrypted_vendor_code

FYERS_CLIENT_ID=encrypted_client_id
FYERS_SECRET_KEY=encrypted_secret_key

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Monitoring
SENTRY_DSN=your_sentry_dsn
NEW_RELIC_LICENSE_KEY=your_newrelic_key
```

### **Plugin Configuration**

```typescript
// config/plugins.ts
export const pluginConfigs = {
  shoonya: {
    enabled: process.env.SHOONYA_ENABLED === 'true',
    autoStart: true,
    healthCheckInterval: 30000,
    maxRetries: 3,
    timeout: 30000,
    logLevel: process.env.API_LOG_LEVEL || 'info',
    customSettings: {
      enableOrderValidation: true,
      maxOrderValue: 10000000,
      allowedExchanges: ['NSE', 'BSE', 'NFO', 'BFO']
    }
  },
  fyers: {
    enabled: process.env.FYERS_ENABLED === 'true',
    autoStart: true,
    healthCheckInterval: 30000,
    maxRetries: 3,
    timeout: 30000,
    logLevel: process.env.API_LOG_LEVEL || 'info',
    customSettings: {
      enableTokenRefresh: true,
      maxOrderValue: 5000000,
      allowedExchanges: ['NSE', 'BSE', 'NFO', 'BFO', 'MCX']
    }
  }
};
```

## 🐳 Docker Deployment

### **Dockerfile**

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --production

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start application
CMD ["node", "dist/index.js"]
```

### **Docker Compose**

```yaml
# docker-compose.yml
version: '3.8'

services:
  trading-api:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=mongodb://mongo:27017/trading
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  mongo:
    image: mongo:6.0
    ports:
      - "27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=password
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  mongo_data:
  redis_data:
```

## ☁️ Cloud Deployment

### **AWS ECS Deployment**

```json
{
  "family": "trading-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "trading-api",
      "image": "your-account.dkr.ecr.region.amazonaws.com/trading-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:trading-db-url"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/trading-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### **Kubernetes Deployment**

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trading-api
  labels:
    app: trading-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trading-api
  template:
    metadata:
      labels:
        app: trading-api
    spec:
      containers:
      - name: trading-api
        image: trading-api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: trading-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: trading-api-service
spec:
  selector:
    app: trading-api
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

## 📊 Monitoring & Observability

### **Health Checks**

```typescript
// src/health.ts
import { UnifiedTradingAPI } from '@copytradepro/unified-trading-api';

export class HealthChecker {
  constructor(private api: UnifiedTradingAPI) {}

  async checkHealth() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
      plugins: {},
      database: 'unknown',
      redis: 'unknown'
    };

    try {
      // Check plugins
      const plugins = this.api.getInstalledPlugins();
      for (const plugin of plugins) {
        const status = plugin.getStatus();
        const metadata = plugin.getMetadata();
        health.plugins[metadata.brokerType] = {
          healthy: status.isHealthy,
          version: metadata.version,
          uptime: status.uptime,
          errorCount: status.errorCount
        };
      }

      // Check database connection
      // health.database = await this.checkDatabase();

      // Check Redis connection
      // health.redis = await this.checkRedis();

      return health;
    } catch (error) {
      health.status = 'unhealthy';
      return health;
    }
  }
}
```

### **Metrics Collection**

```typescript
// src/metrics.ts
import { UnifiedTradingAPI } from '@copytradepro/unified-trading-api';

export class MetricsCollector {
  constructor(private api: UnifiedTradingAPI) {}

  collectMetrics() {
    const plugins = this.api.getInstalledPlugins();
    const metrics = {
      timestamp: new Date().toISOString(),
      plugins: {},
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        cpu: process.cpuUsage()
      }
    };

    plugins.forEach(plugin => {
      const pluginMetrics = plugin.getMetrics();
      const metadata = plugin.getMetadata();
      
      metrics.plugins[metadata.brokerType] = {
        requestCount: pluginMetrics.requestCount,
        errorCount: pluginMetrics.errorCount,
        averageResponseTime: pluginMetrics.averageResponseTime,
        uptime: pluginMetrics.uptime
      };
    });

    return metrics;
  }
}
```

## 🔄 CI/CD Pipeline

### **GitHub Actions**

```yaml
# .github/workflows/deploy.yml
name: Deploy Trading Platform

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Run linting
        run: npm run lint
      
      - name: Build application
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: trading-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service \
            --cluster trading-cluster \
            --service trading-api-service \
            --force-new-deployment
```

## 🚨 Rollback Strategy

### **Blue-Green Deployment**

```bash
# Deploy to green environment
kubectl apply -f k8s/deployment-green.yaml

# Test green environment
curl -f http://green.trading-api.com/health

# Switch traffic to green
kubectl patch service trading-api-service -p '{"spec":{"selector":{"version":"green"}}}'

# Monitor for issues
kubectl logs -f deployment/trading-api-green

# Rollback if needed
kubectl patch service trading-api-service -p '{"spec":{"selector":{"version":"blue"}}}'
```

## 📋 Deployment Checklist

### **Pre-Deployment**
- [ ] Run all tests locally
- [ ] Update version numbers
- [ ] Update changelog
- [ ] Review security configurations
- [ ] Backup production database
- [ ] Notify stakeholders

### **Deployment**
- [ ] Deploy to staging first
- [ ] Run smoke tests
- [ ] Check plugin health
- [ ] Verify database migrations
- [ ] Test critical user flows
- [ ] Monitor error rates

### **Post-Deployment**
- [ ] Verify all plugins are healthy
- [ ] Check application metrics
- [ ] Monitor error logs
- [ ] Test trading functionality
- [ ] Update documentation
- [ ] Notify users of new features

---

**Need deployment support?** Contact our DevOps team at devops@copytradepro.com
