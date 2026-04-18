#!/usr/bin/env node
/**
 * Framlit CLI
 *
 * Human-friendly and agent-friendly CLI for Framlit.
 * Shares core logic with the MCP server.
 *
 * Usage:
 *   framlit generate <prompt> [--format landscape|portrait|square] [--output json|text] [--dry-run]
 *   framlit modify --code <code|file> --instruction <text> [--output json|text] [--dry-run]
 *   framlit projects list [--output json|text]
 *   framlit projects get <id>
 *   framlit projects create <name> --code <code|file> [--format landscape|portrait|square] [--dry-run]
 *   framlit projects update <id> [--name <name>] [--code <code|file>] [--dry-run]
 *   framlit render <projectId> [--dry-run]
 *   framlit render status <renderId> [--poll] [--output json|text]
 *   framlit templates [--category <cat>] [--official]
 *   framlit preview <code|file>
 *   framlit credits [--output json|text]
 *   framlit schema [tool-name]
 *   framlit mcp
 *   framlit version
 *   framlit help
 */

import { parseArgs } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { FramlitClient } from '../api/client.js';
import { TOOL_REGISTRY, getToolByName, zodToJsonSchema } from '../core/registry.js';
import * as handlers from '../core/handlers.js';
import { detectOutputMode, formatOutput, formatError, writeNdjsonLine } from './output.js';
import { EXIT, exitCodeForError } from './exit-codes.js';
import type { ErrorCode } from './exit-codes.js';
import { ValidationError, validateResourceId, validateTextInput, validateSafePath } from './validation.js';
import { loadConfig } from './config.js';
import { cmdLogin } from './commands/login.js';
import { cmdWhoami } from './commands/whoami.js';
import { cmdLogout } from './commands/logout.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Read version from package.json at runtime
const VERSION = (() => {
  try {
    const pkgPath = require('node:path').resolve(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

function getApiKey(): string {
  // Precedence: FRAMLIT_API_KEY env var > saved CLI config.
  // Env var wins so CI / agent setups with `-e FRAMLIT_API_KEY=...` keep
  // working identically.
  const envKey = process.env.FRAMLIT_API_KEY;
  if (envKey) return envKey;

  const cfg = loadConfig();
  if (cfg?.api_key) return cfg.api_key;

  console.error(formatError(
    'No API key configured. Run: framlit login\n' +
    '  or: export FRAMLIT_API_KEY=fml_xxx  (create at https://framlit.app/developers)',
    detectOutputMode(),
    'AUTH_REQUIRED',
  ));
  process.exit(EXIT.AUTH_REQUIRED);
}

/**
 * Resolve a value that could be either inline text or a file path.
 */
function resolveCodeValue(value: string): string {
  if (existsSync(value) && !value.includes('\n')) {
    validateSafePath(value, 'file path');
    return readFileSync(value, 'utf-8');
  }
  return value;
}

/** Print a validation or argument error and exit. */
function exitInvalidArg(message: string, outputMode: ReturnType<typeof detectOutputMode>): never {
  console.error(formatError(message, outputMode, 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
}

function printHelp(): void {
  console.log(`Framlit CLI v${VERSION} — AI-powered video generation

USAGE
  framlit <command> [options]

COMMANDS
  login                    Authorize this machine — opens browser
  whoami                   Show the current account + credits
  logout                   Remove the saved API key
  generate <prompt>        Generate Remotion video code from text
  modify                   Modify existing Remotion code
  projects list            List your projects
  projects get <id>        Get project details
  projects create <name>   Create a new project
  projects update <id>     Update a project
  render <projectId>       Start video rendering
  render status <id>       Check render status
  templates                Browse video templates
  preview <code|file>      Create a preview URL
  credits                  Check credit balance
  schema [tool-name]       Show tool schemas (agent discovery)
  mcp                      Start MCP server (for IDE integration)
  version                  Show version
  help                     Show this help

GLOBAL OPTIONS
  --output json|text       Output format (auto: JSON when piped)
  --json '{"key":"val"}'   Raw JSON input (bypass arg parsing)
  --dry-run                Preview request without executing

EXIT CODES
  0  Success
  1  General error
  2  Invalid arguments / validation error
  3  Authentication required (missing API key)
  4  API error (server-side failure)

EXAMPLES
  framlit generate "Logo animation with rotating 3D text"
  framlit generate "Product demo" --format portrait --output json
  framlit modify --code ./video.tsx --instruction "Change background to blue"
  framlit render abc123 --dry-run
  framlit render status xyz789 --poll
  framlit schema framlit_generate_code
  echo '{"prompt":"test"}' | framlit generate --json -

AUTH
  Run \`framlit login\` once to save your API key to ~/.framlit/config.
  Alternatively, set FRAMLIT_API_KEY (env var overrides the saved config).

ENVIRONMENT
  FRAMLIT_API_KEY          Your Framlit API key (optional if logged in)
  FRAMLIT_API_URL          Custom API URL (optional, for development)

More info: https://framlit.app/developers`);
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

async function cmdGenerate(positionals: string[], options: Record<string, unknown>): Promise<void> {
  const outputMode = detectOutputMode(options.output as string | undefined);
  const jsonInput = options.json as string | undefined;

  let prompt: string;
  let format: 'landscape' | 'portrait' | 'square' | undefined;

  if (jsonInput) {
    const input = jsonInput === '-'
      ? readFileSync(0, 'utf-8')
      : jsonInput;
    const parsed = JSON.parse(input);
    prompt = parsed.prompt;
    format = parsed.format;
  } else {
    prompt = positionals.join(' ');
    format = options.format as typeof format;
  }

  if (!prompt) {
    exitInvalidArg('prompt is required. Usage: framlit generate <prompt>', outputMode);
  }

  validateTextInput(prompt, 'prompt');

  if (options['dry-run']) {
    const payload = { prompt, format: format ?? 'landscape' };
    console.log(formatOutput(payload, `[dry-run] Would generate code with prompt: "${prompt}"`, outputMode));
    return;
  }

  const client = new FramlitClient(getApiKey());
  const result = await handlers.handleGenerateCode(client, { prompt, format });
  console.log(formatOutput(result.data, result.message, outputMode));
}

async function cmdModify(positionals: string[], options: Record<string, unknown>): Promise<void> {
  const outputMode = detectOutputMode(options.output as string | undefined);
  const jsonInput = options.json as string | undefined;

  let code: string;
  let instruction: string;

  if (jsonInput) {
    const input = jsonInput === '-' ? readFileSync(0, 'utf-8') : jsonInput;
    const parsed = JSON.parse(input);
    code = parsed.code;
    instruction = parsed.instruction;
  } else {
    code = resolveCodeValue(options.code as string || '');
    instruction = options.instruction as string || positionals.join(' ');
  }

  if (!code || !instruction) {
    exitInvalidArg('--code and --instruction are required', outputMode);
  }

  validateTextInput(instruction, 'instruction');

  if (options['dry-run']) {
    const payload = { code: code.substring(0, 100) + '...', instruction };
    console.log(formatOutput(payload, `[dry-run] Would modify code with instruction: "${instruction}"`, outputMode));
    return;
  }

  const client = new FramlitClient(getApiKey());
  const result = await handlers.handleModifyCode(client, { code, instruction });
  console.log(formatOutput(result.data, result.message, outputMode));
}

async function cmdProjects(positionals: string[], options: Record<string, unknown>): Promise<void> {
  const outputMode = detectOutputMode(options.output as string | undefined);
  const sub = positionals[0];

  const client = new FramlitClient(getApiKey());

  switch (sub) {
    case 'list':
    case undefined: {
      const result = await handlers.handleListProjects(client);
      console.log(formatOutput(result.data, result.message, outputMode));
      break;
    }

    case 'get': {
      const id = positionals[1];
      if (!id) exitInvalidArg('Project ID required', outputMode);
      validateResourceId(id, 'projectId');
      const result = await handlers.handleGetProject(client, { projectId: id });
      console.log(formatOutput(result.data, result.message, outputMode));
      break;
    }

    case 'create': {
      const name = positionals[1];
      if (!name) exitInvalidArg('Project name required', outputMode);
      validateTextInput(name, 'project name', 200);

      const code = options.code ? resolveCodeValue(options.code as string) : undefined;
      const format = options.format as 'landscape' | 'portrait' | 'square' | undefined;

      if (options['dry-run']) {
        console.log(formatOutput({ name, format: format ?? 'landscape', hasCode: !!code }, `[dry-run] Would create project: "${name}"`, outputMode));
        return;
      }

      const result = await handlers.handleCreateProject(client, { name, code, format });
      console.log(formatOutput(result.data, result.message, outputMode));
      break;
    }

    case 'update': {
      const id = positionals[1];
      if (!id) exitInvalidArg('Project ID required', outputMode);
      validateResourceId(id, 'projectId');

      const name = options.name as string | undefined;
      if (name) validateTextInput(name, 'project name', 200);
      const code = options.code ? resolveCodeValue(options.code as string) : undefined;

      if (options['dry-run']) {
        console.log(formatOutput({ projectId: id, name, hasCode: !!code }, `[dry-run] Would update project: ${id}`, outputMode));
        return;
      }

      const result = await handlers.handleUpdateProject(client, { projectId: id, name, code });
      console.log(formatOutput(result.data, result.message, outputMode));
      break;
    }

    default:
      console.error(formatError(`Unknown projects subcommand: ${sub}`, outputMode, 'UNKNOWN_COMMAND'));
      process.exit(EXIT.INVALID_ARGS);
  }
}

async function cmdRender(positionals: string[], options: Record<string, unknown>): Promise<void> {
  const outputMode = detectOutputMode(options.output as string | undefined);
  const client = new FramlitClient(getApiKey());

  // framlit render status <renderId>
  if (positionals[0] === 'status') {
    const renderId = positionals[1];
    if (!renderId) exitInvalidArg('Render ID required', outputMode);
    validateResourceId(renderId, 'renderId');

    if (options.poll) {
      // Poll mode: stream NDJSON until completion
      let done = false;
      while (!done) {
        const result = await handlers.handleGetRenderStatus(client, { renderId });
        const data = result.data as { status: string };
        writeNdjsonLine(result.data);
        if (data.status === 'completed' || data.status === 'failed') {
          done = true;
        } else {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    } else {
      const result = await handlers.handleGetRenderStatus(client, { renderId });
      console.log(formatOutput(result.data, result.message, outputMode));
    }
    return;
  }

  // framlit render <projectId>
  const projectId = positionals[0];
  if (!projectId) exitInvalidArg('Project ID required', outputMode);
  validateResourceId(projectId, 'projectId');

  if (options['dry-run']) {
    console.log(formatOutput({ projectId }, `[dry-run] Would start render for project: ${projectId}`, outputMode));
    return;
  }

  const result = await handlers.handleRenderVideo(client, { projectId });
  console.log(formatOutput(result.data, result.message, outputMode));
}

async function cmdTemplates(_positionals: string[], options: Record<string, unknown>): Promise<void> {
  const outputMode = detectOutputMode(options.output as string | undefined);
  const client = new FramlitClient(getApiKey());

  const category = options.category as string | undefined;
  if (category) validateTextInput(category, 'category', 100);
  const official = options.official as boolean | undefined;

  const result = await handlers.handleListTemplates(client, { category, official });
  console.log(formatOutput(result.data, result.message, outputMode));
}

async function cmdPreview(positionals: string[], options: Record<string, unknown>): Promise<void> {
  const outputMode = detectOutputMode(options.output as string | undefined);

  const codeInput = positionals[0];
  if (!codeInput) exitInvalidArg('Code or file path required', outputMode);

  const code = resolveCodeValue(codeInput);
  const client = new FramlitClient(getApiKey());
  const result = await handlers.handlePreviewCode(client, { code });
  console.log(formatOutput(result.data, result.message, outputMode));
}

async function cmdCredits(options: Record<string, unknown>): Promise<void> {
  const outputMode = detectOutputMode(options.output as string | undefined);
  const client = new FramlitClient(getApiKey());
  const result = await handlers.handleGetCredits(client);
  console.log(formatOutput(result.data, result.message, outputMode));
}

function cmdSchema(positionals: string[], options: Record<string, unknown>): void {
  const outputMode = detectOutputMode(options.output as string | undefined);
  const toolName = positionals[0];

  if (toolName) {
    const entry = getToolByName(toolName);
    if (!entry) {
      console.error(formatError(`Unknown tool: ${toolName}. Run "framlit schema" to list all tools.`, outputMode, 'NOT_FOUND'));
      process.exit(EXIT.INVALID_ARGS);
    }

    const schema = {
      name: entry.name,
      description: entry.description,
      credits: entry.credits,
      category: entry.category,
      inputSchema: zodToJsonSchema(entry.schema),
    };
    console.log(JSON.stringify(schema, null, 2));
  } else {
    // List all tools
    const tools = TOOL_REGISTRY.map((t) => ({
      name: t.name,
      description: t.description.split('\n')[0],
      credits: t.credits,
      category: t.category,
    }));

    if (outputMode === 'json') {
      console.log(JSON.stringify(tools, null, 2));
    } else {
      console.log(`Available tools (${tools.length}):\n`);
      for (const t of tools) {
        const creditLabel = t.credits === 0 ? 'free' : `${t.credits} cr`;
        console.log(`  ${t.name.padEnd(30)} ${creditLabel.padEnd(8)} ${t.description}`);
      }
      console.log(`\nRun "framlit schema <tool-name>" for detailed schema.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    strict: false,
    options: {
      // Global
      output: { type: 'string', short: 'o' },
      json: { type: 'string', short: 'j' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },

      // generate / projects create
      format: { type: 'string', short: 'f' },

      // modify
      code: { type: 'string', short: 'c' },
      instruction: { type: 'string', short: 'i' },

      // projects update
      name: { type: 'string', short: 'n' },

      // templates
      category: { type: 'string' },
      official: { type: 'boolean' },

      // render status
      poll: { type: 'boolean' },
    },
  });

  const command = positionals[0];
  const rest = positionals.slice(1);

  if (values.help || !command || command === 'help') {
    printHelp();
    return;
  }

  try {
    switch (command) {
      case 'login':
        await cmdLogin();
        break;
      case 'whoami':
        await cmdWhoami(values);
        break;
      case 'logout':
        cmdLogout();
        break;
      case 'generate':
        await cmdGenerate(rest, values);
        break;
      case 'modify':
        await cmdModify(rest, values);
        break;
      case 'projects':
        await cmdProjects(rest, values);
        break;
      case 'render':
        await cmdRender(rest, values);
        break;
      case 'templates':
        await cmdTemplates(rest, values);
        break;
      case 'preview':
        await cmdPreview(rest, values);
        break;
      case 'credits':
        await cmdCredits(values);
        break;
      case 'schema':
        cmdSchema(rest, values);
        break;
      case 'mcp': {
        // Start the MCP server — dynamic import to avoid loading MCP deps for CLI commands
        await import('../mcp/server.js');
        break;
      }
      case 'version':
        console.log(VERSION);
        break;
      default:
        console.error(formatError(`Unknown command: ${command}. Run "framlit help" for usage.`, detectOutputMode(values.output as string | undefined), 'UNKNOWN_COMMAND'));
        process.exit(EXIT.INVALID_ARGS);
    }
  } catch (error) {
    const mode = detectOutputMode(values.output as string | undefined);
    if (error instanceof ValidationError) {
      console.error(formatError(error.message, mode, 'VALIDATION_ERROR'));
      process.exit(EXIT.INVALID_ARGS);
    }
    const msg = error instanceof Error ? error.message : 'Unknown error';
    // Detect specific API error codes from message
    let code: ErrorCode = 'API_ERROR';
    if (msg.includes('Invalid or revoked API key')) code = 'AUTH_REQUIRED';
    else if (msg.includes('Insufficient credits')) code = 'INSUFFICIENT_CREDITS';
    else if (msg.includes('not found')) code = 'NOT_FOUND';
    else if (msg.includes('rate limit') || msg.includes('429')) code = 'RATE_LIMITED';
    console.error(formatError(msg, mode, code));
    process.exit(exitCodeForError(code));
  }
}

main();
