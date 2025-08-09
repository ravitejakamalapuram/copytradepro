# API Documentation

This section contains comprehensive API documentation for CopyTrade Pro.

## Available APIs

### Authentication
- [Authentication API](./auth-api.md) - User authentication and session management

### Trading
- [Broker API](./broker-api.md) - Broker connection and management
- [Order Management API](./order-api.md) - Order placement and management
- [Portfolio API](./portfolio-api.md) - Portfolio and holdings data

### Market Data
- [Market Data API](./market-data-api.md) - Real-time market information
- [Symbol Search API](./symbol-search-api.md) - Symbol search and lookup

### Administration
- [Admin API](./admin-api.md) - Administrative functions
- [Monitoring API](./monitoring-api.md) - System monitoring and health checks

## API Standards

### Authentication
All API endpoints require JWT authentication unless otherwise specified.

### Request Format
- Content-Type: `application/json`
- Authorization: `Bearer <jwt_token>`

### Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "timestamp": "2025-01-31T10:00:00Z"
}
```

### Error Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Authentication endpoints: 5 requests per minute
- Trading endpoints: 100 requests per minute
- Market data endpoints: 1000 requests per minute

## Versioning

API versioning is handled through URL paths:
- Current version: `/api/v1/`
- Legacy support: `/api/v0/` (deprecated)