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
  code: z.string().optional().describe('Optional initial Remotion code.'),
  format: videoFormat.describe('Video format. Defaults to landscape.'),
});

export const updateProjectSchema = z.object({
  projectId: z.string().describe('The project ID.'),
  name: z.string().optional().describe('New name for the project.'),
  code: z.string().optional().describe('Updated Remotion code.'),
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
