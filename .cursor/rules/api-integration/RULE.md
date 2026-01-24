---
description: "Framlit API integration patterns. Reference when modifying API client."
globs: ["src/api/**"]
---

# Framlit API Integration

## API Endpoints

### Base URL
- Production: `https://framlit.app/api/mcp`
- Environment variable: `FRAMLIT_API_URL` (optional)

### Authentication
- Header: `Authorization: Bearer <API_KEY>`
- API Key format: `fml_<random_string>`

## Endpoint List

| Endpoint | Method | Description | Credit |
|----------|--------|-------------|--------|
| `/user` | GET | User information | 0 |
| `/generate-code` | POST | Code generation | 1 |
| `/modify-code` | POST | Code modification | 1 |
| `/projects` | GET | Project list | 0 |
| `/projects` | POST | Create project | 0 |
| `/projects/:id` | GET | Project details | 0 |
| `/projects/:id` | PUT | Update project | 0 |
| `/render` | POST | Start rendering | 0 |
| `/render/:id` | GET | Rendering status | 0 |
| `/templates` | GET | Template list | 0 |

## Response Format

### Success Response
```typescript
{
  data: T;          // Actual data
  message?: string; // Optional message
}
```

### Error Response
```typescript
{
  error: string;    // Error message
  code?: string;    // Error code (INSUFFICIENT_CREDITS, PLAN_LIMIT_EXCEEDED, etc.)
  details?: any;    // Additional information
}
```

## Error Codes

| Code | Description | Response |
|------|-------------|----------|
| `UNAUTHORIZED` | Authentication failed | Guide to check API Key |
| `INSUFFICIENT_CREDITS` | Insufficient credits | Provide recharge link |
| `PLAN_LIMIT_EXCEEDED` | Plan limit exceeded | Provide upgrade link |
| `NOT_FOUND` | Resource not found | Generic error |
| `INTERNAL_ERROR` | Server error | Guide to retry |

## API Client Pattern

```typescript
private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${this.baseUrl}/api/mcp${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'framlit-mcp/0.1.0',
      ...options.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    // Error handling + upsell message
    throw new Error(formatError(data));
  }

  return data.data as T;
}
```

## Important Notes

1. **Never expose API Key**: Do not log API Key
2. **Include links in error messages**: So users can take immediate action
3. **Timeout handling**: Code generation can take 10-30 seconds
4. **Rate Limiting**: Consider retry logic when API returns 429 response
