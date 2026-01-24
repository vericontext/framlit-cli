/**
 * Preview Tools
 * 
 * Tools for creating and viewing Remotion previews.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { FramlitClient } from '../api/client.js';

export const previewCodeTool: Tool = {
  name: 'framlit_preview_code',
  description: `Create a temporary preview URL for Remotion code.
The preview URL can be opened in a browser to see the video.

Preview URLs expire after 24 hours.
No credits are consumed for creating previews.`,
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Remotion code to preview.',
      },
    },
    required: ['code'],
  },
};

export async function handlePreviewCode(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const code = args.code as string;

  const result = await client.createPreview(code);

  return {
    content: [
      {
        type: 'text',
        text: `Preview created!\n\n🎬 **Preview URL:** ${result.previewUrl}\n\nOpen the link above in your browser to see the video preview.\n\n_Expires in 24 hours_`,
      },
    ],
  };
}
