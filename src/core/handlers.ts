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

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

export async function handleBatchCreate(
  client: FramlitClient,
  args: { rows: string; templateId?: string; templateCode?: string }
): Promise<HandlerResult> {
  const rows = JSON.parse(args.rows);
  const result = await client.createBatch({ rows, templateId: args.templateId, templateCode: args.templateCode });

  return {
    data: result,
    message: `Batch job created!\n\nJob ID: ${result.jobId}\nTotal videos: ${result.totalRows}\nEstimated credits: ${result.estimatedCredits}\n\nUse framlit_batch_start to begin rendering.`,
  };
}

export async function handleBatchStart(
  client: FramlitClient,
  args: { jobId: string }
): Promise<HandlerResult> {
  const result = await client.startBatch(args.jobId);

  if (result.status === 'completed') {
    const completed = result.results?.filter(r => r.status === 'completed') || [];
    const failed = result.results?.filter(r => r.status === 'failed') || [];
    let message = `Batch completed!\n\n${completed.length} videos rendered, ${failed.length} failed.\n`;
    for (const r of completed) {
      message += `\n- ${r.filename}: ${r.videoUrl}`;
    }
    return { data: result, message };
  }

  return { data: result, message: `Batch status: ${result.status}` };
}

export async function handleBatchStatus(
  client: FramlitClient,
  args: { jobId: string }
): Promise<HandlerResult> {
  const result = await client.getBatchStatus(args.jobId);

  let message = `Batch ${args.jobId}\nStatus: ${result.status}`;
  if (result.progress !== undefined) message += ` (${result.progress}%)`;
  if (result.results) {
    const completed = result.results.filter(r => r.status === 'completed');
    if (completed.length > 0) {
      message += `\n\nCompleted videos:`;
      for (const r of completed) {
        message += `\n- ${r.filename}: ${r.videoUrl}`;
      }
    }
  }

  return { data: result, message };
}

export async function handleBatchList(
  client: FramlitClient
): Promise<HandlerResult> {
  const jobs = await client.listBatches();

  if (jobs.length === 0) {
    return { data: jobs, message: 'No batch jobs found.' };
  }

  const list = jobs
    .map(j => `- ${j.jobId} (${j.status}) — ${j.totalRows} videos, ${j.progress || 0}%`)
    .join('\n');

  return { data: jobs, message: `Found ${jobs.length} batch job(s):\n\n${list}` };
}

export async function handleBatchCancel(
  client: FramlitClient,
  args: { jobId: string }
): Promise<HandlerResult> {
  const result = await client.cancelBatch(args.jobId);

  return {
    data: result,
    message: `Batch cancelled. ${result.completedRows || 0} videos completed, ${result.refundedCredits || 0} credits refunded.`,
  };
}

// ---------------------------------------------------------------------------
// Style Variations
// ---------------------------------------------------------------------------

export async function handleGenerateVariations(
  client: FramlitClient,
  args: { projectId: string; prompt: string; styles?: string; existingCode?: string; model?: string }
): Promise<HandlerResult> {
  const styles = args.styles ? args.styles.split(',').map(s => s.trim()) : undefined;
  const result = await client.generateVariations({
    projectId: args.projectId,
    prompt: args.prompt,
    styles,
    existingCode: args.existingCode,
    model: args.model as 'sonnet' | 'haiku' | undefined,
  });

  let message = `Generated ${result.totalGenerated} style variation(s) (${result.creditsUsed} credits used, ${result.creditsRemaining} remaining):\n`;
  for (const v of result.variations) {
    message += `\n- ${v.style} (${v.id}): ${v.aiReasoning}`;
  }
  if (result.errors?.length) {
    message += `\n\nFailed: ${result.errors.map(e => `${e.style}: ${e.error}`).join(', ')}`;
  }
  message += `\n\nUse framlit_apply_variation to apply a style to the project.`;

  return { data: result, message };
}

export async function handleListVariations(
  client: FramlitClient,
  args: { projectId: string }
): Promise<HandlerResult> {
  const result = await client.listVariations(args.projectId);

  if (result.totalCount === 0) {
    return { data: result, message: 'No variations found. Use framlit_generate_variations to create them.' };
  }

  const list = result.variations
    .map(v => `- ${v.style} (${v.id})${v.selected ? ' [SELECTED]' : ''}: ${v.aiReasoning || ''}`)
    .join('\n');

  return { data: result, message: `Found ${result.totalCount} variation(s):\n\n${list}` };
}

export async function handleApplyVariation(
  client: FramlitClient,
  args: { projectId: string; variationId: string }
): Promise<HandlerResult> {
  const result = await client.applyVariation(args.projectId, args.variationId);

  return {
    data: result,
    message: `Applied ${result.style} style to project ${result.projectId}. The project code has been updated.`,
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
// Campaign Agent
// ---------------------------------------------------------------------------

export async function handleCampaignPlan(
  client: FramlitClient,
  args: { brief: string },
): Promise<HandlerResult> {
  const result = await client.campaignPlan(args);
  const segLines = result.plan.segments
    .map(
      (s, i) =>
        `  ${i + 1}. ${s.name} — ${s.audience} (${s.ad_count} ads, styles: ${s.recommended_styles.join('/')})`,
    )
    .join('\n');
  const message = `Campaign plan: ${result.plan.campaign_name}
${result.plan.summary}

Segments:
${segLines}

Total ads: ${result.plan.total_ads} · Estimated credits: ${result.plan.estimated_credits}
Charged for plan: ${result.creditsSpent} credits

Pass the returned \`plan\` object to \`framlit campaign execute\` to fan out.`;
  return { data: result, message };
}

export async function handleCampaignExecute(
  client: FramlitClient,
  args: { plan?: unknown },
): Promise<HandlerResult> {
  if (!args.plan) {
    throw new Error('plan is required (pass the JSON returned from framlit_campaign_plan)');
  }
  // Server re-validates shape — we just need a typed cast here.
  const result = await client.campaignExecute({
    plan: args.plan as Parameters<FramlitClient['campaignExecute']>[0]['plan'],
  });
  const message = `Campaign run ${result.runId}: ${result.succeeded}/${result.total} segments succeeded (${result.creditsSpent} credits charged).`;
  return { data: result, message };
}

export async function handleListCampaignRuns(
  client: FramlitClient,
): Promise<HandlerResult> {
  const runs = await client.listCampaignRuns();
  if (runs.length === 0) {
    return { data: { runs: [] }, message: 'No campaign runs yet.' };
  }
  const lines = runs
    .map(
      (r) =>
        `- ${r.id.slice(0, 8)} · ${r.status} · ${r.plan?.campaign_name ?? '(no name)'} · ${new Date(r.created_at).toLocaleDateString()}`,
    )
    .join('\n');
  return { data: { runs }, message: `${runs.length} campaign run(s):\n\n${lines}` };
}

export async function handleGetCampaignRun(
  client: FramlitClient,
  args: { runId: string },
): Promise<HandlerResult> {
  const result = await client.getCampaignRun(args.runId);
  const succeeded = result.variations.filter((v) => v.code).length;
  const message = `Run ${args.runId.slice(0, 8)} (${result.run.status}): ${succeeded}/${result.variations.length} variations · ${result.projects.length} linked project(s)`;
  return { data: result, message };
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

// ---------------------------------------------------------------------------
// Shopify
// ---------------------------------------------------------------------------

export async function handleListShopifyProducts(
  client: FramlitClient,
): Promise<HandlerResult> {
  const products = await client.listShopifyProducts();
  if (products.length === 0) {
    return {
      data: { products: [] },
      message: 'No Shopify products synced. Connect a store at https://framlit.app/dashboard then run `framlit shopify products` again.',
    };
  }
  const sample = products
    .slice(0, 10)
    .map((p) => `- ${p.title} ($${p.price_amount ?? '?'})`)
    .join('\n');
  const more = products.length > 10 ? `\n…and ${products.length - 10} more` : '';
  return {
    data: { products },
    message: `${products.length} Shopify product(s):\n\n${sample}${more}`,
  };
}
