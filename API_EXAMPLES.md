# API Usage Examples

## Authentication

### Register a new user

```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ss123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecureP@ss123"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "USER",
      "status": "PENDING"
    }
  }
}
```

### Get current user

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Refresh token

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

### Logout

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Customer Management

### List customers (with pagination)

```bash
curl -X GET "http://localhost:3000/api/v1/customers?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get customer by ID

```bash
curl -X GET http://localhost:3000/api/v1/customers/CUSTOMER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Create customer

```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Corporation",
    "taxId": "123456789",
    "email": "contact@acme.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "city": "New York",
    "country": "USA"
  }'
```

### Update customer

```bash
curl -X PUT http://localhost:3000/api/v1/customers/CUSTOMER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Acme Corp Updated",
    "phone": "+9876543210"
  }'
```

### Delete customer

```bash
curl -X DELETE http://localhost:3000/api/v1/customers/CUSTOMER_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Using with JavaScript/TypeScript

### Axios Example

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Login
const login = async (email: string, password: string) => {
  const response = await api.post('/auth/login', { email, password });
  const { accessToken } = response.data.data;
  
  // Set token for future requests
  api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
  
  return response.data;
};

// Get customers
const getCustomers = async (page = 1, limit = 10) => {
  const response = await api.get('/customers', {
    params: { page, limit },
  });
  return response.data;
};

// Create customer
const createCustomer = async (customerData: any) => {
  const response = await api.post('/customers', customerData);
  return response.data;
};
```

### Fetch Example

```javascript
const API_URL = 'http://localhost:3000/api/v1';
let accessToken = '';

// Login
async function login(email, password) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  accessToken = data.data.accessToken;
  return data;
}

// Get customers with authentication
async function getCustomers() {
  const response = await fetch(`${API_URL}/customers?page=1&limit=10`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });
  
  return await response.json();
}
```

## Error Handling

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  },
  "meta": {
    "timestamp": "2025-11-15T10:00:00.000Z"
  }
}
```

Common error codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (invalid/expired token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
