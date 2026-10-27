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
  category:
    | 'generate'
    | 'project'
    | 'render'
    | 'template'
    | 'credits'
    | 'preview'
    | 'narration'
    | 'brand'
    | 'scene';
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TOOL_REGISTRY: ToolEntry[] = [
  // Code generation
  {
    name: 'framlit_generate_code',
    description: `Generate Remotion video code from a text description.
Costs 1 credit base. With imageGen.enabled: +3 cr (flux-schnell) or +12 cr (gpt-image-2) for AI product image generation.

The generated code is a valid Remotion composition that can be previewed in browser, rendered to MP4, or saved as a project.

Supports: logo animations, product demos, social media content, data visualizations, 3D animations, and narrated videos.

When the user mentions "product" / "showcase" / "ad" but does not have a product photo, set imageGen.enabled = true so the agent calls generate_product_image first instead of hallucinating an image URL or painting a CSS placeholder.`,
    schema: schemas.generateCodeSchema,
    handler: (c, a) => handlers.handleGenerateCode(c, a as z.infer<typeof schemas.generateCodeSchema>),
    credits: 1, // base cost; +3 (flux) or +12 (gpt-image-2) when imageGen.enabled — see description
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

  // Scenes (the open format)
  {
    name: 'framlit_create_scene',
    description: `Turn a Framlit Scene v1 (JSON) into an editable Framlit project. No credits.

Use this when you want to design the video yourself instead of asking Framlit's AI to: describe the canvas, background, and every layer's position, size, text or media, timing, and entrance/exit preset. Framlit compiles it to Remotion code; the user can then drag layers, record motion, and retime them in the editor, and you can render it with framlit_render_video.

Minimal scene:
{"version":1,"canvas":{"width":1080,"height":1920,"durationInFrames":150},"background":{"color":"#0f172a"},
 "layers":[{"id":"headline","type":"text","text":"Ship faster","x":80,"y":300,"width":920,"height":240,"style":{"fontFamily":"Poppins","fontSize":120,"fontWeight":800,"color":"#ffffff"},"enter":{"preset":"rise"}}]}

Layer types: text, image, video, shape. Media must be https URLs. Presets: fade, rise, pop, slideLeft, slideRight, wipe. Optional "motion": [{"layerId","points":[{"frame","x","y"}]}] (offsets in px).
Full schema: https://framlit.app/schemas/framlit-scene.v1.json`,
    schema: schemas.createSceneSchema,
    handler: (c, a) => handlers.handleCreateScene(c, a as z.infer<typeof schemas.createSceneSchema>),
    credits: 0,
    category: 'scene',
  },
  {
    name: 'framlit_get_scene',
    description: `Read a project as a Framlit Scene v1, including the edits people made in the editor (moved layers, changed timing, recorded motion). Change it and send it back with framlit_create_scene and the same projectId. No credits.`,
    schema: schemas.getSceneSchema,
    handler: (c, a) => handlers.handleGetScene(c, a as z.infer<typeof schemas.getSceneSchema>),
    credits: 0,
    category: 'scene',
  },

  // Rendering
  {
    name: 'framlit_render_video',
    description: `Start rendering a project to MP4 video.
Rendering is done on Framlit servers (AWS Lambda).

Note: Free plan videos include a watermark. Upgrade to Editor Pro to remove the watermark.`,
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

  // Narrated ads (HyperFrame-style 3-stage pipeline)
  {
    name: 'framlit_generate_narrated_ad',
    description: `Generate a full narrated ad (script + voiceover + word-synced visuals).
Editor Pro and Studio only. Costs 3 credits + counts against the monthly cap (25/month on Editor Pro, 100 on Studio).
Pipeline: Haiku writes the script, Kokoro TTS records the voiceover with word-level alignment, a deterministic storyboard step computes non-overlapping scene boundaries, Sonnet generates Remotion code anchoring reveals to spoken words. ~90-180s wall time.
Returns the new projectId, audio URL, storyboard scenes, and generated TSX.`,
    schema: schemas.generateNarratedAdSchema,
    handler: (c, a) =>
      handlers.handleGenerateNarratedAd(
        c,
        a as z.infer<typeof schemas.generateNarratedAdSchema>,
      ),
    credits: 3,
    category: 'narration',
  },
  {
    name: 'framlit_get_narration_cap',
    description:
      'Get current month narrated-ad usage and remaining cap. Free, instant — useful as a pre-flight before spending credits.',
    schema: schemas.narrationCapSchema,
    handler: (c) => handlers.handleGetNarrationCap(c),
    credits: 0,
    category: 'narration',
  },
  {
    name: 'framlit_get_narrated_ad_stages',
    description:
      'Inspect the script + audio + storyboard + code stage outputs of a narrated-ad project. JSON by default; pass format="md" for the markdown bundle.',
    schema: schemas.narratedAdStagesSchema,
    handler: (c, a) =>
      handlers.handleGetNarratedAdStages(
        c,
        a as z.infer<typeof schemas.narratedAdStagesSchema>,
      ),
    credits: 0,
    category: 'narration',
  },

  // Brand DNA
  {
    name: 'framlit_get_brand',
    description:
      'Get the effective brand profile (workspace brand wins over user-level). Free. Use to build brand-aware codegen prompts before calling framlit_generate_code.',
    schema: schemas.getBrandSchema,
    handler: (c) => handlers.handleGetBrand(c),
    credits: 0,
    category: 'brand',
  },
  {
    name: 'framlit_set_brand',
    description: `Upsert the user's personal brand profile (colors, fonts, tone, do-nots, archetypes).
Free tier: brand_name + fonts + up to 3 colors + logo only.
Pro tier: everything including tone_examples, do_nots, past_ad_urls, product_archetypes.`,
    schema: schemas.setBrandSchema,
    handler: (c, a) =>
      handlers.handleSetBrand(c, a as z.infer<typeof schemas.setBrandSchema>),
    credits: 0,
    category: 'brand',
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
 * A tool's input as JSON Schema, for MCP clients and CLI introspection.
 * Describes what callers may send, so fields with defaults are optional.
 */
export function zodToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const jsonSchema: Record<string, unknown> = z.toJSONSchema(schema, { io: 'input' });
  delete jsonSchema.$schema;
  return jsonSchema;
}
