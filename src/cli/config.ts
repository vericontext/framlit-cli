/**
 * CLI config file persistence.
 *
 * `framlit login` writes the issued API key here so subsequent commands
 * on the same machine don't need the env var. File lives at
 * `~/.framlit/config` with mode 0600 so other users on a shared box
 * can't read it.
 *
 * Issue #63.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  chmodSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export interface CliConfig {
  /** Raw API key (fml_…). Hashed form stored server-side; this value is secret. */
  api_key: string;
  /** First 8 chars of the API key for display purposes. */
  key_prefix: string;
  /** Email of the Framlit user the key belongs to. Set after the first whoami/login round-trip. */
  user_email?: string;
  /** ISO timestamp of when this config was written. */
  created_at: string;
}

export function getConfigPath(): string {
  return join(homedir(), '.framlit', 'config');
}

/**
 * Read the config file. Returns null if missing or unparseable —
 * callers treat that identically.
 */
export function loadConfig(): CliConfig | null {
  const path = getConfigPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as CliConfig;
    if (
      !parsed ||
      typeof parsed.api_key !== 'string' ||
      !parsed.api_key.startsWith('fml_')
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Write the config file with 0600 perms (owner-only read/write) so other
 * users on a multi-tenant machine can't peek at the API key.
 */
export function saveConfig(cfg: CliConfig): void {
  const path = getConfigPath();
  const dir = dirname(path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  // writeFileSync's `mode` is only applied on create; chmod unconditionally
  // so overwrites also get tightened permissions.
  chmodSync(path, 0o600);
}

/**
 * Remove the config file. Returns true if a file was actually deleted
 * (distinguishes "logged out" from "nothing to do").
 */
export function clearConfig(): boolean {
  const path = getConfigPath();
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}
