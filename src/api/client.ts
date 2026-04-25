/**
 * Framlit API Client
 * 
 * HTTP client for communicating with Framlit SaaS API.
 */

const DEFAULT_BASE_URL = 'https://framlit.app';

export interface UserInfo {
  userId: string;
  planTier: string;
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  limits: {
    maxProjects: number;
    maxRenderDuration: number;
    hasWatermark: boolean;
  };
}

export interface Project {
  id: string;
  name: string;
  code: string;
  format: 'landscape' | 'portrait' | 'square';
  duration: number;
  fps: number;
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  code: string;
  thumbnailUrl: string;
  category: string;
  isOfficial: boolean;
}

export interface RenderResult {
  renderId: string;
  status: 'pending' | 'rendering' | 'completed' | 'failed';
  progress?: number;
  downloadUrl?: string;
  error?: string;
}

export interface GenerateCodeResult {
  code: string;
  creditsUsed: number;
  creditsRemaining: number;
  previewUrl?: string;
}

export interface PreviewResult {
  previewId: string;
  previewUrl: string;
  expiresAt: string;
}

export interface BatchJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalRows: number;
  completedRows?: number;
  failedRows?: number;
  progress?: number;
  estimatedCredits?: number;
  results?: Array<{
    rowIndex: number;
    filename: string;
    status: string;
    videoUrl?: string;
    error?: string;
  }>;
  summary?: Record<string, unknown>;
  message?: string;
  refundedCredits?: number;
}

export interface Variation {
  id: string;
  style: string;
  aiReasoning: string;
  codeLength?: number;
  code?: string;
  selected?: boolean;
  createdAt?: string;
}

export interface VariationsResult {
  projectId: string;
  totalGenerated: number;
  creditsUsed: number;
  creditsRemaining: number;
  variations: Variation[];
  errors?: Array<{ style: string; error: string }>;
}

export interface UploadAssetResult {
  url: string;
  path: string;
}

export class FramlitClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || process.env.FRAMLIT_API_URL || DEFAULT_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/api/mcp${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        ...options.headers,
      },
    });

    const data = await response.json() as { data?: T; error?: string; code?: string };

    if (!response.ok) {
      const error = data.error || `Request failed with status ${response.status}`;
      
      // Handle specific error codes for upsell messages
      if (data.code === 'INSUFFICIENT_CREDITS') {
        throw new Error(
          `${error}\n\n💡 Get more credits at https://framlit.app/pricing`
        );
      }
      
      if (data.code === 'PLAN_LIMIT_EXCEEDED') {
        throw new Error(
          `${error}\n\n💡 Upgrade to Pro for more capacity at https://framlit.app/pricing`
        );
      }
      
      throw new Error(error);
    }

    return data.data as T;
  }

  /**
   * Get user info including credits and plan
   */
  async getUserInfo(): Promise<UserInfo> {
    return this.request<UserInfo>('/user');
  }

  /**
   * Generate Remotion code from a prompt
   */
  async generateCode(params: {
    prompt: string;
    format?: 'landscape' | 'portrait' | 'square';
  }): Promise<GenerateCodeResult> {
    return this.request<GenerateCodeResult>('/generate-code', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Modify existing code based on instructions
   */
  async modifyCode(params: {
    code: string;
    instruction: string;
  }): Promise<GenerateCodeResult> {
    return this.request<GenerateCodeResult>('/modify-code', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List user's projects
   */
  async listProjects(): Promise<Project[]> {
    return this.request<Project[]>('/projects');
  }

  /**
   * Get a single project
   */
  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/projects/${projectId}`);
  }

  /**
   * Create a new project
   */
  async createProject(params: {
    name: string;
    code?: string;
    format?: 'landscape' | 'portrait' | 'square';
  }): Promise<Project> {
    return this.request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Update an existing project
   */
  async updateProject(
    projectId: string,
    params: {
      name?: string;
      code?: string;
    }
  ): Promise<Project> {
    return this.request<Project>(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  /**
   * Start video rendering
   */
  async renderVideo(projectId: string): Promise<RenderResult> {
    return this.request<RenderResult>('/render', {
      method: 'POST',
      body: JSON.stringify({ projectId }),
    });
  }

  /**
   * Get render status
   */
  async getRenderStatus(renderId: string): Promise<RenderResult> {
    return this.request<RenderResult>(`/render/${renderId}`);
  }

  /**
   * List templates
   */
  async listTemplates(params?: {
    category?: string;
    official?: boolean;
  }): Promise<Template[]> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.official !== undefined) searchParams.set('official', String(params.official));
    
    const query = searchParams.toString();
    return this.request<Template[]>(`/templates${query ? `?${query}` : ''}`);
  }

  /**
   * Create a temporary preview
   */
  async createPreview(code: string): Promise<PreviewResult> {
    return this.request<PreviewResult>('/preview', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  // -------------------------------------------------------------------------
  // Batch
  // -------------------------------------------------------------------------

  /**
   * Create a batch job from rows of data
   */
  async createBatch(params: {
    rows: Record<string, string>[];
    templateId?: string;
    templateCode?: string;
  }): Promise<BatchJob> {
    return this.request<BatchJob>('/batch', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Start a batch job (triggers rendering)
   */
  async startBatch(jobId: string): Promise<BatchJob> {
    return this.request<BatchJob>(`/batch/${jobId}`, {
      method: 'POST',
    });
  }

  /**
   * Get batch job status
   */
  async getBatchStatus(jobId: string): Promise<BatchJob> {
    return this.request<BatchJob>(`/batch/${jobId}`);
  }

  /**
   * List user's batch jobs
   */
  async listBatches(): Promise<BatchJob[]> {
    return this.request<BatchJob[]>('/batch');
  }

  /**
   * Cancel a batch job
   */
  async cancelBatch(jobId: string): Promise<BatchJob> {
    return this.request<BatchJob>(`/batch/${jobId}`, {
      method: 'DELETE',
    });
  }

  // -------------------------------------------------------------------------
  // Style Variations
  // -------------------------------------------------------------------------

  /**
   * Generate style variations for a project
   */
  async generateVariations(params: {
    projectId: string;
    prompt: string;
    videoFormat?: 'landscape' | 'portrait' | 'square';
    styles?: string[];
    existingCode?: string;
    model?: 'sonnet' | 'haiku';
  }): Promise<VariationsResult> {
    return this.request<VariationsResult>('/variations', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * List variations for a project
   */
  async listVariations(projectId: string): Promise<{ projectId: string; variations: Variation[]; totalCount: number }> {
    return this.request<{ projectId: string; variations: Variation[]; totalCount: number }>(`/variations/${projectId}`);
  }

  /**
   * Apply a variation to a project
   */
  async applyVariation(projectId: string, variationId: string): Promise<{ message: string; projectId: string; variationId: string; style: string }> {
    return this.request<{ message: string; projectId: string; variationId: string; style: string }>(`/variations/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ variationId }),
    });
  }

  // -------------------------------------------------------------------------
  // Assets
  // -------------------------------------------------------------------------

  /**
   * Upload a single image for use in batch manifests and agent flows.
   * Skips the shared `request` helper because multipart bodies must NOT
   * carry a `Content-Type: application/json` header — the runtime has to
   * set its own multipart boundary.
   */
  async uploadAsset(
    file: Buffer | Uint8Array,
    filename: string,
    mimeType: string,
  ): Promise<UploadAssetResult> {
    // Node 18+ ships a File implementation as a global alongside FormData.
    // Constructing with [file] avoids an extra Blob allocation.
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file)], { type: mimeType });
    form.set('file', blob, filename);

    const url = `${this.baseUrl}/api/mcp/assets/upload`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'User-Agent': USER_AGENT,
      },
      body: form,
    });

    const data = (await response.json()) as {
      data?: UploadAssetResult;
      error?: string;
      code?: string;
    };

    if (!response.ok || !data.data) {
      throw new Error(data.error || `Upload failed with status ${response.status}`);
    }

    return data.data;
  }

  // -------------------------------------------------------------------------
  // Narrated ads (HyperFrame-style 3-stage pipeline: script → audio → code)
  // -------------------------------------------------------------------------

  /**
   * Generate a full narrated ad. Server runs script (Haiku) + audio
   * (ElevenLabs with-timestamps) + storyboard (deterministic) + code
   * (Sonnet w/ extended thinking) and returns the final state. The
   * web variant streams SSE events; the MCP proxy buffers them so the
   * client gets a single response. ~90-180s wall time.
   *
   * Pro-only. Costs CREDIT_COSTS.narratedAdGeneration (5) + counts
   * against the monthly cap.
   */
  async generateNarratedAd(params: {
    brief: string;
    productImageUrl?: string | null;
    targetSeconds?: number;
    voiceId?: string;
    language?: 'en' | 'ko';
    brandDnaId?: string | null;
  }): Promise<NarratedAdResult> {
    return this.request<NarratedAdResult>('/narrated-ad/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /**
   * Monthly narrated-ad cap status. Free, instant. Useful as a
   * pre-flight before spending credits.
   */
  async getNarrationCap(): Promise<NarrationCapStatus> {
    return this.request<NarrationCapStatus>('/narrated-ad/cap');
  }

  /**
   * Stage outputs (script + audio + storyboard + code) for a narrated
   * ad project. JSON by default; pass format='md' for the markdown
   * bundle (returned as raw markdown, not JSON).
   */
  async getNarratedAdStages(
    projectId: string,
    format: 'json' | 'md' = 'json',
  ): Promise<NarratedAdStages | string> {
    if (format === 'md') {
      // Markdown export bypasses the JSON wrapper.
      const url = `${this.baseUrl}/api/mcp/narrated-ad/stages/${projectId}?format=md`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'User-Agent': USER_AGENT,
        },
      });
      if (!res.ok) {
        throw new Error(`Markdown export failed: ${res.status}`);
      }
      return await res.text();
    }
    const result = await this.request<{ stages: NarratedAdStages }>(
      `/narrated-ad/stages/${projectId}`,
    );
    return result.stages;
  }

  // -------------------------------------------------------------------------
  // Campaign Agent (multi-segment plan + parallel fan-out)
  // -------------------------------------------------------------------------

  /**
   * Run the agentic loop (read-only tools: brand / products / styles)
   * to produce a structured CampaignPlan from a one-line brief.
   * Pro-only. Costs CREDIT_COSTS.campaignAgentPlan (10).
   */
  async campaignPlan(params: { brief: string }): Promise<{ plan: CampaignPlan; creditsSpent: number }> {
    return this.request<{ plan: CampaignPlan; creditsSpent: number }>(
      '/campaign/plan',
      { method: 'POST', body: JSON.stringify(params) },
    );
  }

  /**
   * Execute a CampaignPlan — fans out to one Sonnet generation per
   * segment in parallel, persists run + variations, returns runId +
   * results. Costs N segments × CREDIT_COSTS.campaignAgentExecutePerSegment.
   * Failed segments are NOT charged.
   */
  async campaignExecute(params: { plan: CampaignPlan }): Promise<CampaignExecuteResult> {
    return this.request<CampaignExecuteResult>('/campaign/execute', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /** List recent campaign runs (capped 50). Free. */
  async listCampaignRuns(): Promise<CampaignRun[]> {
    const result = await this.request<{ runs: CampaignRun[] }>('/campaign/runs');
    return result.runs;
  }

  /** Get one campaign run + its variations + linked projects. Free. */
  async getCampaignRun(runId: string): Promise<{
    run: CampaignRun;
    variations: CampaignVariation[];
    projects: Array<{ id: string; title: string; created_at: string; video_format: string }>;
  }> {
    return this.request(`/campaign/runs/${runId}`);
  }

  // -------------------------------------------------------------------------
  // Brand DNA
  // -------------------------------------------------------------------------

  /**
   * Get the effective brand for the authenticated user (workspace brand
   * takes precedence over user-level). Free.
   */
  async getBrand(): Promise<BrandResult> {
    return this.request<BrandResult>('/brand');
  }

  /**
   * Upsert the user's personal brand profile. Free-tier caps are
   * enforced server-side (max 3 colors, no tone/do-nots/past-ads/
   * archetypes). Pro for everything.
   */
  async setBrand(payload: BrandPayload): Promise<{ brand: unknown }> {
    return this.request<{ brand: unknown }>('/brand', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  // -------------------------------------------------------------------------
  // Shopify
  // -------------------------------------------------------------------------

  /**
   * Cached Shopify product catalog (up to 500 rows) for the caller's
   * connected store. Read-only. The OAuth connect flow remains
   * browser-only; this endpoint just reads what's already synced.
   */
  async listShopifyProducts(): Promise<ShopifyProduct[]> {
    const result = await this.request<{ products: ShopifyProduct[] }>(
      '/shopify/products',
    );
    return result.products;
  }
}

const USER_AGENT = 'framlit-mcp/0.7.0';

// ---------------------------------------------------------------------------
// Narrated ad / Campaign / Brand / Shopify types
// ---------------------------------------------------------------------------

export interface NarratedAdResult {
  projectId: string;
  script: {
    text: string;
    beats: Array<{ sentenceIndex: number; intent: string; visualText?: string }>;
    estimatedSeconds: number;
    language: 'en' | 'ko';
  } | null;
  audio: {
    audioUrl: string;
    durationMs: number;
    wordCount: number;
    voiceId: string;
  } | null;
  storyboard: {
    scenes: Array<{
      sentenceIndex: number;
      intent: string;
      visualText?: string;
      anchorWord: string;
      startMs: number;
      endMs: number;
    }>;
    audioDurationMs: number;
    tailMs: number;
  } | null;
  code: { tsx: string };
  creditsCharged: number;
}

export interface NarrationCapStatus {
  cap: number;
  used: number;
  remaining: number;
  allowed: boolean;
  tier: 'free' | 'pro' | 'team';
}

export interface NarratedAdStages {
  script:
    | (Record<string, unknown> & { _meta?: { costUsd?: number; durationMs?: number } })
    | null;
  audio:
    | (Record<string, unknown> & { _meta?: { costUsd?: number; durationMs?: number } })
    | null;
  storyboard:
    | (Record<string, unknown> & { _meta?: { costUsd?: number; durationMs?: number } })
    | null;
  code:
    | (Record<string, unknown> & { _meta?: { costUsd?: number; durationMs?: number } })
    | null;
}

export interface CampaignPlanSegment {
  name: string;
  audience: string;
  hook: string;
  recommended_styles: string[];
  ad_count: number;
  example_headlines?: string[];
}

export interface CampaignPlan {
  campaign_name: string;
  summary: string;
  segments: CampaignPlanSegment[];
  total_ads: number;
  estimated_credits: number;
  requires_from_user: string[];
  rationale: string;
}

export interface CampaignVariation {
  segment_name: string;
  style: string;
  code: string | null;
  error: string | null;
  model?: string;
}

export interface CampaignExecuteResult {
  runId: string;
  variations: CampaignVariation[];
  creditsSpent: number;
  succeeded: number;
  total: number;
}

export interface CampaignRun {
  id: string;
  plan: CampaignPlan;
  status: string;
  total_credits_spent: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface BrandColor {
  name: string;
  hex: string;
  role?: string;
}

export interface BrandFont {
  heading: string | null;
  body: string | null;
}

export interface BrandToneExample {
  type: 'headline' | 'body' | 'cta';
  content: string;
}

export interface BrandPayload {
  brand_name?: string | null;
  logo_url?: string | null;
  brand_colors?: BrandColor[];
  brand_fonts?: BrandFont;
  tone_examples?: BrandToneExample[];
  do_nots?: string[];
  past_ad_urls?: string[];
  product_archetypes?: string[];
}

export interface BrandResult {
  brand: {
    source: string | null;
    brand_name: string | null;
    logo_url: string | null;
    brand_colors: BrandColor[];
    brand_fonts: BrandFont;
    tone_examples: BrandToneExample[];
    do_nots: string[];
    past_ad_urls: string[];
    product_archetypes: string[];
  };
  plan: {
    tier: string;
    brandVaultEnabled: boolean;
    brandLearningEnabled: boolean;
    freeColorLimit: number;
  };
}

export interface ShopifyProduct {
  shopify_product_id: string;
  title: string;
  handle: string;
  description: string | null;
  price_amount: number | null;
  featured_image_url: string | null;
  vendor: string | null;
  product_type: string | null;
}
