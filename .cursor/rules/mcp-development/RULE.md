---
description: "framlit-mcp development guide. Reference when writing MCP server code."
alwaysApply: true
---

# Framlit MCP Development Guide

## Project Overview

framlit-mcp is the MCP (Model Context Protocol) server for Framlit SaaS.
Enables direct use of Framlit's video generation features from IDEs like Cursor.

## Core Principles

### 1. SaaS Gateway Role
- MCP only acts as a client for Framlit SaaS API
- All generation logic is handled by Framlit SaaS
- Credit deduction is also handled by SaaS

### 2. Authentication
- API Key-based authentication (`FRAMLIT_API_KEY` environment variable)
- API calls in Bearer token format

## Code Patterns

### Tool Definition
```typescript
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const myTool: Tool = {
  name: 'framlit_<action>',      // Always framlit_ prefix
  description: `Description...`,  // Detailed description (include cost, limits, etc.)
  inputSchema: {
    type: 'object',
    properties: { ... },
    required: ['...'],
  },
};
```

### Tool Handler
```typescript
export async function handleMyTool(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  // 1. Extract parameters and type cast
  const param = args.param as string;
  
  // 2. API call
  const result = await client.myMethod(param);
  
  // 3. Return result (text content)
  return {
    content: [
      {
        type: 'text',
        text: `Result: ${result}`,
      },
    ],
  };
}
```

### Error Handling
```typescript
// Error handling in API client
if (!response.ok) {
  // Add upsell message for specific error codes
  if (data.code === 'INSUFFICIENT_CREDITS') {
    throw new Error(`${error}\n\n💡 Get more credits at https://framlit.app/pricing`);
  }
  throw new Error(error);
}
```

## Naming Conventions

### Tool Names
- Format: `framlit_<action>` (snake_case)
- Examples: `framlit_generate_code`, `framlit_list_projects`

### File Structure
```
src/
├── index.ts              # Server entry
├── api/
│   └── client.ts         # Framlit API client
├── tools/
│   ├── generate.ts       # Code generation tool
│   ├── projects.ts       # Project tool
│   └── ...
└── resources/
    └── user.ts           # User resource
```

## Pro Upsell Messages

Include upsell messages for errors like insufficient credits, plan limits:

```typescript
// Good example
'Insufficient credits. Get more at https://framlit.app/pricing'

// Bad example (no link)
'Insufficient credits.'
```

## Testing

```bash
# Run development server
npm run dev

# Build
npm run build

# Local testing (environment variables required)
FRAMLIT_API_KEY=fml_xxx npm start
```
