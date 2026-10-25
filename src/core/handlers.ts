/**
 * Core Handlers
 *
 * Pure handler functions shared by MCP and CLI.
 * Each handler takes (client, args) and returns a HandlerResult.
 */

import { FramlitClient } from '../api/client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HandlerResult {
  data: unknown;
  message: string;
  isError?: boolean;
}

// ---------------------------------------------------------------------------
// Code generation
// ---------------------------------------------------------------------------

export async function handleGenerateCode(
  client: FramlitClient,
  args: {
    prompt: string;
    format?: 'landscape' | 'portrait' | 'square';
    /**
     * When set, the server forces the generate_product_image tool to be
     * called before writing code — produces a real product image (FLUX-schnell
     * or GPT Image 2) instead of leaving the AI to hallucinate or paint CSS.
     * Adds 3 cr (flux-schnell) or 12 cr (gpt-image-2) on top of the base 1 cr.
     */
    imageGen?: { enabled: boolean; model?: 'flux-schnell' | 'gpt-image-2' };
  }
): Promise<HandlerResult> {
  const result = await client.generateCode(args);

  let message = `Generated Remotion code (${result.creditsUsed} credit${result.creditsUsed === 1 ? '' : 's'} used, ${result.creditsRemaining} remaining):\n\n\`\`\`tsx\n${result.code}\n\`\`\``;
  if (result.previewUrl) {
    message += `\n\nPreview: ${result.previewUrl}\nOpen the link above to see the video preview (expires in 24h)`;
  }

  return { data: result, message };
}

export async function handleModifyCode(
  client: FramlitClient,
  args: { code: string; instruction: string }
): Promise<HandlerResult> {
  const result = await client.modifyCode(args);

  let message = `Modified code (${result.creditsUsed} credit used, ${result.creditsRemaining} remaining):\n\n\`\`\`tsx\n${result.code}\n\`\`\``;
  if (result.previewUrl) {
    message += `\n\nPreview: ${result.previewUrl}\nOpen the link above to see the video preview (expires in 24h)`;
  }

  return { data: result, message };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function handleListProjects(
  client: FramlitClient
): Promise<HandlerResult> {
  const projects = await client.listProjects();

  if (projects.length === 0) {
    return { data: projects, message: 'No projects found. Create one with framlit_create_project.' };
  }

  const list = projects
    .map((p) => `- ${p.name} (${p.id})\n  Format: ${p.format}, Duration: ${p.duration}s\n  Updated: ${p.updatedAt}`)
    .join('\n\n');

  return { data: projects, message: `Found ${projects.length} project(s):\n\n${list}` };
}

export async function handleGetProject(
  client: FramlitClient,
  args: { projectId: string }
): Promise<HandlerResult> {
  const project = await client.getProject(args.projectId);

  return {
    data: project,
    message: `${project.name}\n\nFormat: ${project.format}\nDuration: ${project.duration}s\nFPS: ${project.fps}\n\nCode:\n\`\`\`tsx\n${project.code}\n\`\`\``,
  };
}

export async function handleCreateProject(
  client: FramlitClient,
  args: { name: string; code?: string; format?: 'landscape' | 'portrait' | 'square' }
): Promise<HandlerResult> {
  const project = await client.createProject(args);

  return {
    data: project,
    message: `Project created!\n\n${project.name} (${project.id})\n\nView at: https://framlit.app/dashboard?project=${project.id}`,
  };
}

export async function handleUpdateProject(
  client: FramlitClient,
  args: { projectId: string; name?: string; code?: string }
): Promise<HandlerResult> {
  const { projectId, ...params } = args;
  const project = await client.updateProject(projectId, params);

  return {
    data: project,
    message: `Project updated!\n\n${project.name} (${project.id})\n\nView at: https://framlit.app/dashboard?project=${project.id}`,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export async function handleRenderVideo(
  client: FramlitClient,
  args: { projectId: string }
): Promise<HandlerResult> {
  const result = await client.renderVideo(args.projectId);

  if (result.status === 'failed') {
    return { data: result, message: `Render failed: ${result.error}`, isError: true };
  }

  return {
    data: result,
    message: `Render started!\n\nRender ID: ${result.renderId}\nStatus: ${result.status}\n\nUse framlit_get_render_status to check progress.`,
  };
}

export async function handleGetRenderStatus(
  client: FramlitClient,
  args: { renderId: string }
): Promise<HandlerResult> {
  const result = await client.getRenderStatus(args.renderId);

  if (result.status === 'completed' && result.downloadUrl) {
    return { data: result, message: `Render completed!\n\nDownload: ${result.downloadUrl}` };
  }

  if (result.status === 'failed') {
    return { data: result, message: `Render failed: ${result.error}`, isError: true };
  }

  const progress = result.progress ? ` (${Math.round(result.progress * 100)}%)` : '';

  return { data: result, message: `Render status: ${result.status}${progress}` };
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export async function handleListTemplates(
  client: FramlitClient,
  args: { category?: string; official?: boolean }
): Promise<HandlerResult> {
  const templates = await client.listTemplates(args);

  if (templates.length === 0) {
    return { data: templates, message: 'No templates found matching your criteria.' };
  }

  const list = templates
    .map((t) => `- ${t.name} ${t.isOfficial ? '(Official)' : '(Community)'}\n  ${t.description}\n  Category: ${t.category}`)
    .join('\n\n');

  return {
    data: templates,
    message: `Found ${templates.length} template(s):\n\n${list}\n\nView all templates at https://framlit.app/marketplace`,
  };
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export async function handleGetCredits(
  client: FramlitClient
): Promise<HandlerResult> {
  const userInfo = await client.getUserInfo();

  const planNames: Record<string, string> = {
    free: 'Free', hobby: 'Free', pro: 'Editor Pro', team: 'Studio',
  };
  const planName = planNames[userInfo.planTier] ?? userInfo.planTier;

  let message = `Credit Balance\n\n`;
  message += `Remaining: ${userInfo.creditsRemaining} / ${userInfo.creditsTotal} credits\n`;
  message += `Used: ${userInfo.creditsUsed} credits\n\n`;
  message += `Plan: ${planName}\n`;
  message += `- Max projects: ${userInfo.limits.maxProjects}\n`;
  message += `- Max render duration: ${userInfo.limits.maxRenderDuration}s\n`;
  message += `- Watermark: ${userInfo.limits.hasWatermark ? 'Yes' : 'No'}\n`;

  if (userInfo.creditsRemaining <= 10) {
    message += `\nLow credits! Get more at https://framlit.app/docs/pricing`;
  }

  if (userInfo.planTier === 'free' || userInfo.planTier === 'hobby') {
    message += `\n\nUpgrade to Editor Pro for 300 credits/month and no watermark: https://framlit.app/docs/pricing`;
  }

  return { data: userInfo, message };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export async function handlePreviewCode(
  client: FramlitClient,
  args: { code: string }
): Promise<HandlerResult> {
  const result = await client.createPreview(args.code);

  return {
    data: result,
    message: `Preview created!\n\nPreview URL: ${result.previewUrl}\n\nOpen the link above in your browser to see the video preview.\n\nExpires in 24 hours`,
  };
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

export async function handleCreateScene(
  client: FramlitClient,
  args: { scene: string; name?: string; projectId?: string }
): Promise<HandlerResult> {
  let scene: unknown;
  try {
    scene = JSON.parse(args.scene);
  } catch (error) {
    throw new Error(`scene is not valid JSON: ${error instanceof Error ? error.message : 'parse error'}`);
  }
  const result = await client.createScene({ scene, name: args.name, projectId: args.projectId });
  const preview = result.previewUrl ? `\nPreview: ${result.previewUrl}` : '';
  return {
    data: result,
    message: `Scene compiled into an editable project (${result.layers} layers, ${result.durationInFrames} frames).\n\nProject: ${result.projectId}\nEdit: ${result.editorUrl}${preview}\n\nRender with framlit_render_video once it looks right.`,
  };
}

export async function handleGetScene(
  client: FramlitClient,
  args: { projectId: string }
): Promise<HandlerResult> {
  const result = await client.getScene(args.projectId);
  const note = result.complete
    ? 'Change it and send it back with framlit_create_scene and the same projectId.'
    : 'This project was not made from a scene: only its canvas, layers and motion are included. Sending it back replaces the original design.';
  return {
    data: result,
    message: `${note}\n\n\`\`\`json\n${JSON.stringify(result.scene, null, 2)}\n\`\`\``,
  };
}

// ---------------------------------------------------------------------------
// Narrated ads
// ---------------------------------------------------------------------------

export async function handleGenerateNarratedAd(
  client: FramlitClient,
  args: {
    brief: string;
    productImageUrl?: string | null;
    targetSeconds?: number;
    voiceId?: string;
    language?: 'en' | 'ko';
    brandDnaId?: string | null;
  },
): Promise<HandlerResult> {
  const result = await client.generateNarratedAd(args);
  const seconds = result.audio?.durationMs
    ? `${(result.audio.durationMs / 1000).toFixed(1)}s`
    : '?s';
  const sceneCount = result.storyboard?.scenes.length ?? 0;
  const message = `Narrated ad ready (${result.creditsCharged} credits charged):
  Project: ${result.projectId}
  Audio:   ${seconds} (${result.audio?.wordCount ?? 0} words)
  Scenes:  ${sceneCount} (storyboard-anchored, non-overlapping)
  Code:    ${result.code.tsx.length} chars

Open in editor: https://framlit.app/dashboard/editor?project=${result.projectId}`;
  return { data: result, message };
}

export async function handleGetNarrationCap(
  client: FramlitClient,
): Promise<HandlerResult> {
  const cap = await client.getNarrationCap();
  const tier = cap.tier;
  const status = cap.allowed ? 'OK' : 'BLOCKED';
  const message = `Narration cap: ${cap.used}/${cap.cap} used this month (${cap.remaining} left) — ${status} on ${tier} plan`;
  return { data: cap, message };
}

export async function handleGetNarratedAdStages(
  client: FramlitClient,
  args: { projectId: string; format?: 'json' | 'md' },
): Promise<HandlerResult> {
  const format = args.format ?? 'json';
  const result = await client.getNarratedAdStages(args.projectId, format);
  if (format === 'md') {
    // Markdown bundle — print as-is.
    return { data: { markdown: result }, message: result as string };
  }
  // Pre-narrowed by the format check above; this branch is the JSON shape.
  const stages = result as unknown as Record<string, unknown>;
  const present: string[] = [];
  if (stages.script) present.push('script');
  if (stages.audio) present.push('audio');
  if (stages.storyboard) present.push('storyboard');
  if (stages.code) present.push('code');
  const message = `Stages for ${args.projectId}: ${present.length > 0 ? present.join(', ') : '(none)'}`;
  return { data: stages, message };
}

// ---------------------------------------------------------------------------
// Brand DNA
// ---------------------------------------------------------------------------

export async function handleGetBrand(
  client: FramlitClient,
): Promise<HandlerResult> {
  const result = await client.getBrand();
  const b = result.brand;
  const message = `Brand: ${b.brand_name ?? '(unnamed)'} · ${b.brand_colors.length} colors · ${b.tone_examples.length} tone examples · plan: ${result.plan.tier}`;
  return { data: result, message };
}

export async function handleSetBrand(
  client: FramlitClient,
  args: Parameters<FramlitClient['setBrand']>[0],
): Promise<HandlerResult> {
  const result = await client.setBrand(args);
  return { data: result, message: 'Brand profile updated.' };
}
