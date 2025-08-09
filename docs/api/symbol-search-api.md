# Symbol Search API Documentation

## Overview

The Symbol Search API provides unified access to standardized symbol data across all supported brokers. It offers fast, flexible search capabilities with comprehensive filtering options.

## Base URL

```
/api/symbols
```

## Authentication

All endpoints require JWT authentication:

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. Search Symbols

Search for symbols with flexible filtering options.

**Endpoint:** `GET /api/symbols/search`

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `query` | string | Text search query | `NIFTY` |
| `instrumentType` | string | Filter by instrument type | `OPTION`, `EQUITY`, `FUTURE` |
| `exchange` | string | Filter by exchange | `NSE`, `BSE`, `NFO` |
| `underlying` | string | Filter by underlying symbol | `NIFTY`, `BANKNIFTY` |
| `strikeMin` | number | Minimum strike price | `21000` |
| `strikeMax` | number | Maximum strike price | `23000` |
| `expiryStart` | string | Start date for expiry filter | `2025-01-01` |
| `expiryEnd` | string | End date for expiry filter | `2025-12-31` |
| `optionType` | string | Option type filter | `CE`, `PE` |
| `isActive` | boolean | Filter active symbols only | `true` |
| `limit` | number | Maximum results to return | `50` |
| `offset` | number | Number of results to skip | `0` |

**Example Request:**
```bash
GET /api/symbols/search?query=NIFTY&instrumentType=OPTION&strikeMin=21000&strikeMax=23000&limit=10
```

**Response:**
```json
{
  "success": true,
  "data": {
    "symbols": [
      {
        "id": "NIFTY25JAN22000CE",
        "displayName": "NIFTY 22000 CE 30 JAN 25",
        "tradingSymbol": "NIFTY25JAN22000CE",
        "instrumentType": "OPTION",
        "exchange": "NFO",
        "segment": "FO",
        "underlying": "NIFTY",
        "strikePrice": 22000,
        "optionType": "CE",
        "expiryDate": "2025-01-30",
        "lotSize": 50,
        "tickSize": 0.05,
        "isActive": true,
        "lastUpdated": "2025-01-31T10:00:00Z",
        "source": "upstox"
      }
    ],
    "total": 1,
    "hasMore": false,
    "pagination": {
      "limit": 10,
      "offset": 0,
      "total": 1
    }
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

### 2. Get Symbol by ID

Retrieve a specific symbol by its unique identifier.

**Endpoint:** `GET /api/symbols/:id`

**Parameters:**
- `id` (path): Symbol ID

**Example Request:**
```bash
GET /api/symbols/NIFTY25JAN22000CE
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "NIFTY25JAN22000CE",
    "displayName": "NIFTY 22000 CE 30 JAN 25",
    "tradingSymbol": "NIFTY25JAN22000CE",
    "instrumentType": "OPTION",
    "exchange": "NFO",
    "segment": "FO",
    "underlying": "NIFTY",
    "strikePrice": 22000,
    "optionType": "CE",
    "expiryDate": "2025-01-30",
    "lotSize": 50,
    "tickSize": 0.05,
    "isActive": true,
    "lastUpdated": "2025-01-31T10:00:00Z",
    "source": "upstox",
    "isin": "INE123456789",
    "companyName": null,
    "sector": null
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

### 3. Get Symbols by Underlying

Retrieve all symbols for a specific underlying asset.

**Endpoint:** `GET /api/symbols/underlying/:symbol`

**Parameters:**
- `symbol` (path): Underlying symbol name

**Query Parameters:**
- `instrumentType` (optional): Filter by instrument type
- `expiryStart` (optional): Start date filter
- `expiryEnd` (optional): End date filter

**Example Request:**
```bash
GET /api/symbols/underlying/NIFTY?instrumentType=OPTION&expiryStart=2025-01-01
```

**Response:**
```json
{
  "success": true,
  "data": {
    "underlying": "NIFTY",
    "symbols": [
      {
        "id": "NIFTY25JAN22000CE",
        "displayName": "NIFTY 22000 CE 30 JAN 25",
        "tradingSymbol": "NIFTY25JAN22000CE",
        "instrumentType": "OPTION",
        "strikePrice": 22000,
        "optionType": "CE",
        "expiryDate": "2025-01-30"
      }
    ],
    "total": 1
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

### 4. Get Symbol Statistics

Retrieve database statistics and health information.

**Endpoint:** `GET /api/symbols/stats`

**Response:**
```json
{
  "success": true,
  "data": {
    "totalSymbols": 150000,
    "activeSymbols": 145000,
    "inactiveSymbols": 5000,
    "byInstrumentType": {
      "EQUITY": 5000,
      "OPTION": 120000,
      "FUTURE": 25000
    },
    "byExchange": {
      "NSE": 5000,
      "NFO": 145000
    },
    "lastUpdated": "2025-01-31T06:00:00Z",
    "dataSource": "upstox"
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": {
      "strikeMin": "Must be a positive number"
    }
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "SYMBOL_NOT_FOUND",
    "message": "Symbol not found"
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An internal error occurred"
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

## Rate Limits

- **Search endpoints**: 1000 requests per minute
- **Individual symbol lookup**: 2000 requests per minute
- **Statistics endpoint**: 100 requests per minute

## Performance

- **Search response time**: < 200ms for typical queries
- **Symbol lookup**: < 50ms
- **Bulk operations**: Optimized for up to 1000 symbols per request

## Usage Examples

### JavaScript/TypeScript
```typescript
// Search for NIFTY options
const response = await fetch('/api/symbols/search?query=NIFTY&instrumentType=OPTION&limit=10', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data.data.symbols);
```

### cURL
```bash
# Search symbols
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api.copytrade.pro/api/symbols/search?query=NIFTY&instrumentType=OPTION"

# Get specific symbol
curl -H "Authorization: Bearer YOUR_TOKEN" \
     "https://api.copytrade.pro/api/symbols/NIFTY25JAN22000CE"
```

## Best Practices

1. **Use specific filters**: Narrow down results with instrument type and exchange filters
2. **Implement pagination**: Use limit and offset for large result sets
3. **Cache results**: Cache frequently accessed symbols on the client side
4. **Handle errors gracefully**: Always check the success field in responses
5. **Use appropriate limits**: Don't request more data than needed

## Related Documentation

- [Broker Integration](../architecture/broker-integration.md)
- [Symbol Database Implementation](../features/symbol-database-implementation.md)
- [API Authentication](./auth-api.md)