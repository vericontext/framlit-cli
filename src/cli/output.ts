/**
 * CLI Output Formatters
 *
 * Handles text/JSON/NDJSON output for the CLI.
 * Auto-detects piped output and defaults to JSON.
 */

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

export function formatError(error: string, mode: OutputMode): string {
  if (mode === 'json') {
    return JSON.stringify({ error }, null, 2);
  }
  return `Error: ${error}`;
}

/**
 * Write a single NDJSON line to stdout (for --poll streaming).
 */
export function writeNdjsonLine(data: unknown): void {
  process.stdout.write(JSON.stringify(data) + '\n');
}
