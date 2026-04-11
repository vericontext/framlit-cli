/**
 * CLI Output Formatters
 *
 * Handles text/JSON/NDJSON output for the CLI.
 * Auto-detects piped output and defaults to JSON.
 */

import type { ErrorCode } from './exit-codes.js';

export type OutputMode = 'text' | 'json';

export function detectOutputMode(explicit?: string): OutputMode {
  if (explicit === 'json') return 'json';
  if (explicit === 'text') return 'text';
  // If stdout is not a TTY (piped), default to JSON for agent-friendliness
  if (!process.stdout.isTTY) return 'json';
  return 'text';
}

export function formatOutput(data: unknown, message: string, mode: OutputMode): string {
  if (mode === 'json') {
    return JSON.stringify(data, null, 2);
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
