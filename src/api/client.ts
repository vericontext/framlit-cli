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
        'User-Agent': 'framlit-mcp/0.2.0',
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
}
