/**
 * Code Generation Tools
 * 
 * Tools for generating and modifying Remotion video code.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { FramlitClient } from '../api/client.js';

export const generateCodeTool: Tool = {
  name: 'framlit_generate_code',
  description: `Generate Remotion video code from a text description.
Uses 1 credit per generation.

The generated code is a valid Remotion composition that can be:
- Previewed in browser
- Rendered to MP4 video
- Saved as a project

Supports various video types:
- Logo animations
- Product demos
- Social media content
- Data visualizations
- 3D animations`,
  inputSchema: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Description of the video to generate. Be specific about animations, colors, timing, and content.',
      },
      format: {
        type: 'string',
        enum: ['landscape', 'portrait', 'square'],
        description: 'Video format. Defaults to landscape (1920x1080).',
      },
    },
    required: ['prompt'],
  },
};

export const modifyCodeTool: Tool = {
  name: 'framlit_modify_code',
  description: `Modify existing Remotion code based on instructions.
Uses 1 credit per modification.

Use this to:
- Change colors, fonts, or sizes
- Adjust timing and animations
- Add or remove elements
- Fix issues in generated code`,
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The existing Remotion code to modify.',
      },
      instruction: {
        type: 'string',
        description: 'Instructions for how to modify the code.',
      },
    },
    required: ['code', 'instruction'],
  },
};

export async function handleGenerateCode(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const prompt = args.prompt as string;
  const format = args.format as 'landscape' | 'portrait' | 'square' | undefined;

  const result = await client.generateCode({ prompt, format });

  let response = `Generated Remotion code (${result.creditsUsed} credit used, ${result.creditsRemaining} remaining):\n\n\`\`\`tsx\n${result.code}\n\`\`\``;
  
  if (result.previewUrl) {
    response += `\n\n🎬 **Preview:** ${result.previewUrl}\n_Open the link above to see the video preview (expires in 24h)_`;
  }

  return {
    content: [
      {
        type: 'text',
        text: response,
      },
    ],
  };
}

export async function handleModifyCode(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const code = args.code as string;
  const instruction = args.instruction as string;

  const result = await client.modifyCode({ code, instruction });

  let response = `Modified code (${result.creditsUsed} credit used, ${result.creditsRemaining} remaining):\n\n\`\`\`tsx\n${result.code}\n\`\`\``;
  
  if (result.previewUrl) {
    response += `\n\n🎬 **Preview:** ${result.previewUrl}\n_Open the link above to see the video preview (expires in 24h)_`;
  }

  return {
    content: [
      {
        type: 'text',
        text: response,
      },
    ],
  };
}
