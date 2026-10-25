/**
 * Framlit API Client
 * 
 * HTTP client for communicating with Framlit SaaS API.
 */

import { VERSION } from '../version.js';

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
          `${error}\n\n💡 Get more credits at https://framlit.app/docs/pricing`
        );
      }
      
      if (data.code === 'PLAN_LIMIT_EXCEEDED') {
        throw new Error(
          `${error}\n\n💡 Upgrade to Editor Pro for more capacity at https://framlit.app/docs/pricing`
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
    imageGen?: { enabled: boolean; model?: 'flux-schnell' | 'gpt-image-2' };
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
  // Assets
  // -------------------------------------------------------------------------

  /**
   * Upload a single image so agent flows can reference it by URL.
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
   * (Kokoro TTS with word timestamps) + storyboard (deterministic) + code
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

  /**
   * Compile a Framlit Scene v1 into an editable project (no credits).
   * With projectId, the scene replaces that project's video.
   */
  async createScene(params: { scene: unknown; name?: string; projectId?: string }): Promise<SceneResult> {
    return this.request<SceneResult>('/scenes', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  /** A project as a Framlit Scene v1, including edits made in the editor. */
  async getScene(projectId: string): Promise<SceneRead> {
    return this.request<SceneRead>(`/projects/${projectId}/scene`);
  }
}

export interface SceneResult {
  projectId: string;
  editorUrl: string;
  previewUrl?: string;
  layers: number;
  durationInFrames: number;
}

export interface SceneRead {
  projectId: string;
  scene: Record<string, unknown>;
  /** false when the project was not compiled from a scene (layers and motion only). */
  complete: boolean;
}

const USER_AGENT = `framlit/${VERSION}`;

// ---------------------------------------------------------------------------
// Narrated ad / Brand types
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
