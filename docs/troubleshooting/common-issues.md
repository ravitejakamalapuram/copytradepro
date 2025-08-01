# Common Issues and Solutions

This guide covers the most frequently encountered issues in CopyTrade Pro and their solutions.

## Table of Contents
1. [Installation Issues](#installation-issues)
2. [Authentication Problems](#authentication-problems)
3. [Broker Connection Issues](#broker-connection-issues)
4. [Symbol Search Problems](#symbol-search-problems)
5. [Order Placement Failures](#order-placement-failures)
6. [Performance Issues](#performance-issues)
7. [Database Problems](#database-problems)

## Installation Issues

### Issue: npm install fails with dependency errors

**Symptoms:**
- Error messages about missing dependencies
- Build failures during installation
- Dev-packages not found errors

**Solution:**
```bash
# Clean and reinstall everything
npm run clean:all
npm install

# If dev-packages are missing
npm run build:dev-packages
```

**Prevention:**
- Always run `npm install` from the project root
- Ensure Node.js version >= 18.0.0

### Issue: Port already in use (EADDRINUSE)

**Symptoms:**
- Error: `EADDRINUSE: address already in use :::3001`
- Server fails to start

**Solution:**
```bash
# Kill processes on the port
npm run kill-ports

# Or manually
lsof -ti:3001 | xargs kill -9
```

## Authentication Problems

### Issue: JWT token expired or invalid

**Symptoms:**
- 401 Unauthorized responses
- Automatic logout
- "Invalid token" errors

**Solution:**
1. **Check token expiry:**
   ```javascript
   const token = localStorage.getItem('token');
   const decoded = jwt.decode(token);
   console.log('Token expires:', new Date(decoded.exp * 1000));
   ```

2. **Refresh token or re-login:**
   ```javascript
   // Clear expired token
   localStorage.removeItem('token');
   // Redirect to login
   window.location.href = '/login';
   ```

**Prevention:**
- Implement automatic token refresh
- Handle 401 responses globally

### Issue: Login fails with correct credentials

**Symptoms:**
- Login form shows "Invalid credentials"
- Network requests succeed but authentication fails

**Solution:**
1. **Check environment variables:**
   ```bash
   # Verify JWT_SECRET is set
   echo $JWT_SECRET
   ```

2. **Check database connection:**
   ```bash
   # Test MongoDB connection
   npm run test:db
   ```

3. **Verify password hashing:**
   ```javascript
   // Check if password is properly hashed
   const bcrypt = require('bcryptjs');
   const isValid = await bcrypt.compare(password, hashedPassword);
   ```

## Broker Connection Issues

### Issue: Shoonya broker connection fails

**Symptoms:**
- "Connection failed" error
- Invalid credentials message
- TOTP authentication errors

**Solution:**
1. **Verify credentials:**
   ```bash
   # Check environment variables
   echo $SHOONYA_USER_ID
   echo $SHOONYA_VENDOR_CODE
   # Note: Don't echo passwords in production
   ```

2. **Check TOTP generation:**
   ```javascript
   const otplib = require('otplib');
   const token = otplib.authenticator.generate(totpSecret);
   console.log('Current TOTP:', token);
   ```

3. **Verify API endpoints:**
   ```bash
   # Test Shoonya API connectivity
   curl -X POST https://api.shoonya.com/NorenWClientTP/QuickAuth \
     -H "Content-Type: application/json" \
     -d '{"apkversion":"1.0.0"}'
   ```

### Issue: Fyers OAuth flow fails

**Symptoms:**
- Redirect URI mismatch
- OAuth state parameter errors
- Authorization code exchange fails

**Solution:**
1. **Check redirect URI configuration:**
   ```javascript
   // Ensure redirect URI matches exactly
   const redirectUri = process.env.FYERS_REDIRECT_URI;
   console.log('Configured redirect URI:', redirectUri);
   ```

2. **Verify OAuth state:**
   ```javascript
   // Check state parameter handling
   const state = req.query.state;
   const storedState = req.session.oauthState;
   if (state !== storedState) {
     throw new Error('Invalid OAuth state');
   }
   ```

## Symbol Search Problems

### Issue: Symbol search returns no results

**Symptoms:**
- Empty search results for valid queries
- API returns success but empty data array

**Solution:**
1. **Check symbol database:**
   ```bash
   # Verify symbols are loaded
   npm run check:symbols
   ```

2. **Test database query:**
   ```javascript
   // Direct database query
   const symbols = await symbolDbService.searchSymbols({
     query: 'NIFTY',
     limit: 10
   });
   console.log('Found symbols:', symbols.length);
   ```

3. **Verify search indexes:**
   ```javascript
   // Check if text indexes exist
   const indexes = await db.collection('standardizedsymbols').indexes();
   console.log('Available indexes:', indexes);
   ```

### Issue: Symbol format conversion fails

**Symptoms:**
- Order placement fails with "Invalid symbol" error
- Broker-specific format not recognized

**Solution:**
1. **Test symbol converter:**
   ```javascript
   const converter = new FyersSymbolConverter();
   const result = converter.convertToFyersFormat(symbol);
   console.log('Converted symbol:', result);
   ```

2. **Verify symbol data:**
   ```javascript
   // Check if symbol has required fields
   console.log('Symbol data:', {
     tradingSymbol: symbol.tradingSymbol,
     instrumentType: symbol.instrumentType,
     exchange: symbol.exchange
   });
   ```

## Order Placement Failures

### Issue: Orders fail with "Insufficient funds" error

**Symptoms:**
- Order placement returns insufficient funds
- Account shows available balance

**Solution:**
1. **Check margin requirements:**
   ```javascript
   // Calculate required margin
   const margin = quantity * price * marginPercentage;
   console.log('Required margin:', margin);
   ```

2. **Verify account balance:**
   ```javascript
   // Get current balance from broker
   const balance = await brokerService.getAccountBalance();
   console.log('Available balance:', balance);
   ```

### Issue: Orders stuck in "PENDING" status

**Symptoms:**
- Orders don't get executed
- Status remains "PENDING" for extended time

**Solution:**
1. **Check order status updates:**
   ```bash
   # Verify order status service is running
   npm run check:order-status
   ```

2. **Manual status refresh:**
   ```javascript
   // Force order status update
   await orderStatusService.updateOrderStatus(orderId);
   ```

## Performance Issues

### Issue: Slow API responses

**Symptoms:**
- API calls take longer than 5 seconds
- Frontend becomes unresponsive

**Solution:**
1. **Check database performance:**
   ```javascript
   // Enable MongoDB profiling
   db.setProfilingLevel(2);
   
   // Check slow queries
   db.system.profile.find().sort({ts: -1}).limit(5);
   ```

2. **Monitor memory usage:**
   ```bash
   # Check Node.js memory usage
   npm run monitor:memory
   ```

3. **Optimize queries:**
   ```javascript
   // Add proper indexes
   await db.collection('standardizedsymbols').createIndex({
     'tradingSymbol': 1,
     'instrumentType': 1
   });
   ```

### Issue: High memory usage

**Symptoms:**
- Server crashes with out-of-memory errors
- Slow performance over time

**Solution:**
1. **Check for memory leaks:**
   ```bash
   # Monitor memory usage
   npm run monitor:memory
   ```

2. **Optimize caching:**
   ```javascript
   // Implement LRU cache with size limits
   const cache = new LRUCache({
     max: 1000,
     maxAge: 1000 * 60 * 10 // 10 minutes
   });
   ```

## Database Problems

### Issue: MongoDB connection failures

**Symptoms:**
- "Connection refused" errors
- Database operations timeout

**Solution:**
1. **Check MongoDB status:**
   ```bash
   # Check if MongoDB is running
   sudo systemctl status mongod
   
   # Start MongoDB if stopped
   sudo systemctl start mongod
   ```

2. **Verify connection string:**
   ```javascript
   // Test connection
   const mongoose = require('mongoose');
   await mongoose.connect(process.env.MONGODB_URI);
   console.log('Database connected successfully');
   ```

3. **Check database permissions:**
   ```bash
   # Test database access
   mongo $MONGODB_URI --eval "db.runCommand('ping')"
   ```

### Issue: Database queries are slow

**Symptoms:**
- Long response times for database operations
- High CPU usage on database server

**Solution:**
1. **Analyze query performance:**
   ```javascript
   // Use explain() to analyze queries
   const explanation = await db.collection('standardizedsymbols')
     .find({instrumentType: 'OPTION'})
     .explain('executionStats');
   console.log('Query stats:', explanation);
   ```

2. **Add missing indexes:**
   ```javascript
   // Create compound indexes for common queries
   await db.collection('standardizedsymbols').createIndex({
     'instrumentType': 1,
     'underlying': 1,
     'expiryDate': 1
   });
   ```

## Getting Additional Help

If these solutions don't resolve your issue:

1. **Check logs:**
   ```bash
   # Backend logs
   tail -f backend/logs/combined.log
   
   # PM2 logs
   pm2 logs copytrade-pro
   ```

2. **Enable debug mode:**
   ```bash
   # Set debug environment
   export DEBUG=copytrade:*
   npm run dev
   ```

3. **Contact support:**
   - Create a GitHub issue with detailed error information
   - Include relevant log entries and steps to reproduce
   - Specify your environment (OS, Node.js version, etc.)

## Prevention Best Practices

1. **Regular maintenance:**
   - Update dependencies regularly
   - Monitor system resources
   - Backup database regularly

2. **Monitoring:**
   - Set up health checks
   - Monitor API response times
   - Track error rates

3. **Testing:**
   - Run tests before deployment
   - Test in staging environment
   - Validate configuration changes