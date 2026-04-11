/**
 * Tool Registry
 *
 * Central registry mapping tool names to schemas, handlers, and metadata.
 * Used by both MCP server and CLI for tool discovery and dispatch.
 */

import { z } from 'zod';
import type { FramlitClient } from '../api/client.js';
import type { HandlerResult } from './handlers.js';
import * as schemas from './schemas.js';
import * as handlers from './handlers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolEntry {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (client: FramlitClient, args: Record<string, unknown>) => Promise<HandlerResult>;
  credits: number | string;
  category: 'generate' | 'project' | 'render' | 'template' | 'credits' | 'preview' | 'batch';
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TOOL_REGISTRY: ToolEntry[] = [
  // Code generation
  {
    name: 'framlit_generate_code',
    description: `Generate Remotion video code from a text description.
Uses 1 credit per generation.

The generated code is a valid Remotion composition that can be previewed in browser, rendered to MP4, or saved as a project.

Supports: logo animations, product demos, social media content, data visualizations, 3D animations, narrated videos, and style variations.`,
    schema: schemas.generateCodeSchema,
    handler: (c, a) => handlers.handleGenerateCode(c, a as z.infer<typeof schemas.generateCodeSchema>),
    credits: 1,
    category: 'generate',
  },
  {
    name: 'framlit_modify_code',
    description: `Modify existing Remotion code based on instructions.
Uses 1 credit per modification.

Use this to change colors, fonts, timing, animations, add/remove elements, or fix issues in generated code.`,
    schema: schemas.modifyCodeSchema,
    handler: (c, a) => handlers.handleModifyCode(c, a as z.infer<typeof schemas.modifyCodeSchema>),
    credits: 1,
    category: 'generate',
  },

  // Projects
  {
    name: 'framlit_list_projects',
    description: 'List all your Framlit projects.',
    schema: schemas.listProjectsSchema,
    handler: (c) => handlers.handleListProjects(c),
    credits: 0,
    category: 'project',
  },
  {
    name: 'framlit_get_project',
    description: 'Get details of a specific project including its code.',
    schema: schemas.getProjectSchema,
    handler: (c, a) => handlers.handleGetProject(c, a as z.infer<typeof schemas.getProjectSchema>),
    credits: 0,
    category: 'project',
  },
  {
    name: 'framlit_create_project',
    description: `Create a new Framlit project.
Projects store your video code and can be rendered to MP4.`,
    schema: schemas.createProjectSchema,
    handler: (c, a) => handlers.handleCreateProject(c, a as z.infer<typeof schemas.createProjectSchema>),
    credits: 0,
    category: 'project',
  },
  {
    name: 'framlit_update_project',
    description: 'Update an existing project.',
    schema: schemas.updateProjectSchema,
    handler: (c, a) => handlers.handleUpdateProject(c, a as z.infer<typeof schemas.updateProjectSchema>),
    credits: 0,
    category: 'project',
  },

  // Rendering
  {
    name: 'framlit_render_video',
    description: `Start rendering a project to MP4 video.
Rendering is done on Framlit servers (AWS Lambda).

Note: Free/Hobby plans include a watermark. Upgrade to Pro to remove the watermark.`,
    schema: schemas.renderVideoSchema,
    handler: (c, a) => handlers.handleRenderVideo(c, a as z.infer<typeof schemas.renderVideoSchema>),
    credits: 0,
    category: 'render',
  },
  {
    name: 'framlit_get_render_status',
    description: 'Check the status of a video render. Returns status, progress percentage, and download URL when completed.',
    schema: schemas.getRenderStatusSchema,
    handler: (c, a) => handlers.handleGetRenderStatus(c, a as z.infer<typeof schemas.getRenderStatusSchema>),
    credits: 0,
    category: 'render',
  },

  // Templates
  {
    name: 'framlit_list_templates',
    description: `Browse available video templates.
Templates can be used as starting points for your videos.`,
    schema: schemas.listTemplatesSchema,
    handler: (c, a) => handlers.handleListTemplates(c, a as z.infer<typeof schemas.listTemplatesSchema>),
    credits: 0,
    category: 'template',
  },

  // Credits
  {
    name: 'framlit_get_credits',
    description: 'Check your current credit balance, usage, and plan details.',
    schema: schemas.getCreditsSchema,
    handler: (c) => handlers.handleGetCredits(c),
    credits: 0,
    category: 'credits',
  },

  // Preview
  {
    name: 'framlit_preview_code',
    description: `Create a temporary preview URL for Remotion code.
The preview URL can be opened in a browser to see the video.

Preview URLs expire after 24 hours. No credits are consumed.`,
    schema: schemas.previewCodeSchema,
    handler: (c, a) => handlers.handlePreviewCode(c, a as z.infer<typeof schemas.previewCodeSchema>),
    credits: 0,
    category: 'preview',
  },

  // Batch
  {
    name: 'framlit_batch_create',
    description: `Create a batch video generation job from product data rows.
Each row becomes one personalized video. Costs 0.2 credits per video.

Pass rows as a JSON array string. Each object's keys map to template props (e.g., productName, price, productImage).

Example rows: [{"productName":"Sneaker","price":"$99","productImage":"https://..."}]`,
    schema: schemas.createBatchSchema,
    handler: (c, a) => handlers.handleBatchCreate(c, a as z.infer<typeof schemas.createBatchSchema>),
    credits: '0.2/video',
    category: 'batch',
  },
  {
    name: 'framlit_batch_start',
    description: `Start rendering a batch job. All videos are rendered on AWS Lambda.
Returns results with download URLs when complete. This may take several minutes for large batches.`,
    schema: schemas.batchJobIdSchema,
    handler: (c, a) => handlers.handleBatchStart(c, a as z.infer<typeof schemas.batchJobIdSchema>),
    credits: 0,
    category: 'batch',
  },
  {
    name: 'framlit_batch_status',
    description: 'Check the status of a batch job and get download URLs for completed videos.',
    schema: schemas.batchJobIdSchema,
    handler: (c, a) => handlers.handleBatchStatus(c, a as z.infer<typeof schemas.batchJobIdSchema>),
    credits: 0,
    category: 'batch',
  },
  {
    name: 'framlit_batch_list',
    description: 'List all your batch jobs with their status and progress.',
    schema: schemas.listBatchesSchema,
    handler: (c) => handlers.handleBatchList(c),
    credits: 0,
    category: 'batch',
  },
  {
    name: 'framlit_batch_cancel',
    description: 'Cancel a pending or processing batch job. Unprocessed videos are refunded.',
    schema: schemas.batchJobIdSchema,
    handler: (c, a) => handlers.handleBatchCancel(c, a as z.infer<typeof schemas.batchJobIdSchema>),
    credits: 0,
    category: 'batch',
  },

  // Style Variations
  {
    name: 'framlit_generate_variations',
    description: `Generate style variations of a video for A/B testing.
Each variation applies a different visual style (minimal, bold, dynamic, cinematic, energetic, playful).
Costs 1 credit per variation. Free plan: 2 max, Pro: 5, Team: 10.`,
    schema: schemas.generateVariationsSchema,
    handler: (c, a) => handlers.handleGenerateVariations(c, a as z.infer<typeof schemas.generateVariationsSchema>),
    credits: '1/variation',
    category: 'generate',
  },
  {
    name: 'framlit_list_variations',
    description: 'List all style variations for a project.',
    schema: schemas.listVariationsSchema,
    handler: (c, a) => handlers.handleListVariations(c, a as z.infer<typeof schemas.listVariationsSchema>),
    credits: 0,
    category: 'generate',
  },
  {
    name: 'framlit_apply_variation',
    description: 'Apply a style variation to a project. Updates the project code with the selected variation.',
    schema: schemas.applyVariationSchema,
    handler: (c, a) => handlers.handleApplyVariation(c, a as z.infer<typeof schemas.applyVariationSchema>),
    credits: 0,
    category: 'generate',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getToolByName(name: string): ToolEntry | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

export function getToolNames(): string[] {
  return TOOL_REGISTRY.map((t) => t.name);
}

/**
 * Convert a Zod schema to JSON Schema (simple implementation for CLI introspection).
 */
export function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const shape = schema.shape;
  const properties: Record<string, Record<string, unknown>> = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodValue = value as z.ZodTypeAny;
    const prop: Record<string, unknown> = {};

    // Unwrap optional
    let inner = zodValue;
    let isOptional = false;
    if (inner instanceof z.ZodOptional) {
      isOptional = true;
      inner = inner.unwrap();
    }

    // Determine type
    if (inner instanceof z.ZodString) {
      prop.type = 'string';
    } else if (inner instanceof z.ZodNumber) {
      prop.type = 'number';
    } else if (inner instanceof z.ZodBoolean) {
      prop.type = 'boolean';
    } else if (inner instanceof z.ZodEnum) {
      prop.type = 'string';
      prop.enum = inner.options;
    } else {
      prop.type = 'string';
    }

    if (zodValue.description) {
      prop.description = zodValue.description;
    }

    properties[key] = prop;
    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}
