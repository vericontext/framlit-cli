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

import { FramlitClient } from './api/client.js';
import { 
  generateCodeTool, 
  modifyCodeTool,
  handleGenerateCode,
  handleModifyCode,
} from './tools/generate.js';
import {
  listProjectsTool,
  getProjectTool,
  createProjectTool,
  updateProjectTool,
  handleListProjects,
  handleGetProject,
  handleCreateProject,
  handleUpdateProject,
} from './tools/projects.js';
import {
  renderVideoTool,
  getRenderStatusTool,
  handleRenderVideo,
  handleGetRenderStatus,
} from './tools/render.js';
import {
  listTemplatesTool,
  handleListTemplates,
} from './tools/templates.js';
import {
  getCreditsTool,
  handleGetCredits,
} from './tools/credits.js';
import {
  previewCodeTool,
  handlePreviewCode,
} from './tools/preview.js';

// Server configuration
const SERVER_NAME = 'framlit-mcp';
const SERVER_VERSION = '0.1.0';

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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      generateCodeTool,
      modifyCodeTool,
      listProjectsTool,
      getProjectTool,
      createProjectTool,
      updateProjectTool,
      renderVideoTool,
      getRenderStatusTool,
      listTemplatesTool,
      getCreditsTool,
      previewCodeTool,
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    switch (name) {
      // Code generation
      case 'framlit_generate_code':
        return await handleGenerateCode(client, args);
      case 'framlit_modify_code':
        return await handleModifyCode(client, args);
      
      // Projects
      case 'framlit_list_projects':
        return await handleListProjects(client);
      case 'framlit_get_project':
        return await handleGetProject(client, args);
      case 'framlit_create_project':
        return await handleCreateProject(client, args);
      case 'framlit_update_project':
        return await handleUpdateProject(client, args);
      
      // Rendering
      case 'framlit_render_video':
        return await handleRenderVideo(client, args);
      case 'framlit_get_render_status':
        return await handleGetRenderStatus(client, args);
      
      // Templates
      case 'framlit_list_templates':
        return await handleListTemplates(client, args);
      
      // Credits
      case 'framlit_get_credits':
        return await handleGetCredits(client);
      
      // Preview
      case 'framlit_preview_code':
        return await handlePreviewCode(client, args);
      
      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
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
