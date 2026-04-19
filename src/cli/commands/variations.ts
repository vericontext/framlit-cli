/**
 * `framlit variations` — style variations for A/B testing.
 *
 * Subcommands:
 *   framlit variations generate <projectId> --prompt "..." [--styles a,b,c] [--existing-code <code|file>] [--model sonnet|haiku] [--dry-run]
 *   framlit variations list     <projectId>
 *   framlit variations apply    <projectId> <variationId> [--dry-run]
 *
 * Same agent-friendly conventions as `framlit batch`:
 *   --json '<payload>' for raw JSON-RPC-style input
 *   --dry-run on every mutating call (generate costs 1 cr/variation; apply mutates project)
 *   strict input validation on resource IDs and file paths
 */

import { readFileSync, existsSync } from 'node:fs';
import { FramlitClient } from '../../api/client.js';
import * as handlers from '../../core/handlers.js';
import {
  detectOutputMode,
  formatOutput,
  formatError,
  type OutputMode,
} from '../output.js';
import { EXIT } from '../exit-codes.js';
import {
  ValidationError,
  validateResourceId,
  validateSafePath,
  validateTextInput,
} from '../validation.js';

const VALID_STYLES = ['minimal', 'bold', 'dynamic', 'cinematic', 'energetic', 'playful'];
const VALID_MODELS = ['sonnet', 'haiku'];

function exitInvalidArg(message: string, mode: OutputMode): never {
  console.error(formatError(message, mode, 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
}

function resolveInlineOrFile(value: string, fieldName: string): string {
  if (existsSync(value) && !value.includes('\n')) {
    validateSafePath(value, fieldName);
    return readFileSync(value, 'utf-8');
  }
  return value;
}

function readJsonInput(value: string): string {
  return value === '-' ? readFileSync(0, 'utf-8') : value;
}

// ---------------------------------------------------------------------------
// generate
// ---------------------------------------------------------------------------

interface GenerateArgs {
  projectId: string;
  prompt: string;
  styles?: string;
  existingCode?: string;
  model?: string;
}

function buildGenerateArgs(
  positionals: string[],
  options: Record<string, unknown>,
  mode: OutputMode,
): GenerateArgs {
  const jsonInput = options.json as string | undefined;

  if (jsonInput) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readJsonInput(jsonInput));
    } catch (err) {
      exitInvalidArg(`--json payload is not valid JSON: ${(err as Error).message}`, mode);
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.projectId !== 'string' || typeof obj.prompt !== 'string') {
      exitInvalidArg('--json must include "projectId" and "prompt" strings', mode);
    }
    // styles: schema wants comma-string, but agents often pass arrays — accept both.
    let styles: string | undefined;
    if (typeof obj.styles === 'string') styles = obj.styles;
    else if (Array.isArray(obj.styles)) styles = obj.styles.join(',');
    return {
      projectId: obj.projectId,
      prompt: obj.prompt,
      styles,
      existingCode: typeof obj.existingCode === 'string' ? obj.existingCode : undefined,
      model: typeof obj.model === 'string' ? obj.model : undefined,
    };
  }

  const projectId = positionals[0];
  if (!projectId) exitInvalidArg('Project ID required: framlit variations generate <projectId>', mode);
  const prompt = options.prompt as string | undefined;
  if (!prompt) exitInvalidArg('--prompt is required', mode);

  return {
    projectId,
    prompt,
    styles: options.styles as string | undefined,
    existingCode: options['existing-code']
      ? resolveInlineOrFile(options['existing-code'] as string, '--existing-code')
      : undefined,
    model: options.model as string | undefined,
  };
}

function validateGenerateArgs(args: GenerateArgs, mode: OutputMode): void {
  validateResourceId(args.projectId, 'projectId');
  validateTextInput(args.prompt, '--prompt');
  if (args.styles) {
    validateTextInput(args.styles, '--styles', 200);
    const styles = args.styles.split(',').map((s) => s.trim());
    for (const s of styles) {
      if (!VALID_STYLES.includes(s)) {
        exitInvalidArg(`Unknown style "${s}". Valid: ${VALID_STYLES.join(', ')}`, mode);
      }
    }
  }
  if (args.existingCode) validateTextInput(args.existingCode, '--existing-code', 200_000);
  if (args.model && !VALID_MODELS.includes(args.model)) {
    exitInvalidArg(`Unknown model "${args.model}". Valid: ${VALID_MODELS.join(', ')}`, mode);
  }
}

async function variationsGenerate(
  client: FramlitClient | null,
  positionals: string[],
  options: Record<string, unknown>,
  mode: OutputMode,
): Promise<void> {
  const args = buildGenerateArgs(positionals, options, mode);
  validateGenerateArgs(args, mode);

  if (options['dry-run']) {
    const styleCount = args.styles ? args.styles.split(',').length : 3;
    const preview = {
      projectId: args.projectId,
      prompt: args.prompt,
      styles: args.styles ?? 'minimal,bold,dynamic (default)',
      existingCode: args.existingCode ? `${args.existingCode.length} chars` : undefined,
      model: args.model ?? 'sonnet (default)',
      estimatedCredits: styleCount,
    };
    console.log(formatOutput(preview, `[dry-run] Would generate ${styleCount} variation(s) for project ${args.projectId}`, mode));
    return;
  }

  const result = await handlers.handleGenerateVariations(client!, args);
  console.log(formatOutput(result.data, result.message, mode));
}

// ---------------------------------------------------------------------------
// list / apply
// ---------------------------------------------------------------------------

async function variationsList(
  client: FramlitClient,
  projectId: string | undefined,
  mode: OutputMode,
): Promise<void> {
  if (!projectId) exitInvalidArg('Project ID required: framlit variations list <projectId>', mode);
  validateResourceId(projectId, 'projectId');

  const result = await handlers.handleListVariations(client, { projectId });
  console.log(formatOutput(result.data, result.message, mode));
}

async function variationsApply(
  client: FramlitClient | null,
  projectId: string | undefined,
  variationId: string | undefined,
  options: Record<string, unknown>,
  mode: OutputMode,
): Promise<void> {
  if (!projectId || !variationId) {
    exitInvalidArg('Required: framlit variations apply <projectId> <variationId>', mode);
  }
  validateResourceId(projectId, 'projectId');
  validateResourceId(variationId, 'variationId');

  if (options['dry-run']) {
    console.log(formatOutput({ projectId, variationId }, `[dry-run] Would apply variation ${variationId} to project ${projectId}`, mode));
    return;
  }

  const result = await handlers.handleApplyVariation(client!, { projectId, variationId });
  console.log(formatOutput(result.data, result.message, mode));
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function cmdVariations(
  positionals: string[],
  options: Record<string, unknown>,
  getApiKey: () => string,
): Promise<void> {
  const mode = detectOutputMode(options.output as string | undefined);
  const sub = positionals[0];
  const rest = positionals.slice(1);
  const lazyClient = (): FramlitClient => new FramlitClient(getApiKey());

  try {
    switch (sub) {
      case 'generate':
        await variationsGenerate(options['dry-run'] ? null : lazyClient(), rest, options, mode);
        return;
      case 'list':
        await variationsList(lazyClient(), rest[0], mode);
        return;
      case 'apply':
        await variationsApply(options['dry-run'] ? null : lazyClient(), rest[0], rest[1], options, mode);
        return;
      default:
        console.error(formatError(`Unknown variations subcommand: ${sub ?? '(none)'}. Try: generate | list | apply`, mode, 'UNKNOWN_COMMAND'));
        process.exit(EXIT.INVALID_ARGS);
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      console.error(formatError(err.message, mode, 'VALIDATION_ERROR'));
      process.exit(EXIT.INVALID_ARGS);
    }
    throw err;
  }
}
