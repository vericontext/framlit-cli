/**
 * `framlit whoami` — show the currently-authenticated account.
 *
 * Resolves the API key the same way the rest of the CLI does
 * (env var wins over saved config), then calls `/api/mcp/user` for
 * email + credits + plan tier.
 *
 * Issue #63.
 */

import { FramlitClient } from '../../api/client.js';
import { loadConfig } from '../config.js';
import { detectOutputMode, formatOutput, formatError } from '../output.js';
import { EXIT } from '../exit-codes.js';

interface UserInfoDisplay {
  email?: string;
  plan?: string;
  creditsRemaining?: number;
  creditsTotal?: number;
}

export async function cmdWhoami(
  options: Record<string, unknown> = {},
): Promise<void> {
  const outputMode = detectOutputMode(options.output as string | undefined);

  const envKey = process.env.FRAMLIT_API_KEY;
  const cfg = loadConfig();
  const apiKey = envKey || cfg?.api_key;

  if (!apiKey) {
    console.error(
      formatError(
        'Not logged in. Run: framlit login',
        outputMode,
        'AUTH_REQUIRED',
      ),
    );
    process.exit(EXIT.AUTH_REQUIRED);
  }

  const source = envKey ? 'FRAMLIT_API_KEY env var' : '~/.framlit/config';
  const prefix = apiKey.slice(0, 8);

  let info: UserInfoDisplay = {};
  try {
    const client = new FramlitClient(apiKey);
    info = (await client.getUserInfo()) as UserInfoDisplay;
  } catch (err) {
    console.error(
      formatError(
        `Failed to load user info: ${err instanceof Error ? err.message : 'unknown'}`,
        outputMode,
        'API_ERROR',
      ),
    );
    process.exit(EXIT.API_ERROR);
  }

  const payload = {
    email: info.email ?? cfg?.user_email ?? null,
    plan: info.plan ?? null,
    creditsRemaining: info.creditsRemaining ?? null,
    creditsTotal: info.creditsTotal ?? null,
    keyPrefix: `${prefix}…`,
    keySource: source,
  };

  const lines: string[] = [];
  if (payload.email) lines.push(`Email:   ${payload.email}`);
  if (payload.plan) lines.push(`Plan:    ${payload.plan}`);
  if (payload.creditsRemaining !== null) {
    const total =
      payload.creditsTotal !== null ? ` / ${payload.creditsTotal}` : '';
    lines.push(`Credits: ${payload.creditsRemaining}${total}`);
  }
  lines.push(`Key:     ${payload.keyPrefix} (from ${source})`);

  console.log(formatOutput(payload, lines.join('\n'), outputMode));
}
