/**
 * `framlit batch` — batch video generation.
 *
 * Subcommands:
 *   framlit batch create  (--rows '<json>' | --rows-file <path> | --manifest <path>)  --template-id <id>|--template-code <code|path>
 *   framlit batch start   <jobId> [--poll]
 *   framlit batch status  <jobId> [--poll]
 *   framlit batch list
 *   framlit batch cancel  <jobId>
 *
 *  Manifest mode (issue #90):
 *   Pass `--manifest <path.json>` to feed a catalog of products with
 *   local image paths. Any key ending in `Path` is uploaded via
 *   `/api/mcp/assets/upload` and the result is substituted under the
 *   matching non-`Path` key before the batch is submitted.
 *
 * Designed for agent + script use:
 *   - JSON-first I/O (auto when piped; explicit via --output json)
 *   - --json '<full payload>' for raw JSON-RPC-style invocation
 *   - --dry-run on every mutating call
 *   - --poll emits NDJSON status frames until terminal state (completed|failed|cancelled)
 *   - Strict input validation (control chars, path traversal, resource ID injection)
 */

import { readFileSync, existsSync } from 'node:fs';
import { basename, isAbsolute, resolve as resolvePath } from 'node:path';
import { FramlitClient } from '../../api/client.js';
import * as handlers from '../../core/handlers.js';
import {
  applyUploadResults,
  mimeFromFilename,
  parseManifest,
  type PendingUpload,
} from '../../core/manifest.js';
import {
  detectOutputMode,
  formatOutput,
  formatError,
  writeNdjsonLine,
  type OutputMode,
} from '../output.js';
import { EXIT } from '../exit-codes.js';
import {
  ValidationError,
  validateResourceId,
  validateSafePath,
  validateTextInput,
} from '../validation.js';

// Statuses that mean "stop polling" — keep in sync with batch backend.
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'cancelled_with_results']);
const POLL_INTERVAL_MS = 2_000;

function exitInvalidArg(message: string, mode: OutputMode): never {
  console.error(formatError(message, mode, 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
}

/** Resolve a value that's either inline content or a safe file path. */
function resolveInlineOrFile(value: string, fieldName: string): string {
  if (existsSync(value) && !value.includes('\n')) {
    validateSafePath(value, fieldName);
    return readFileSync(value, 'utf-8');
  }
  return value;
}

/** Read --json input ('-' = stdin). */
function readJsonInput(value: string): string {
  return value === '-' ? readFileSync(0, 'utf-8') : value;
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

interface CreateArgs {
  rows: string;
  templateId?: string;
  templateCode?: string;
}

function buildCreateArgs(options: Record<string, unknown>, mode: OutputMode): CreateArgs {
  const jsonInput = options.json as string | undefined;

  if (jsonInput) {
    const raw = readJsonInput(jsonInput);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      exitInvalidArg(`--json payload is not valid JSON: ${(err as Error).message}`, mode);
    }
    const obj = parsed as Record<string, unknown>;
    // The schema expects `rows` as a JSON string. Accept both string AND
    // array — agents often forget to double-stringify. We re-stringify
    // arrays here so handlers stay schema-strict.
    let rowsValue: string;
    if (typeof obj.rows === 'string') {
      rowsValue = obj.rows;
    } else if (Array.isArray(obj.rows)) {
      rowsValue = JSON.stringify(obj.rows);
    } else {
      exitInvalidArg('--json must include "rows" as a JSON array or stringified array', mode);
    }
    return {
      rows: rowsValue,
      templateId: typeof obj.templateId === 'string' ? obj.templateId : undefined,
      templateCode: typeof obj.templateCode === 'string' ? obj.templateCode : undefined,
    };
  }

  let rows: string;
  if (options['rows-file']) {
    const path = options['rows-file'] as string;
    validateSafePath(path, '--rows-file');
    rows = readFileSync(path, 'utf-8');
  } else if (options.rows) {
    rows = options.rows as string;
  } else if (options.manifest) {
    // Manifest mode: rows are assembled in `batchCreate` after uploading
    // any *Path fields. At arg-build time we leave rows as a placeholder
    // so validateCreateArgs doesn't trip on empty input.
    rows = '[]';
  } else {
    exitInvalidArg(
      'Provide --rows <json>, --rows-file <path>, --manifest <path>, or --json <payload>',
      mode,
    );
  }

  const templateId = options['template-id'] as string | undefined;
  const templateCode = options['template-code']
    ? resolveInlineOrFile(options['template-code'] as string, '--template-code')
    : undefined;

  return { rows, templateId, templateCode };
}

function validateCreateArgs(args: CreateArgs, mode: OutputMode): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(args.rows);
  } catch (err) {
    exitInvalidArg(`rows is not valid JSON: ${(err as Error).message}`, mode);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    exitInvalidArg('rows must be a non-empty JSON array', mode);
  }
  // Each row must be an object — reject primitives that would make the
  // backend explode with an unhelpful error.
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      exitInvalidArg(`rows[${i}] must be an object`, mode);
    }
  }
  if (!args.templateId && !args.templateCode) {
    exitInvalidArg('Either --template-id or --template-code is required', mode);
  }
  if (args.templateId) validateResourceId(args.templateId, '--template-id');
  if (args.templateCode) validateTextInput(args.templateCode, '--template-code', 200_000);
  return parsed as unknown[];
}

async function batchCreate(
  client: FramlitClient | null,
  options: Record<string, unknown>,
  mode: OutputMode,
): Promise<void> {
  const args = buildCreateArgs(options, mode);

  // Manifest mode: parse the file, collect uploads, upload, substitute
  // URLs back into rows, then hand off to the normal validate/submit
  // path. Kept inline rather than in a helper because it threads the
  // `client` + `options['dry-run']` state that the rest of the command
  // already has in scope.
  if (options.manifest) {
    const manifestPath = options.manifest as string;
    validateSafePath(manifestPath, '--manifest');
    if (!existsSync(manifestPath)) {
      exitInvalidArg(`Manifest not found: ${manifestPath}`, mode);
    }
    let parsedManifest;
    try {
      parsedManifest = parseManifest(readFileSync(manifestPath, 'utf-8'));
    } catch (err) {
      exitInvalidArg((err as Error).message, mode);
    }

    if (options['dry-run']) {
      const preview = {
        totalRows: parsedManifest.rows.length,
        uploadsPlanned: parsedManifest.uploads.length,
        sampleRow: parsedManifest.rows[0],
        uploadFields: Array.from(
          new Set(parsedManifest.uploads.map((u) => u.fieldName)),
        ),
        templateId: args.templateId,
        templateCode: args.templateCode ? `${args.templateCode.length} chars` : undefined,
      };
      console.log(
        formatOutput(
          preview,
          `[dry-run] Would upload ${parsedManifest.uploads.length} image(s) and create batch with ${parsedManifest.rows.length} row(s)`,
          mode,
        ),
      );
      return;
    }

    // Resolve local paths against the manifest's directory so users can
    // author catalog.json alongside their photos without CLI cwd gotchas.
    const manifestAbs = resolvePath(manifestPath);
    const baseDir = manifestAbs.slice(0, manifestAbs.lastIndexOf('/')) || '.';

    const resolved = new Map<string, string>();
    for (const pending of parsedManifest.uploads) {
      const abs = isAbsolute(pending.localPath)
        ? pending.localPath
        : resolvePath(baseDir, pending.localPath);
      validateSafePath(pending.localPath, `manifest[${pending.rowIndex}].${pending.fieldName}`);
      if (!existsSync(abs)) {
        exitInvalidArg(
          `Manifest row ${pending.rowIndex} ${pending.fieldName}: file not found: ${abs}`,
          mode,
        );
      }
      let buf: Buffer;
      try {
        buf = readFileSync(abs);
      } catch (err) {
        exitInvalidArg(
          `Manifest row ${pending.rowIndex} ${pending.fieldName}: read failed: ${(err as Error).message}`,
          mode,
        );
      }
      let mime: string;
      try {
        mime = mimeFromFilename(pending.localPath);
      } catch (err) {
        exitInvalidArg((err as Error).message, mode);
      }
      const { url } = await client!.uploadAsset(buf, basename(pending.localPath), mime);
      resolved.set(`${pending.rowIndex}:${pending.fieldName}`, url);
    }

    applyUploadResults(parsedManifest.rows, parsedManifest.uploads, resolved);
    args.rows = JSON.stringify(parsedManifest.rows);
  }

  const rows = validateCreateArgs(args, mode);

  if (options['dry-run']) {
    const preview = {
      totalRows: rows.length,
      sampleRow: rows[0],
      templateId: args.templateId,
      templateCode: args.templateCode ? `${args.templateCode.length} chars` : undefined,
    };
    console.log(formatOutput(preview, `[dry-run] Would create batch job with ${rows.length} row(s)`, mode));
    return;
  }

  const result = await handlers.handleBatchCreate(client!, args);
  console.log(formatOutput(result.data, result.message, mode));
}

// ---------------------------------------------------------------------------
// start / status (with --poll → NDJSON)
// ---------------------------------------------------------------------------

async function pollUntilTerminal(client: FramlitClient, jobId: string): Promise<void> {
  while (true) {
    const result = await handlers.handleBatchStatus(client, { jobId });
    writeNdjsonLine(result.data);
    const data = result.data as { status?: string };
    if (data.status && TERMINAL_STATUSES.has(data.status)) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function batchStart(
  client: FramlitClient | null,
  jobId: string | undefined,
  options: Record<string, unknown>,
  mode: OutputMode,
): Promise<void> {
  if (!jobId) exitInvalidArg('Job ID required: framlit batch start <jobId>', mode);
  validateResourceId(jobId, 'jobId');

  if (options['dry-run']) {
    console.log(formatOutput({ jobId }, `[dry-run] Would start batch job: ${jobId}`, mode));
    return;
  }

  const result = await handlers.handleBatchStart(client!, { jobId });

  if (options.poll) {
    // Emit the start response as the first NDJSON frame, then keep polling
    // status until terminal — gives agents a single stream to consume.
    writeNdjsonLine(result.data);
    const startData = result.data as { status?: string };
    if (startData.status && TERMINAL_STATUSES.has(startData.status)) return;
    await pollUntilTerminal(client!, jobId);
    return;
  }

  console.log(formatOutput(result.data, result.message, mode));
}

async function batchStatus(
  client: FramlitClient,
  jobId: string | undefined,
  options: Record<string, unknown>,
  mode: OutputMode,
): Promise<void> {
  if (!jobId) exitInvalidArg('Job ID required: framlit batch status <jobId>', mode);
  validateResourceId(jobId, 'jobId');

  if (options.poll) {
    await pollUntilTerminal(client, jobId);
    return;
  }

  const result = await handlers.handleBatchStatus(client, { jobId });
  console.log(formatOutput(result.data, result.message, mode));
}

// ---------------------------------------------------------------------------
// list / cancel
// ---------------------------------------------------------------------------

async function batchList(client: FramlitClient, mode: OutputMode): Promise<void> {
  const result = await handlers.handleBatchList(client);
  console.log(formatOutput(result.data, result.message, mode));
}

async function batchCancel(
  client: FramlitClient | null,
  jobId: string | undefined,
  options: Record<string, unknown>,
  mode: OutputMode,
): Promise<void> {
  if (!jobId) exitInvalidArg('Job ID required: framlit batch cancel <jobId>', mode);
  validateResourceId(jobId, 'jobId');

  if (options['dry-run']) {
    console.log(formatOutput({ jobId }, `[dry-run] Would cancel batch job: ${jobId}`, mode));
    return;
  }

  const result = await handlers.handleBatchCancel(client!, { jobId });
  console.log(formatOutput(result.data, result.message, mode));
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function cmdBatch(
  positionals: string[],
  options: Record<string, unknown>,
  getApiKey: () => string,
): Promise<void> {
  const mode = detectOutputMode(options.output as string | undefined);
  const sub = positionals[0];
  // Defer client construction until we know we'll hit the network — keeps
  // --dry-run usable without an API key, mirroring `framlit generate --dry-run`.
  const lazyClient = (): FramlitClient => new FramlitClient(getApiKey());

  try {
    switch (sub) {
      case 'create':
        await batchCreate(options['dry-run'] ? null : lazyClient(), options, mode);
        return;
      case 'start':
        await batchStart(options['dry-run'] ? null : lazyClient(), positionals[1], options, mode);
        return;
      case 'status':
        await batchStatus(lazyClient(), positionals[1], options, mode);
        return;
      case 'list':
      case undefined:
        await batchList(lazyClient(), mode);
        return;
      case 'cancel':
        await batchCancel(options['dry-run'] ? null : lazyClient(), positionals[1], options, mode);
        return;
      default:
        console.error(formatError(`Unknown batch subcommand: ${sub}. Try: create | start | status | list | cancel`, mode, 'UNKNOWN_COMMAND'));
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
