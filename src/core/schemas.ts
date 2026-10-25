/**
 * Tool Input Schemas (Zod)
 *
 * Shared validation schemas used by both MCP and CLI.
 * Single source of truth for tool input shapes.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

const videoFormat = z.enum(['landscape', 'portrait', 'square']).optional();

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

export const generateCodeSchema = z.object({
  prompt: z.string().describe('Description of the video to generate. Be specific about animations, colors, timing, and content.'),
  format: videoFormat.describe('Video format. Defaults to landscape (1920x1080).'),
  imageGen: z
    .object({
      enabled: z.boolean().describe('Force the agent to call generate_product_image before writing code (no hallucinated URLs, no CSS-painted products).'),
      model: z.enum(['flux-schnell', 'gpt-image-2']).optional().describe('Image-gen provider. flux-schnell (default) is fast/cheap; gpt-image-2 is premium photoreal.'),
    })
    .optional()
    .describe('Opt into AI product image generation. Adds 3 cr (flux-schnell) or 12 cr (gpt-image-2) on top of the base 1 cr.'),
});

export const modifyCodeSchema = z.object({
  code: z.string().describe('The existing Remotion code to modify.'),
  instruction: z.string().describe('Instructions for how to modify the code.'),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const listProjectsSchema = z.object({});

export const getProjectSchema = z.object({
  projectId: z.string().describe('The project ID.'),
});

export const createProjectSchema = z.object({
  name: z.string().describe('Name for the project.'),
  code: z.string().optional().describe('Optional initial Remotion code. Must be code Framlit generated (from generate/modify) or an existing project or template; other code is rejected with UNVERIFIED_CODE.'),
  format: videoFormat.describe('Video format. Defaults to landscape.'),
});

export const updateProjectSchema = z.object({
  projectId: z.string().describe('The project ID.'),
  name: z.string().optional().describe('New name for the project.'),
  code: z.string().optional().describe('Updated Remotion code. Must be code Framlit generated (from generate/modify) or an existing project or template; other code is rejected with UNVERIFIED_CODE.'),
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export const renderVideoSchema = z.object({
  projectId: z.string().describe('The project ID to render.'),
});

export const getRenderStatusSchema = z.object({
  renderId: z.string().describe('The render ID returned from framlit_render_video.'),
});

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export const listTemplatesSchema = z.object({
  category: z.string().optional().describe('Filter by category (e.g., "social", "product", "logo").'),
  official: z.boolean().optional().describe('If true, only show official Framlit templates. If false, show community templates.'),
});

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export const getCreditsSchema = z.object({});

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export const previewCodeSchema = z.object({
  code: z.string().describe('The Remotion code to preview.'),
});

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

export const createSceneSchema = z.object({
  scene: z.string().describe('Framlit Scene v1 as a JSON string. Schema: https://framlit.app/schemas/framlit-scene.v1.json'),
  name: z.string().optional().describe('Project name.'),
  projectId: z.string().optional().describe('Replace this project\'s video instead of creating a new project (e.g. after framlit_get_scene).'),
});

export const getSceneSchema = z.object({
  projectId: z.string().describe('The project ID.'),
});

// ---------------------------------------------------------------------------
// Narrated ads (HyperFrame-style 3-stage pipeline)
// ---------------------------------------------------------------------------

export const generateNarratedAdSchema = z.object({
  brief: z.string().min(5).describe('Ad brief — what the narration should say or be about. Min 5 chars.'),
  productImageUrl: z.string().url().nullish().describe('Optional product image the codegen stage can reference.'),
  targetSeconds: z.number().int().min(8).max(60).optional().describe('Target spoken duration in seconds. Default 20. Clamped to 8–60.'),
  voiceId: z.string().optional().describe('Kokoro voice ID: af_heart (default), af_bella, af_jessica, am_adam, am_michael or am_eric.'),
  language: z.enum(['en', 'ko']).optional().describe('Spoken language. "en" or "ko". Default "en".'),
  brandDnaId: z.string().nullish().describe('Reserved — workspace-scoped brand DNA selector.'),
});

export const narrationCapSchema = z.object({});

export const narratedAdStagesSchema = z.object({
  projectId: z.string().describe('The narrated-ad project ID returned from `framlit narrated`.'),
  format: z.enum(['json', 'md']).optional().describe('Output format. "json" (default) or "md" for the markdown bundle.'),
});

// ---------------------------------------------------------------------------
// Brand DNA
// ---------------------------------------------------------------------------

export const getBrandSchema = z.object({});

export const setBrandSchema = z.object({
  brand_name: z.string().nullish(),
  logo_url: z.string().url().nullish(),
  brand_colors: z
    .array(
      z.object({
        name: z.string(),
        hex: z.string().regex(/^#[0-9a-fA-F]{3,8}$/),
        role: z.string().optional(),
      }),
    )
    .optional()
    .describe('Brand colors. Free tier capped at 3.'),
  brand_fonts: z
    .object({ heading: z.string().nullable(), body: z.string().nullable() })
    .optional(),
  tone_examples: z
    .array(
      z.object({
        type: z.enum(['headline', 'body', 'cta']),
        content: z.string(),
      }),
    )
    .optional()
    .describe('Pro-only.'),
  do_nots: z.array(z.string()).optional().describe('Pro-only.'),
  past_ad_urls: z.array(z.string().url()).optional().describe('Pro-only.'),
  product_archetypes: z.array(z.string()).optional().describe('Pro-only.'),
});

