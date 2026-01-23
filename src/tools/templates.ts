/**
 * Template Tools
 * 
 * Tools for browsing Framlit templates.
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { FramlitClient } from '../api/client.js';

export const listTemplatesTool: Tool = {
  name: 'framlit_list_templates',
  description: `Browse available video templates.
Templates can be used as starting points for your videos.`,
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category (e.g., "social", "product", "logo").',
      },
      official: {
        type: 'boolean',
        description: 'If true, only show official Framlit templates. If false, show community templates.',
      },
    },
    required: [],
  },
};

export async function handleListTemplates(
  client: FramlitClient,
  args: Record<string, unknown>
) {
  const category = args.category as string | undefined;
  const official = args.official as boolean | undefined;

  const templates = await client.listTemplates({ category, official });

  if (templates.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'No templates found matching your criteria.',
        },
      ],
    };
  }

  const list = templates
    .map((t) => `- **${t.name}** ${t.isOfficial ? '(Official)' : '(Community)'}\n  ${t.description}\n  Category: ${t.category}`)
    .join('\n\n');

  return {
    content: [
      {
        type: 'text',
        text: `Found ${templates.length} template(s):\n\n${list}\n\n💡 View all templates at https://framlit.app/marketplace`,
      },
    ],
  };
}
