import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** The installed package version, read from package.json next to dist/. */
export const VERSION: string = (() => {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();
