/**
 * `framlit logout` — remove the saved API key config.
 *
 * Prints a note if FRAMLIT_API_KEY is still set, since the env var takes
 * precedence and would otherwise silently keep the user "logged in".
 *
 * Issue #63.
 */

import { clearConfig, getConfigPath } from '../config.js';

export function cmdLogout(): void {
  const removed = clearConfig();
  if (removed) {
    console.log(`Logged out — removed ${getConfigPath()}`);
  } else {
    console.log('Not logged in — no config file to remove.');
  }
  if (process.env.FRAMLIT_API_KEY) {
    console.log(
      '\nNote: FRAMLIT_API_KEY is still set in your environment. Unset it\n' +
        'with `unset FRAMLIT_API_KEY` to fully sign out.',
    );
  }
}
