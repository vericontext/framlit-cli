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
    | 'batch'
    | 'narration'
    | 'campaign'
    | 'brand'
    | 'shopify';
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

Supports: logo animations, product demos, social media content, data visualizations, 3D animations, narrated videos, and style variations.

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

  // Narrated ads (HyperFrame-style 3-stage pipeline)
  {
    name: 'framlit_generate_narrated_ad',
    description: `Generate a full narrated ad (script + voiceover + word-synced visuals).
Pro-only. Costs 5 credits + counts against the monthly cap (50/month on Pro).
Pipeline: Haiku writes the script, ElevenLabs records voice with word-level alignment, a deterministic storyboard step computes non-overlapping scene boundaries, Sonnet generates Remotion code anchoring reveals to spoken words. ~90-180s wall time.
Returns the new projectId, audio URL, storyboard scenes, and generated TSX.`,
    schema: schemas.generateNarratedAdSchema,
    handler: (c, a) =>
      handlers.handleGenerateNarratedAd(
        c,
        a as z.infer<typeof schemas.generateNarratedAdSchema>,
      ),
    credits: 5,
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

  // Campaign Agent (multi-segment plan + parallel fan-out)
  {
    name: 'framlit_campaign_plan',
    description: `Run the Campaign Agent to plan a multi-segment campaign from a one-line brief.
Pro-only. Costs 10 credits.
Returns a structured CampaignPlan with audience segments, hooks, recommended styles, and ad counts. Pass the plan to framlit_campaign_execute to fan out to actual videos.`,
    schema: schemas.campaignPlanSchema,
    handler: (c, a) =>
      handlers.handleCampaignPlan(c, a as z.infer<typeof schemas.campaignPlanSchema>),
    credits: 10,
    category: 'campaign',
  },
  {
    name: 'framlit_campaign_execute',
    description: `Execute a CampaignPlan — fans out to one Sonnet generation per segment in parallel. Pro-only. Costs 2 credits per segment (failed segments are not charged). Persists a campaign_run + per-segment variations. ~20-40s wall time for 2-3 segments.`,
    schema: schemas.campaignExecuteSchema,
    handler: (c, a) =>
      handlers.handleCampaignExecute(
        c,
        a as z.infer<typeof schemas.campaignExecuteSchema>,
      ),
    credits: '2/segment',
    category: 'campaign',
  },
  {
    name: 'framlit_list_campaign_runs',
    description: 'List recent campaign runs (capped at 50). Free.',
    schema: schemas.listCampaignRunsSchema,
    handler: (c) => handlers.handleListCampaignRuns(c),
    credits: 0,
    category: 'campaign',
  },
  {
    name: 'framlit_get_campaign_run',
    description:
      'Get one campaign run + its per-segment variations + linked projects. Free. Use to poll execution status or pick up generated code per segment.',
    schema: schemas.getCampaignRunSchema,
    handler: (c, a) =>
      handlers.handleGetCampaignRun(c, a as z.infer<typeof schemas.getCampaignRunSchema>),
    credits: 0,
    category: 'campaign',
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

  // Shopify
  {
    name: 'framlit_list_shopify_products',
    description:
      'List the user\'s cached Shopify product catalog (up to 500 rows). Read-only — the OAuth connect flow stays browser-only. Pair with batch create to generate ads from real product data.',
    schema: schemas.listShopifyProductsSchema,
    handler: (c) => handlers.handleListShopifyProducts(c),
    credits: 0,
    category: 'shopify',
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
