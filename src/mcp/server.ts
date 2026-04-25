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
import { TOOL_REGISTRY, getToolByName, zodToJsonSchema, type ToolEntry } from '../core/registry.js';

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

// ---------------------------------------------------------------------------
// Service filter — agents can subset the tool registry to keep their context
// window small. CLI:  framlit mcp --services narration,campaign,brand
//                     npx framlit-mcp --services batch,brand
// Env:                FRAMLIT_MCP_SERVICES=batch,brand
// CLI flag wins over env. Empty / absent → load everything.
// ---------------------------------------------------------------------------
const ALL_CATEGORIES: ReadonlyArray<ToolEntry['category']> = [
  'generate', 'project', 'render', 'template', 'credits',
  'preview', 'batch', 'narration', 'campaign', 'brand', 'shopify',
];

function parseServicesFilter(): ReadonlySet<ToolEntry['category']> | null {
  let raw: string | undefined;
  // --services foo,bar  OR  --services=foo,bar
  for (let i = 0; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--services' && i + 1 < process.argv.length) {
      raw = process.argv[i + 1];
      break;
    }
    if (a.startsWith('--services=')) {
      raw = a.slice('--services='.length);
      break;
    }
  }
  if (!raw) raw = process.env.FRAMLIT_MCP_SERVICES;
  if (!raw) return null;

  const requested = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const valid = new Set<ToolEntry['category']>();
  const invalid: string[] = [];
  for (const r of requested) {
    if ((ALL_CATEGORIES as ReadonlyArray<string>).includes(r)) {
      valid.add(r as ToolEntry['category']);
    } else {
      invalid.push(r);
    }
  }
  if (invalid.length) {
    console.error(
      `Warning: --services ignored unknown categories: ${invalid.join(', ')}. ` +
      `Valid: ${ALL_CATEGORIES.join(', ')}`,
    );
  }
  return valid.size ? valid : null;
}

const SERVICES_FILTER = parseServicesFilter();
const ACTIVE_TOOLS: ReadonlyArray<ToolEntry> = SERVICES_FILTER
  ? TOOL_REGISTRY.filter((t) => SERVICES_FILTER.has(t.category))
  : TOOL_REGISTRY;

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

// List available tools — built from the (possibly filtered) registry
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: ACTIVE_TOOLS.map((entry) => ({
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
  // Hide filtered-out tools the same way unknown ones are hidden — agents
  // shouldn't be able to call something they couldn't list.
  if (!entry || (SERVICES_FILTER && !SERVICES_FILTER.has(entry.category))) {
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
  const toolCount = ACTIVE_TOOLS.length;
  const filterNote = SERVICES_FILTER
    ? ` (services: ${[...SERVICES_FILTER].join(',')} → ${toolCount}/${TOOL_REGISTRY.length} tools)`
    : ` (${toolCount} tools)`;
  console.error(`${SERVER_NAME} v${SERVER_VERSION} started${filterNote}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
