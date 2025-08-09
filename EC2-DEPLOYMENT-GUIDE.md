# CopyTrade Pro - EC2 Deployment Guide

## 🚀 Quick Deployment

### Step 1: Deploy to EC2
```bash
# Build and deploy manually
npm run build
npm start
```

### Step 2: Configure EC2 Security Group
1. Go to AWS EC2 Console → Security Groups
2. Select your instance's security group
3. Add inbound rule:
   - **Type**: Custom TCP
   - **Port**: 3001
   - **Source**: 0.0.0.0/0 (or your specific IP range)

### Step 3: Access Your Application
- **Application URL**: `http://YOUR_EC2_PUBLIC_IP:3001`
- **Health Check**: `http://YOUR_EC2_PUBLIC_IP:3001/health`

---

## 🔧 Manual Deployment Steps

### 1. Server Configuration Fix
The server now binds to `0.0.0.0:3001` instead of `localhost:3001` for internet access.

### 2. Environment Setup
```bash
# Copy production environment template
cp backend/.env.production backend/.env

# Update with your EC2 public IP
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
sed -i "s/YOUR_EC2_PUBLIC_IP/$EC2_IP/g" backend/.env
```

### 3. Build and Start
```bash
# Install dependencies
npm install

# Build application
npm run build

# Start server
npm start
```

---

## 🔒 Security Configuration

### EC2 Security Group Rules
| Type | Protocol | Port | Source | Description |
|------|----------|------|--------|-------------|
| HTTP | TCP | 3001 | 0.0.0.0/0 | Application access |
| SSH | TCP | 22 | Your IP | SSH access |

### Environment Variables to Update
```bash
# In backend/.env
JWT_SECRET=your-super-secure-jwt-secret-key-here-minimum-32-characters
ENCRYPTION_KEY=your-32-character-encryption-key-here
SHOONYA_VENDOR_CODE=your-actual-vendor-code
SHOONYA_API_KEY=your-actual-api-key
FYERS_CLIENT_ID=your-actual-client-id
FYERS_SECRET_KEY=your-actual-secret-key
```

---

## 🚀 Production Deployment with PM2

### Install PM2
```bash
npm install -g pm2
```

### Start with PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### PM2 Commands
```bash
pm2 status          # Check status
pm2 logs            # View logs
pm2 restart all     # Restart application
pm2 stop all        # Stop application
pm2 delete all      # Delete application
```

---

## 🔍 Troubleshooting

### Common Issues

#### 1. **Cannot access from internet**
- ✅ Check EC2 Security Group allows port 3001
- ✅ Verify server binds to 0.0.0.0 (not localhost)
- ✅ Check EC2 instance has public IP
- ✅ Verify no firewall blocking the port

#### 2. **Server won't start**
```bash
# Check if port is in use
sudo lsof -i :3001

# Kill existing processes
sudo pkill -f "node.*index"

# Check logs
tail -f backend/*.log
```

#### 3. **Database issues**
```bash
# Create data directory
mkdir -p backend/data

# Check permissions
ls -la backend/data/
```

#### 4. **Environment issues**
```bash
# Verify environment file
cat backend/.env

# Check required variables
node -e "require('dotenv').config({path:'backend/.env'}); console.log('PORT:', process.env.PORT)"
```

### Health Check Commands
```bash
# Local health check
curl http://localhost:3001/health

# External health check (replace with your IP)
curl http://YOUR_EC2_PUBLIC_IP:3001/health

# Check if server is listening
sudo netstat -tlnp | grep :3001
```

---

## 🌐 Domain Setup (Optional)

### Using Custom Domain
1. Point your domain to EC2 public IP
2. Update environment variables:
```bash
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com
```

### SSL Certificate (Recommended)
```bash
# Install Certbot
sudo apt install certbot

# Get certificate (requires domain)
sudo certbot certonly --standalone -d yourdomain.com
```

---

## 📊 Monitoring

### Application Logs
```bash
# PM2 logs
pm2 logs

# Application logs
tail -f backend/*.log

# System logs
sudo journalctl -u your-service-name -f
```

### Performance Monitoring
- Health endpoint: `/health`
- Monitoring endpoint: `/api/monitoring`
- Real-time WebSocket connections

---

## 🔄 Updates and Maintenance

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild
npm run build

# Restart with PM2
pm2 restart copytrade-pro
```

### Backup Database
```bash
# Backup MongoDB database
mongodump --uri="$MONGODB_URI" --out=backup-$(date +%Y%m%d_%H%M%S)
```

---

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify all environment variables are set
3. Check EC2 security group configuration
4. Review application logs for errors

**Application should be accessible at**: `http://YOUR_EC2_PUBLIC_IP:3001`