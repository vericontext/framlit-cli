/**
 * Project Management Tools
 * 
 * Tools for managing Framlit projects.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { FramlitClient } from '../api/client.js';

export const listProjectsTool: Tool = {
  name: 'framlit_list_projects',
  description: 'List all your Framlit projects.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const getProjectTool: Tool = {
  name: 'framlit_get_project',
  description: 'Get details of a specific project including its code.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID.',
      },
    },
    required: ['projectId'],
  },
};

export const createProjectTool: Tool = {
  name: 'framlit_create_project',
  description: `Create a new Framlit project.
Projects store your video code and can be rendered to MP4.`,
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name for the project.',
      },
      code: {
        type: 'string',
        description: 'Optional initial Remotion code.',
      },
      format: {
        type: 'string',
        enum: ['landscape', 'portrait', 'square'],
        description: 'Video format. Defaults to landscape.',
      },
    },
    required: ['name'],
  },
};

export const updateProjectTool: Tool = {
  name: 'framlit_update_project',
  description: 'Update an existing project.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID.',
      },
      name: {
        type: 'string',
        description: 'New name for the project.',
      },
      code: {
        type: 'string',
        description: 'Updated Remotion code.',
      },
    },
    required: ['projectId'],
  },
};

export async function handleListProjects(client: FramlitClient) {
  const projects = await client.listProjects();

  if (projects.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'No projects found. Create one with framlit_create_project.',
        },
      ],
    };
  }

  const list = projects
    .map((p) => `- **${p.name}** (${p.id})\n  Format: ${p.format}, Duration: ${p.duration}s\n  Updated: ${p.updatedAt}`)
    .join('\n\n');

  return {
    content: [
      {
        type: 'text',
        text: `Found ${projects.length} project(s):\n\n${list}`,
      },
    ],
  };
}

export async function handleGetProject(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const projectId = args.projectId as string;
  const project = await client.getProject(projectId);

  return {
    content: [
      {
        type: 'text',
        text: `**${project.name}**\n\nFormat: ${project.format}\nDuration: ${project.duration}s\nFPS: ${project.fps}\n\nCode:\n\`\`\`tsx\n${project.code}\n\`\`\``,
      },
    ],
  };
}

export async function handleCreateProject(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const name = args.name as string;
  const code = args.code as string | undefined;
  const format = args.format as 'landscape' | 'portrait' | 'square' | undefined;

  const project = await client.createProject({ name, code, format });

  return {
    content: [
      {
        type: 'text',
        text: `Project created!\n\n**${project.name}** (${project.id})\n\nView at: https://framlit.app/dashboard?project=${project.id}`,
      },
    ],
  };
}

export async function handleUpdateProject(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const projectId = args.projectId as string;
  const name = args.name as string | undefined;
  const code = args.code as string | undefined;

  const project = await client.updateProject(projectId, { name, code });

  return {
    content: [
      {
        type: 'text',
        text: `Project updated!\n\n**${project.name}** (${project.id})\n\nView at: https://framlit.app/dashboard?project=${project.id}`,
      },
    ],
  };
}
