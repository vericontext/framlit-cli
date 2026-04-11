#!/usr/bin/env node
/**
 * Framlit MCP Server
 *
 * MCP server for AI-powered video generation via Framlit.
 * Enables IDE integration for creating Remotion videos.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FramlitClient } from '../api/client.js';
import { TOOL_REGISTRY, getToolByName, zodToJsonSchema } from '../core/registry.js';

// Server configuration
const SERVER_NAME = 'framlit-mcp';
const SERVER_VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

// Initialize server
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Initialize API client
const apiKey = process.env.FRAMLIT_API_KEY;
if (!apiKey) {
  console.error('Error: FRAMLIT_API_KEY environment variable is required');
  console.error('Get your API key at https://framlit.app/settings/api-keys');
  process.exit(1);
}

const client = new FramlitClient(apiKey);

// List available tools — built from registry
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOL_REGISTRY.map((entry) => ({
      name: entry.name,
      description: entry.description,
      inputSchema: zodToJsonSchema(entry.schema),
    })),
  };
});

// Handle tool calls — dispatched via registry
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  const entry = getToolByName(name);
  if (!entry) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }

  try {
    const result = await entry.handler(client, args);
    return {
      content: [{ type: 'text', text: result.message }],
      ...(result.isError ? { isError: true } : {}),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'framlit://user/credits',
        name: 'Credits Balance',
        description: 'Current credit balance and usage',
        mimeType: 'application/json',
      },
      {
        uri: 'framlit://user/plan',
        name: 'Current Plan',
        description: 'Subscription plan details',
        mimeType: 'application/json',
      },
    ],
  };
});

// Read resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    if (uri === 'framlit://user/credits' || uri === 'framlit://user/plan') {
      const userInfo = await client.getUserInfo();

      if (uri === 'framlit://user/credits') {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                total: userInfo.creditsTotal,
                used: userInfo.creditsUsed,
                remaining: userInfo.creditsRemaining,
              }, null, 2),
            },
          ],
        };
      } else {
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                plan: userInfo.planTier,
                limits: userInfo.limits,
              }, null, 2),
            },
          ],
        };
      }
    }

    throw new Error(`Unknown resource: ${uri}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to read resource: ${message}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
