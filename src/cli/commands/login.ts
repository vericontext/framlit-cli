/**
 * `framlit login` — Stripe/Vercel-style CLI login.
 *
 * Flow:
 * 1. Generate 32-hex state token for CSRF.
 * 2. Start a tiny HTTP server on OS-assigned port (127.0.0.1).
 * 3. Open https://framlit.app/developers/cli-authorize in the browser with
 *    cli_callback + state query params.
 * 4. User signs in + clicks Authorize on framlit.app.
 * 5. framlit.app 303-redirects the browser to
 *    http://127.0.0.1:PORT/?key=fml_…&state=<same>
 * 6. Our local server receives the GET, validates state (timing-safe),
 *    saves ~/.framlit/config, responds with a success HTML page,
 *    and shuts itself down.
 *
 * Issue #63.
 */

import { createServer, type Server } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { platform } from 'node:os';
import { URL } from 'node:url';
import { FramlitClient } from '../../api/client.js';
import { saveConfig } from '../config.js';
import { EXIT } from '../exit-codes.js';

const LOGIN_TIMEOUT_MS = 120_000;
const AUTHORIZE_PATH = '/developers/cli-authorize';

function getWebBaseUrl(): string {
  // FRAMLIT_API_URL points at the API root; strip trailing slashes and
  // reuse it for the consent page too. Defaults to prod.
  const api = process.env.FRAMLIT_API_URL || 'https://framlit.app';
  return api.replace(/\/$/, '');
}

function openBrowser(url: string): void {
  const sys = platform();
  const cmd = sys === 'darwin' ? 'open' : sys === 'win32' ? 'start' : 'xdg-open';
  try {
    const child = spawn(cmd, [url], { stdio: 'ignore', detached: true });
    child.unref();
  } catch {
    // Fall back silently — we print the URL so user can copy-paste.
  }
}

const SUCCESS_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Framlit CLI — Authorized</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0b0f14; color: #e5e7eb; }
      .card { max-width: 420px; padding: 32px; background: #111827; border: 1px solid #1f2937; border-radius: 16px; text-align: center; }
      h1 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0; color: #9ca3af; font-size: 14px; }
      .check { font-size: 40px; margin-bottom: 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="check">✓</div>
      <h1>framlit CLI authorized</h1>
      <p>You can close this tab and return to your terminal.</p>
    </div>
  </body>
</html>`;

const FAILURE_HTML = (reason: string) => `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>Framlit CLI — Authorization failed</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0b0f14;color:#fca5a5;}.card{max-width:420px;padding:32px;text-align:center;}</style>
  </head>
  <body><div class="card"><h1>Authorization failed</h1><p>${reason}</p><p style="color:#9ca3af;margin-top:8px">Check your terminal for details.</p></div></body>
</html>`;

interface LoginOutcome {
  api_key: string;
  key_prefix: string;
  user_email?: string;
  plan?: string;
  creditsRemaining?: number;
}

async function waitForCallback(
  server: Server,
  port: number,
  expectedState: string,
): Promise<LoginOutcome> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error(`Login timed out after ${LOGIN_TIMEOUT_MS / 1000}s`));
    }, LOGIN_TIMEOUT_MS);

    server.on('request', (req, res) => {
      if (!req.url || !req.url.startsWith('/')) {
        res.statusCode = 404;
        res.end('Not found');
        return;
      }
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const key = url.searchParams.get('key');
      const state = url.searchParams.get('state');

      if (!key || !state) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(FAILURE_HTML('Missing key or state parameter.'));
        return;
      }

      // Timing-safe state comparison — the expected and actual both come
      // from the CLI and framlit.app respectively; a mismatch means either
      // CSRF attempt or a stale tab. Either way: reject.
      const a = Buffer.from(state);
      const b = Buffer.from(expectedState);
      const stateOk = a.length === b.length && timingSafeEqual(a, b);
      if (!stateOk) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(FAILURE_HTML('State mismatch — not the expected login attempt.'));
        clearTimeout(timeout);
        server.close();
        reject(new Error('State mismatch; aborting login.'));
        return;
      }

      if (!key.startsWith('fml_')) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(FAILURE_HTML('Received malformed API key.'));
        clearTimeout(timeout);
        server.close();
        reject(new Error('Malformed key received from server.'));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(SUCCESS_HTML);
      clearTimeout(timeout);
      // Give the browser a beat to render the success page before the
      // socket closes.
      setTimeout(() => server.close(), 150);
      resolve({
        api_key: key,
        key_prefix: key.slice(0, 8),
      });
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export async function cmdLogin(): Promise<void> {
  if (process.env.FRAMLIT_API_KEY) {
    console.log(
      '⚠ FRAMLIT_API_KEY is set in your environment — it overrides any\n' +
        '  key saved by `framlit login`. Unset it first if you want `login`\n' +
        '  to take effect:\n' +
        '    unset FRAMLIT_API_KEY',
    );
  }

  const state = randomBytes(16).toString('hex');
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address();
  if (typeof addr !== 'object' || !addr) {
    server.close();
    throw new Error('Failed to get localhost server address');
  }
  const port = addr.port;
  const callback = `http://127.0.0.1:${port}`;
  const authorizeUrl = `${getWebBaseUrl()}${AUTHORIZE_PATH}?cli_callback=${encodeURIComponent(callback)}&state=${encodeURIComponent(state)}`;

  console.log('Opening your browser to authorize the framlit CLI…');
  console.log('If it does not open automatically, copy this URL:');
  console.log(`  ${authorizeUrl}\n`);
  openBrowser(authorizeUrl);

  let outcome: LoginOutcome;
  try {
    outcome = await waitForCallback(server, port, state);
  } catch (err) {
    server.close();
    console.error(
      '\n✗ Login failed: ' +
        (err instanceof Error ? err.message : 'Unknown error'),
    );
    console.error(
      '  Retry with `framlit login`, or create a key manually at',
      'https://framlit.app/developers',
    );
    process.exit(EXIT.AUTH_REQUIRED);
  }

  // Fetch user info so we can print a helpful confirmation and cache the
  // email in the config file.
  let email: string | undefined;
  let plan: string | undefined;
  let creditsRemaining: number | undefined;
  try {
    const client = new FramlitClient(outcome.api_key);
    const info = (await client.getUserInfo()) as {
      email?: string;
      plan?: string;
      creditsRemaining?: number;
    };
    email = info.email;
    plan = info.plan;
    creditsRemaining = info.creditsRemaining;
  } catch {
    // Non-fatal — the key is already saved; whoami will try again.
  }

  saveConfig({
    api_key: outcome.api_key,
    key_prefix: outcome.key_prefix,
    user_email: email,
    created_at: new Date().toISOString(),
  });

  console.log('');
  console.log('✓ Logged in' + (email ? ` as ${email}` : ''));
  if (creditsRemaining !== undefined) {
    const planLabel = plan ? `· ${plan} plan` : '';
    console.log(`  ${creditsRemaining} credits remaining ${planLabel}`.trim());
  }
  console.log(`  Key ${outcome.key_prefix}… saved to ~/.framlit/config`);
}
