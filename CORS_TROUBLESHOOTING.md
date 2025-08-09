# CORS Troubleshooting Guide

This guide helps you fix CORS (Cross-Origin Resource Sharing) issues in development mode.

## Quick Fix Summary

The CORS configuration has been updated to be more permissive in development mode:

1. **Backend Changes**: Updated `backend/src/index.ts` to allow all origins in development
2. **Environment Setup**: Added proper CORS origins in `backend/.env`
3. **Frontend Config**: Created `frontend/.env` with correct API URL
4. **Testing Script**: Added `test-cors.js` to verify CORS configuration

## Testing CORS Configuration

Run the CORS test script to verify everything is working:

```bash
# Make sure backend is running first
cd backend && npm run dev

# In another terminal, run the test
node test-cors.js
```

## Common CORS Issues and Solutions

### 1. "Access to fetch at ... has been blocked by CORS policy"

**Solution**: The backend CORS configuration now allows all origins in development mode.

**Verify**:
- Check that `NODE_ENV=development` in `backend/.env`
- Restart the backend server after changes
- Check browser console for specific CORS error details

### 2. Preflight OPTIONS requests failing

**Solution**: Added explicit OPTIONS handler for all routes.

**Verify**:
- Open browser DevTools → Network tab
- Look for OPTIONS requests before your actual API calls
- They should return status 200

### 3. Credentials not being sent

**Solution**: CORS is configured with `credentials: true` and frontend axios is configured to send credentials.

**Verify**:
- Check that `withCredentials: true` is set in axios requests
- Verify cookies/tokens are being sent in request headers

### 4. Custom headers being blocked

**Solution**: Added common headers to `Access-Control-Allow-Headers`.

**Current allowed headers**:
- Content-Type
- Authorization
- X-Requested-With
- Accept
- Origin
- X-Request-ID

## Development vs Production CORS

### Development Mode (NODE_ENV=development)
- **Origin**: Allows all origins (`origin: true`)
- **Debugging**: Extra logging for CORS requests
- **Permissive**: More lenient for easier development

### Production Mode (NODE_ENV=production)
- **Origin**: Strict whitelist from `ALLOWED_ORIGINS` env var
- **Security**: Proper origin validation
- **Logging**: CORS violations are logged

## Environment Configuration

### Backend (.env)
```bash
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:3001/api
VITE_NODE_ENV=development
VITE_WS_URL=http://localhost:3001
```

## Debugging CORS Issues

### 1. Check Browser Console
Look for specific CORS error messages:
- "has been blocked by CORS policy"
- "Preflight response is not successful"
- "Request header field ... is not allowed"

### 2. Check Network Tab
- Look for failed OPTIONS requests (preflight)
- Check response headers for CORS headers
- Verify request headers are being sent

### 3. Check Backend Logs
In development mode, CORS requests are logged with details:
```
[DEBUG] Handling OPTIONS preflight request
[DEBUG] Processing request with CORS headers
```

### 4. Test with curl
```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v http://localhost:3001/api/broker/accounts

# Test actual request
curl -X GET \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -v http://localhost:3001/api/health
```

## Common Development Scenarios

### 1. Frontend on port 5173 (Vite default)
✅ **Allowed**: `http://localhost:5173`

### 2. Frontend on port 3000 (Create React App)
✅ **Allowed**: `http://localhost:3000`

### 3. Using 127.0.0.1 instead of localhost
✅ **Allowed**: Both `127.0.0.1` and `localhost` variants

### 4. File protocol (opening HTML directly)
✅ **Allowed**: `null` origin is permitted in development

## Troubleshooting Steps

1. **Restart Backend Server**
   ```bash
   cd backend
   npm run dev
   ```

2. **Clear Browser Cache**
   - Hard refresh (Ctrl+F5 or Cmd+Shift+R)
   - Clear browser cache and cookies
   - Try incognito/private mode

3. **Verify Environment Variables**
   ```bash
   cd backend
   cat .env | grep -E "(NODE_ENV|FRONTEND_URL|ALLOWED_ORIGINS)"
   ```

4. **Test CORS Configuration**
   ```bash
   node test-cors.js
   ```

5. **Check Frontend Configuration**
   ```bash
   cd frontend
   cat .env | grep VITE_API_URL
   ```

## Still Having Issues?

If CORS issues persist:

1. **Check the exact error message** in browser console
2. **Verify the request URL** - make sure it matches your backend URL
3. **Check if using proxy** - Vite proxy might interfere with direct API calls
4. **Test with a simple curl request** to isolate the issue
5. **Check firewall/antivirus** - some security software blocks CORS requests

## Production Deployment

For production, make sure to:

1. Set `NODE_ENV=production` in backend
2. Configure `ALLOWED_ORIGINS` with your actual frontend domain
3. Use HTTPS for both frontend and backend
4. Test CORS with your production URLs

## Contact Support

If you're still experiencing CORS issues after following this guide:

1. Include the exact error message from browser console
2. Share your environment configuration (without sensitive data)
3. Provide the output of `node test-cors.js`
4. Mention your browser and version