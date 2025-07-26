# Order Status Debug Guide

## Overview

I've created comprehensive debugging tools to help you trace exactly what happens when checking order status with the Shoonya API. These tools will log every step, payload, and response to help identify why you're not seeing the actual order status from the Shoonya API.

## Debug Tools Created

### 1. **Enhanced Debug Endpoint** 🔍
**URL:** `POST http://localhost:3001/api/broker/debug-order-status`

This is an enhanced version of your existing endpoint that logs every step in detail.

**Usage with your curl:**
```bash
curl 'http://localhost:3001/api/broker/debug-order-status' \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NjFmZmZjNmNhMjUyNDc5YmE0ODg5MiIsImVtYWlsIjoickBnbWFpbC5jb20iLCJuYW1lIjoidGVqYSIsImlhdCI6MTc1Mjk5ODYzNiwiZXhwIjoxNzUzMDg1MDM2fQ.wIr24V_O88Gbgtw0IB2EnCEoTRl0-O7y87RDggXsu8U' \
  -H 'Content-Type: application/json' \
  --data-raw '{"orderId":"687c768ca3e19fb607b69c15"}'
```

**What it logs:**
- ✅ Authentication check
- ✅ Request body parsing
- ✅ Database order lookup
- ✅ User authorization
- ✅ Broker connection status
- ✅ **Direct Shoonya API call with full request/response**
- ✅ OrderStatusService processing
- ✅ Final database state
- ✅ Complete debug trace in response

### 2. **Standalone Debug Script** 📋
**File:** `debugOrderStatusDetailed.ts`

**Usage:**
```bash
cd backend
npm run ts-node src/tests/runOrderStatusDebug.ts
```

**Or with specific order:**
```bash
npm run ts-node src/tests/debugSpecificOrder.ts 687c768ca3e19fb607b69c15 6861fffc6ca252479ba48892
```

**What it does:**
- Traces the complete order status checking process
- Logs every API call with full payloads and responses
- Shows connection status and broker service details
- Provides detailed error analysis

## Key Debug Information You'll Get

### 🔍 **Direct Shoonya API Call Details**
```json
{
  "step": "7. Direct Broker API Call - SUCCESS",
  "data": {
    "responseTime": "1234ms",
    "rawResponse": {
      // ACTUAL SHOONYA API RESPONSE HERE
    },
    "responseType": "object",
    "responseKeys": ["success", "data", "message"]
  }
}
```

### 🔍 **API Response Analysis**
```json
{
  "step": "8. API Response Processing",
  "data": {
    "responseAnalysis": {
      "hasSuccessField": true,
      "successValue": true,
      "hasDataField": true,
      "dataType": "object",
      "dataKeys": ["status", "orderId", "symbol", "quantity"],
      "fullResponse": {
        // COMPLETE SHOONYA RESPONSE
      }
    }
  }
}
```

### 🔍 **Connection Status Details**
```json
{
  "step": "3. Broker Connection Result",
  "data": {
    "connectionsFound": 1,
    "connections": [{
      "accountId": "SH123456",
      "isActive": true,
      "isConnected": true,
      "lastActivity": "2025-01-20T10:30:00Z"
    }]
  }
}
```

## How to Use These Tools

### **Step 1: Use the Enhanced Debug Endpoint**
Replace your current curl with the debug endpoint:
```bash
curl 'http://localhost:3001/api/broker/debug-order-status' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  --data-raw '{"orderId":"687c768ca3e19fb607b69c15"}'
```

### **Step 2: Analyze the Response**
The response will include:
- `data.debug.logs` - Complete step-by-step trace
- `data.debug.summary.directApiResponse` - Raw Shoonya API response
- `data.debug.summary.directApiError` - Any API errors

### **Step 3: Check Console Logs**
The backend console will show detailed logs like:
```
🔍 [2025-01-20T10:30:00.000Z] 7. Direct Broker API Call
📊 Data: {
  "method": "getOrderStatus",
  "accountId": "SH123456",
  "brokerOrderId": "25071900001627",
  "brokerName": "shoonya"
}
```

### **Step 4: Use Standalone Script for Deep Analysis**
```bash
cd backend
npm run ts-node src/tests/debugSpecificOrder.ts 687c768ca3e19fb607b69c15 6861fffc6ca252479ba48892
```

## What to Look For

### ✅ **Successful API Call**
```json
{
  "step": "7. Direct Broker API Call - SUCCESS",
  "success": true,
  "data": {
    "rawResponse": {
      "success": true,
      "data": {
        "status": "COMPLETE",
        "orderId": "25071900001627",
        "symbol": "RELIANCE-EQ",
        "quantity": 100,
        "filledQuantity": 100,
        "price": 2500.00,
        "averagePrice": 2500.00
      }
    }
  }
}
```

### ❌ **API Call Failure**
```json
{
  "step": "7. Direct Broker API Call - ERROR",
  "success": false,
  "error": "Session expired",
  "data": {
    "errorMessage": "Authentication failed",
    "errorType": "AuthenticationError",
    "errorDetails": {
      "code": 401,
      "message": "Invalid session token"
    }
  }
}
```

### ⚠️ **Connection Issues**
```json
{
  "step": "3. Broker Connection Result",
  "success": false,
  "data": {
    "connectionsFound": 0
  },
  "error": "No shoonya connections found for user 6861fffc6ca252479ba48892"
}
```

## Common Issues to Check

### 1. **No Broker Connections**
- Check if user is connected to Shoonya
- Verify account is active
- Check connection status

### 2. **Authentication Issues**
- Session might be expired
- Invalid credentials
- Token refresh needed

### 3. **Invalid Order ID**
- Order might not exist in Shoonya
- Wrong broker_order_id format
- Order might be from different account

### 4. **API Response Issues**
- Shoonya API returning error
- Malformed response
- Network connectivity issues

## Next Steps

1. **Run the debug endpoint** with your exact curl request
2. **Check the debug logs** in the response
3. **Look for the "Direct Broker API Call" step** - this shows the actual Shoonya API response
4. **If API call fails**, check connection and authentication status
5. **If API call succeeds**, check response format and data extraction

## Files Created

- `debugOrderStatusController.ts` - Enhanced debug endpoint
- `debugOrderStatusDetailed.ts` - Comprehensive debug class
- `runOrderStatusDebug.ts` - Simple script runner
- `debugSpecificOrder.ts` - Command-line debug tool

## Example Debug Session

```bash
# 1. Start your backend server
npm run dev

# 2. In another terminal, run the debug
curl 'http://localhost:3001/api/broker/debug-order-status' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  --data-raw '{"orderId":"687c768ca3e19fb607b69c15"}' | jq '.debug.logs'

# 3. Or use the standalone script
npm run ts-node src/tests/debugSpecificOrder.ts 687c768ca3e19fb607b69c15 6861fffc6ca252479ba48892
```

This will give you complete visibility into what's happening with your Shoonya API calls! 🎯