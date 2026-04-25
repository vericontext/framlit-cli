/**
 * CLI Output Formatters
 *
 * Handles text/JSON/NDJSON output for the CLI.
 * Auto-detects piped output and defaults to JSON.
 */

import type { ErrorCode } from './exit-codes.js';
import { applyFieldMask, parseFieldMask } from './field-mask.js';

export type OutputMode = 'text' | 'json';

export function detectOutputMode(explicit?: string): OutputMode {
  if (explicit === 'json') return 'json';
  if (explicit === 'text') return 'text';
  // If stdout is not a TTY (piped), default to JSON for agent-friendliness
  if (!process.stdout.isTTY) return 'json';
  return 'text';
}

export interface FormatOptions {
  /** Comma-separated dot-paths — applied to data before serialization. JSON mode only. */
  fields?: string;
}

// Process-level defaults — set once in main() so individual commands don't
// have to plumb --fields through every formatOutput call site. CLI is a
// single-shot process per invocation, so a module-level singleton is safe.
let defaults: FormatOptions = {};

export function setOutputDefaults(opts: FormatOptions): void {
  defaults = { ...defaults, ...opts };
}

export function formatOutput(
  data: unknown,
  message: string,
  mode: OutputMode,
  options: FormatOptions = {},
): string {
  if (mode === 'json') {
    const fields = options.fields ?? defaults.fields;
    const paths = parseFieldMask(fields);
    const projected = paths ? applyFieldMask(data, paths) : data;
    return JSON.stringify(projected, null, 2);
  }
  return message;
}

export function formatError(message: string, mode: OutputMode, code?: ErrorCode): string {
  if (mode === 'json') {
    return JSON.stringify({ error: { code: code ?? 'API_ERROR', message } }, null, 2);
  }
  return `Error: ${message}`;
}

/**
 * Write a single NDJSON line to stdout (for --poll streaming).
 */
export function writeNdjsonLine(data: unknown): void {
  process.stdout.write(JSON.stringify(data) + '\n');
}
