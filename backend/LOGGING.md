# Logging Configuration

CopyTrade Pro uses a comprehensive logging system that supports console, file-based, and database logging.

## 🏗️ **Logging Architecture**

The system uses **three-tier logging**:

1. **Console Logging** - Always enabled for immediate visibility
2. **File Logging** - Fast local storage (configurable)
3. **Database Logging** - Structured storage for analytics (configurable)

### **Why Multiple Logging Methods?**

- **Console**: Real-time debugging during development
- **Files**: Fast, reliable logging that works even if database is down
- **Database**: Structured, searchable logs for admin dashboard and analytics

## 📁 Log File Locations

When file logging is enabled, logs are stored in:

```
backend/logs/
├── errors/
│   ├── all.log          # All log levels (info, warn, error, debug)
│   ├── error.log        # Error level logs only
│   ├── critical.log     # Critical level logs only
│   └── trace.log        # Debug, info, and warn logs
└── archived/            # Rotated/archived logs (managed by log rotation service)
```

## ⚙️ Configuration

### Environment Variables

Add these to your `.env` file:

```bash
# Enable/disable file logging (logs to backend/logs/errors/)
ENABLE_FILE_LOGGING=true

# Enable/disable database logging (logs to MongoDB error_logs collection)
ENABLE_DATABASE_LOGGING=true

# Set log level (debug, info, warn, error, critical)
LOG_LEVEL=info

# Enable/disable HTTP request logging
ENABLE_REQUEST_LOGGING=true
```

### **Logging Strategies**

Choose based on your needs:

#### **Development (Recommended)**
```bash
ENABLE_FILE_LOGGING=true
ENABLE_DATABASE_LOGGING=false  # Reduce overhead
LOG_LEVEL=debug
```

#### **Production (Recommended)**
```bash
ENABLE_FILE_LOGGING=true
ENABLE_DATABASE_LOGGING=true   # For admin dashboard
LOG_LEVEL=info
```

#### **High Performance (Minimal Logging)**
```bash
ENABLE_FILE_LOGGING=false
ENABLE_DATABASE_LOGGING=false
LOG_LEVEL=error
```

#### **Analytics Focus (Database Only)**
```bash
ENABLE_FILE_LOGGING=false
ENABLE_DATABASE_LOGGING=true
LOG_LEVEL=info
```

### Log Levels

- **debug**: Detailed debugging information
- **info**: General information messages
- **warn**: Warning messages
- **error**: Error messages with stack traces
- **critical**: Critical system errors

## 🔍 Monitoring Symbol Loading

To check if symbol loading is hitting on server restart, monitor these logs:

### Console Output (Real-time)
```bash
cd backend
npm run dev
```

Look for these messages:
- ✅ `"Fresh symbol data already exists, skipping initialization"` - No API calls
- ⚠️ `"Symbol data exists but is stale, scheduling one-time refresh"` - Uses existing data
- 🔄 `"No symbol data found, starting fresh initialization"` - Full loading

### File Logs
```bash
# Watch all logs in real-time
tail -f logs/errors/all.log

# Watch only error logs
tail -f logs/errors/error.log

# Search for symbol-related logs
grep -i "symbol" logs/errors/all.log

# Search for startup initialization logs
grep -i "startup.*symbol" logs/errors/all.log
```

## 📊 Log Rotation

The system includes automatic log rotation:

- **Daily rotation** at midnight
- **Size-based rotation** when files exceed 10MB
- **Compression** of rotated logs
- **Automatic cleanup** of old logs (30 days retention)

## 🛠️ Troubleshooting

### File Logging Not Working

1. Check if logs directory exists:
   ```bash
   ls -la backend/logs/
   ```

2. Check environment variable:
   ```bash
   echo $ENABLE_FILE_LOGGING
   ```

3. Check file permissions:
   ```bash
   ls -la backend/logs/errors/
   ```

### Symbol Loading Performance

1. Check startup logs:
   ```bash
   grep "STARTUP_SYMBOL_INIT" logs/errors/all.log
   ```

2. Check data freshness:
   ```bash
   grep "checkDataFreshness" logs/errors/all.log
   ```

3. Monitor initialization time:
   ```bash
   grep "Symbol.*initialization.*completed" logs/errors/all.log
   ```

## 📈 Log Analysis

### Common Log Patterns

```bash
# Check for errors in the last hour
grep "$(date -d '1 hour ago' '+%Y-%m-%d %H')" logs/errors/error.log

# Count error types
grep "ERROR" logs/errors/all.log | cut -d']' -f3 | sort | uniq -c

# Monitor API response times
grep "API.*ms" logs/errors/all.log | tail -20
```

### Symbol Loading Analysis

```bash
# Check if symbol loading is being skipped (good performance)
grep "Fresh symbol data already exists" logs/errors/all.log

# Check if stale data refresh is happening
grep "scheduling one-time refresh" logs/errors/all.log

# Check full initialization (should be rare)
grep "starting fresh initialization" logs/errors/all.log
```

## 📊 **Storage Comparison**

| Method | Speed | Storage | Searchable | Survives DB Issues | Admin Dashboard |
|--------|-------|---------|------------|-------------------|-----------------|
| Console | ⚡ Fastest | None | ❌ | ✅ | ❌ |
| Files | 🚀 Fast | Disk | Limited | ✅ | ❌ |
| Database | 🐌 Slower | MongoDB | ✅ | ❌ | ✅ |

## 🚀 Production Considerations

- **Dual logging** (files + database) provides redundancy
- **File logging** works even if database is down
- **Database logging** enables admin dashboard error analytics
- **Log rotation** prevents disk space issues
- **Automatic cleanup** removes old logs
- **Compression** reduces storage usage

## 🔧 Manual Log Management

```bash
# Force log rotation
curl -X POST http://localhost:3001/api/monitoring/logs/rotate

# Clear old logs manually
find backend/logs -name "*.log" -mtime +30 -delete

# Check log file sizes
du -sh backend/logs/errors/*
```