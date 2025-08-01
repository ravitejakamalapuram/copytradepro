# [API Name] Documentation

## Overview

Brief description of the API's purpose and functionality.

## Base URL

```
/api/[endpoint-base]
```

## Authentication

Authentication requirements and format:

```
Authorization: Bearer <jwt_token>
```

## Endpoints

### 1. [Endpoint Name]

Brief description of what this endpoint does.

**Endpoint:** `[METHOD] /api/[endpoint-path]`

**Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `param1` | string | Yes | Parameter description | `example_value` |
| `param2` | number | No | Optional parameter | `123` |

**Request Body (if applicable):**
```json
{
  "field1": "value1",
  "field2": "value2"
}
```

**Example Request:**
```bash
[METHOD] /api/[endpoint-path]?param1=value1&param2=value2
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data structure
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  },
  "timestamp": "2025-01-31T10:00:00Z"
}
```

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `ERROR_CODE_1` | 400 | Bad request description |
| `ERROR_CODE_2` | 404 | Not found description |
| `ERROR_CODE_3` | 500 | Internal server error |

## Rate Limits

- **Endpoint 1**: X requests per minute
- **Endpoint 2**: Y requests per minute

## Usage Examples

### JavaScript/TypeScript
```typescript
// Example code
const response = await fetch('/api/endpoint', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

### cURL
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     "https://api.example.com/api/endpoint"
```

## Best Practices

1. **Practice 1**: Description
2. **Practice 2**: Description
3. **Practice 3**: Description

## Related Documentation

- [Related Doc 1](../category/doc1.md)
- [Related Doc 2](../category/doc2.md)