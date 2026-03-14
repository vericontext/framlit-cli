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
  args: { prompt: string; format?: 'landscape' | 'portrait' | 'square' }
): Promise<HandlerResult> {
  const result = await client.generateCode(args);

  let message = `Generated Remotion code (${result.creditsUsed} credit used, ${result.creditsRemaining} remaining):\n\n\`\`\`tsx\n${result.code}\n\`\`\``;
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
    free: 'Free', hobby: 'Hobby', pro: 'Pro', team: 'Team',
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
    message += `\nLow credits! Get more at https://framlit.app/pricing`;
  }

  if (userInfo.planTier === 'free' || userInfo.planTier === 'hobby') {
    message += `\n\nUpgrade to Pro for 500 credits/month and no watermark: https://framlit.app/pricing`;
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
