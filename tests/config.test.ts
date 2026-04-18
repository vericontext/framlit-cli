import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Redirect HOME before importing config so ~/.framlit points inside
// a disposable temp dir.
let tempHome: string;
const origHome = process.env.HOME;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'framlit-cli-cfg-'));
  process.env.HOME = tempHome;
  // Reset the module so getConfigPath() re-reads HOME.
  vi.resetModules();
});

afterEach(() => {
  process.env.HOME = origHome;
  rmSync(tempHome, { recursive: true, force: true });
});

describe('cli/config', () => {
  it('loadConfig returns null when file is missing', async () => {
    const { loadConfig } = await import('../src/cli/config');
    expect(loadConfig()).toBeNull();
  });

  it('saveConfig writes 0600-mode file and loadConfig round-trips', async () => {
    const { saveConfig, loadConfig, getConfigPath } = await import('../src/cli/config');
    const input = {
      api_key: 'fml_abcdef0123456789',
      key_prefix: 'fml_abcd',
      user_email: 'test@framlit.app',
      created_at: '2026-04-19T00:00:00.000Z',
    };
    saveConfig(input);
    const path = getConfigPath();
    expect(existsSync(path)).toBe(true);
    // 0600 = rw-------
    const mode = statSync(path).mode & 0o777;
    expect(mode).toBe(0o600);
    expect(readFileSync(path, 'utf-8')).toContain('"fml_abcdef0123456789"');
    expect(loadConfig()).toEqual(input);
  });

  it('clearConfig returns true when file existed, false when it did not', async () => {
    const { saveConfig, clearConfig } = await import('../src/cli/config');
    expect(clearConfig()).toBe(false);
    saveConfig({
      api_key: 'fml_xyz',
      key_prefix: 'fml_xyz',
      created_at: new Date().toISOString(),
    });
    expect(clearConfig()).toBe(true);
    expect(clearConfig()).toBe(false);
  });

  it('loadConfig returns null for malformed JSON', async () => {
    const { getConfigPath, loadConfig } = await import('../src/cli/config');
    const path = getConfigPath();
    // Write bad content directly
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, 'not json');
    expect(loadConfig()).toBeNull();
  });

  it('loadConfig returns null when api_key has wrong prefix', async () => {
    const { saveConfig, getConfigPath, loadConfig } = await import('../src/cli/config');
    saveConfig({
      api_key: 'not_fml_prefix',
      key_prefix: 'fml_xxxx',
      created_at: '2026-04-19T00:00:00.000Z',
    });
    // Even though we wrote it, load should reject because prefix doesn't
    // look like a real framlit key — defense against accidentally
    // reading an unrelated config.
    expect(loadConfig()).toBeNull();
    // File still exists though
    expect(existsSync(getConfigPath())).toBe(true);
  });
});
