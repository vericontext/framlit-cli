/**
 * Video Rendering Tools
 * 
 * Tools for rendering videos via AWS Lambda.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { FramlitClient } from '../api/client.js';

export const renderVideoTool: Tool = {
  name: 'framlit_render_video',
  description: `Start rendering a project to MP4 video.
Rendering is done on Framlit's servers (AWS Lambda).

Note: Free/Hobby plans include a watermark. 
Upgrade to Pro to remove the watermark.`,
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'The project ID to render.',
      },
    },
    required: ['projectId'],
  },
};

export const getRenderStatusTool: Tool = {
  name: 'framlit_get_render_status',
  description: 'Check the status of a video render.',
  inputSchema: {
    type: 'object',
    properties: {
      renderId: {
        type: 'string',
        description: 'The render ID returned from framlit_render_video.',
      },
    },
    required: ['renderId'],
  },
};

export async function handleRenderVideo(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const projectId = args.projectId as string;
  const result = await client.renderVideo(projectId);

  if (result.status === 'failed') {
    return {
      content: [
        {
          type: 'text',
          text: `Render failed: ${result.error}`,
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Render started!\n\nRender ID: ${result.renderId}\nStatus: ${result.status}\n\nUse framlit_get_render_status to check progress.`,
      },
    ],
  };
}

export async function handleGetRenderStatus(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const renderId = args.renderId as string;
  const result = await client.getRenderStatus(renderId);

  if (result.status === 'completed' && result.downloadUrl) {
    return {
      content: [
        {
          type: 'text',
          text: `Render completed!\n\nDownload: ${result.downloadUrl}`,
        },
      ],
    };
  }

  if (result.status === 'failed') {
    return {
      content: [
        {
          type: 'text',
          text: `Render failed: ${result.error}`,
        },
      ],
      isError: true,
    };
  }

  const progress = result.progress ? ` (${Math.round(result.progress * 100)}%)` : '';

  return {
    content: [
      {
        type: 'text',
        text: `Render status: ${result.status}${progress}`,
      },
    ],
  };
}
