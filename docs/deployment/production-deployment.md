# Production Deployment Guide

This guide covers the deployment of the standardized symbol management system to production environments.

## Prerequisites

### System Requirements
- Node.js 18+ 
- MongoDB 4.4+
- PM2 (for process management)
- Nginx (recommended for reverse proxy)
- SSL certificate (for HTTPS)

### Environment Setup
- Production server with adequate resources (minimum 2GB RAM, 2 CPU cores)
- MongoDB instance (local or cloud-based like MongoDB Atlas)
- Domain name configured with DNS
- SSL certificate installed

## Deployment Steps

### 1. Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install MongoDB (if using local instance)
wget -qO - https://www.mongodb.org/static/pgp/server-4.4.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/4.4 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-4.4.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 2. Application Deployment

```bash
# Clone the repository
git clone <your-repository-url>
cd copytrade-pro

# Install dependencies
npm run install:all

# Create production environment configuration
cd backend
npm run env:create production

# Edit the production environment file
nano .env.production
```

### 3. Environment Configuration

Edit the `.env.production` file with your production values:

```bash
# Required configurations to update:
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-domain.com
JWT_SECRET=your-actual-jwt-secret-32-chars-minimum
MONGODB_URI=mongodb://localhost:27017/copytrade_prod
ENCRYPTION_KEY=your-actual-32-character-encryption-key

# Update broker API credentials
UPSTOX_API_KEY=your-actual-upstox-api-key
UPSTOX_API_SECRET=your-actual-upstox-api-secret
FYERS_CLIENT_ID=your-actual-fyers-client-id
FYERS_SECRET_KEY=your-actual-fyers-secret-key

# Configure monitoring
ALERTING_ENABLED=true
ALERT_WEBHOOK_URL=https://your-monitoring-webhook.com
```

### 4. Database Setup

```bash
# Create database schema
npm run db:schema

# Initialize symbol database
npm run db:init

# Verify database setup
npm run health-check:deployment
```

### 5. Build and Deploy

```bash
# Build the application
npm run build

# Deploy symbol service specifically
npm run deploy:symbol-service

# Or use the full deployment script
npm run deploy
```

### 6. Process Management with PM2

```bash
# Start the application with PM2
npm run pm2:start

# Check status
pm2 status

# View logs
pm2 logs copytrade-pro

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME
```

### 7. Nginx Configuration (Optional but Recommended)

Create `/etc/nginx/sites-available/copytrade-pro`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/copytrade-pro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Post-Deployment Verification

### 1. Health Checks

```bash
# Run comprehensive health check
npm run health-check:deployment

# Check specific endpoints
curl https://your-domain.com/health
curl https://your-domain.com/api/health
curl https://your-domain.com/api/symbols/health
```

### 2. Validate Deployment

```bash
# Run deployment validation
npm run validate:deployment

# Check symbol data
curl "https://your-domain.com/api/symbols/search?query=NIFTY"
curl "https://your-domain.com/api/symbols/statistics"
```

### 3. Monitor Performance

```bash
# Check PM2 status
pm2 status
pm2 monit

# View application logs
pm2 logs copytrade-pro --lines 100

# Check system resources
htop
df -h
```

## Monitoring and Maintenance

### Log Management

Logs are stored in `backend/logs/`:
- `combined.log` - All application logs
- `error.log` - Error logs only
- `symbol.log` - Symbol operation logs
- `performance.log` - Performance metrics
- `security.log` - Security events
- `request.log` - HTTP request logs

### Automated Monitoring

The application includes built-in monitoring that:
- Tracks response times and error rates
- Monitors memory usage and performance
- Alerts on symbol update failures
- Logs security events

Configure webhook alerts in your environment:
```bash
ALERTING_ENABLED=true
ALERT_WEBHOOK_URL=https://your-monitoring-service.com/webhook
```

### Database Maintenance

```bash
# Create database backup
mongodump --uri="mongodb://localhost:27017/copytrade_prod" --out=/backup/$(date +%Y%m%d)

# Monitor database performance
mongo copytrade_prod --eval "db.stats()"
mongo copytrade_prod --eval "db.standardizedsymbols.stats()"
```

### Symbol Data Updates

The system automatically updates symbol data daily. Monitor the process:

```bash
# Check symbol processing logs
tail -f backend/logs/symbol.log

# Manually trigger symbol update if needed
curl -X POST https://your-domain.com/api/symbols/update \
  -H "Authorization: Bearer your-admin-token"
```

## Troubleshooting

### Common Issues

1. **Application won't start**
   - Check environment configuration: `npm run env:validate`
   - Verify database connection: `npm run health-check:deployment`
   - Check logs: `pm2 logs copytrade-pro`

2. **Symbol data not loading**
   - Check symbol database: `npm run db:init`
   - Verify Upstox API credentials
   - Check symbol processing logs

3. **High memory usage**
   - Monitor with: `pm2 monit`
   - Adjust cache settings in environment
   - Consider enabling clustering

4. **Database connection issues**
   - Verify MongoDB is running: `sudo systemctl status mongod`
   - Check connection string in environment
   - Review database logs: `sudo journalctl -u mongod`

### Performance Optimization

1. **Enable clustering** (for high-traffic deployments):
   ```bash
   ENABLE_CLUSTERING=true
   WORKER_COUNT=4
   ```

2. **Optimize caching**:
   ```bash
   ENABLE_CACHING=true
   CACHE_SIZE=2000
   API_RESPONSE_CACHING=true
   ```

3. **Database optimization**:
   ```bash
   MONGO_MAX_POOL_SIZE=100
   SYMBOL_BATCH_SIZE=2000
   ```

## Security Considerations

1. **Environment Variables**: Never commit production environment files to version control
2. **Database Security**: Use MongoDB authentication and SSL in production
3. **API Security**: Implement proper authentication and rate limiting
4. **SSL/TLS**: Always use HTTPS in production
5. **Firewall**: Configure firewall to only allow necessary ports
6. **Updates**: Keep dependencies and system packages updated

## Backup and Recovery

### Automated Backups

Set up automated backups using cron:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /usr/bin/mongodump --uri="mongodb://localhost:27017/copytrade_prod" --out=/backup/$(date +\%Y\%m\%d) && find /backup -type d -mtime +7 -exec rm -rf {} \;
```

### Recovery Process

1. **Application Recovery**:
   ```bash
   # Rollback to previous version
   npm run rollback
   
   # Or redeploy from backup
   git checkout <previous-commit>
   npm run deploy
   ```

2. **Database Recovery**:
   ```bash
   # Restore from backup
   mongorestore --uri="mongodb://localhost:27017/copytrade_prod" /backup/20240131/copytrade_prod/
   ```

## Support and Maintenance

- Monitor application logs regularly
- Set up automated alerts for critical issues
- Perform regular security updates
- Monitor database performance and optimize as needed
- Review and update environment configuration periodically