/**
 * `framlit narration` — narrated-ad pipeline (script + voiceover + sync codegen).
 *
 * Subcommands:
 *   framlit narration generate "<brief>" [--target 20] [--voice rachel] [--lang en|ko]
 *   framlit narration generate --json '{"brief":"...","targetSeconds":20}'
 *   framlit narration generate --json -          # stdin
 *   framlit narration generate --json-file <path>
 *   framlit narration cap
 *   framlit narration stages <projectId> [--format json|md]
 *
 * Pro-only. `generate` costs 5 credits + 1 monthly slot. ~90-180s wall time
 * — be patient or pipe stderr to a log.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { FramlitClient } from '../../api/client.js';
import * as handlers from '../../core/handlers.js';
import { detectOutputMode, formatOutput, formatError } from '../output.js';
import { EXIT } from '../exit-codes.js';
import {
  ValidationError,
  sanitizeUntrustedText,
  validateResourceId,
  validateSafePath,
  validateTextInput,
} from '../validation.js';


function exitInvalidArg(message: string, output?: string): never {
  console.error(formatError(message, detectOutputMode(output), 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
}

function readJsonInput(value: string): string {
  return value === '-' ? readFileSync(0, 'utf-8') : value;
}

interface NarrationGeneratePayload {
  brief: string;
  targetSeconds?: number;
  voiceId?: string;
  language?: 'en' | 'ko';
}

export async function cmdNarration(
  args: string[],
  options: Record<string, unknown>,
  getApiKey: () => string,
): Promise<void> {
  const sub = args[0];
  const rest = args.slice(1);
  const outputFlag = options.output as string | undefined;
  const mode = detectOutputMode(outputFlag);
  const apiKey = getApiKey();
  const client = new FramlitClient(apiKey);

  switch (sub) {
    case 'generate': {
      // Build payload either from --json (preferred for agents) or from
      // bespoke flags (preferred for humans). --json overrides flags entirely.
      let payload: NarrationGeneratePayload;
      let json: string | undefined;
      if (options['json-file']) {
        const file = String(options['json-file']);
        validateSafePath(file, '--json-file');
        json = readFileSync(file, 'utf-8');
      } else if (options.json) {
        json = readJsonInput(String(options.json));
      }

      if (json) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(json);
        } catch (err) {
          exitInvalidArg(
            `Could not parse JSON payload: ${err instanceof Error ? err.message : 'unknown'}`,
            outputFlag,
          );
        }
        if (!parsed || typeof parsed !== 'object') {
          exitInvalidArg('JSON payload must be an object', outputFlag);
        }
        payload = parsed as NarrationGeneratePayload;
      } else {
        const brief = rest[0];
        if (!brief) {
          exitInvalidArg(
            'Brief required: framlit narration generate "<brief>" (or pass --json)',
            outputFlag,
          );
        }
        const target = options.target ? Number(options.target) : undefined;
        if (target !== undefined && Number.isNaN(target)) {
          exitInvalidArg('--target must be a number', outputFlag);
        }
        payload = {
          brief,
          targetSeconds: target,
          voiceId: options.voice as string | undefined,
          language: options.lang as 'en' | 'ko' | undefined,
        };
      }

      // Validate the resolved payload regardless of input source — agents
      // sending malformed --json get the same errors as humans.
      if (typeof payload.brief !== 'string') {
        exitInvalidArg('brief is required and must be a string', outputFlag);
      }
      // Opt-in defense for agents passing untrusted text (web-scraped briefs,
      // user prompts laundered through other tools). Surfaces what was stripped.
      if (options.sanitize) {
        const { value, removed } = sanitizeUntrustedText(payload.brief);
        if (removed.length) {
          process.stderr.write(
            `[sanitize] stripped ${removed.length} suspicious line(s) from brief\n`,
          );
        }
        payload.brief = value;
      }
      validateTextInput(payload.brief, 'brief', 600);
      if (payload.brief.trim().length < 5) {
        exitInvalidArg('brief must be at least 5 characters', outputFlag);
      }
      if (payload.targetSeconds !== undefined) {
        if (typeof payload.targetSeconds !== 'number' || Number.isNaN(payload.targetSeconds)
          || payload.targetSeconds < 8 || payload.targetSeconds > 60) {
          exitInvalidArg('targetSeconds must be a number between 8 and 60', outputFlag);
        }
      }
      if (payload.language !== undefined && payload.language !== 'en' && payload.language !== 'ko') {
        exitInvalidArg('language must be "en" or "ko"', outputFlag);
      }

      if (options['dry-run']) {
        console.log(formatOutput(payload, `[dry-run] would POST narrated-ad ${JSON.stringify(payload)}`, mode));
        return;
      }

      // Brief progress to stderr so JSON consumers on stdout aren't polluted.
      if (mode === 'text') {
        process.stderr.write('Writing script... (this takes ~90-180s)\n');
      }
      const result = await handlers.handleGenerateNarratedAd(client, payload);
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    case 'cap': {
      const result = await handlers.handleGetNarrationCap(client);
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    case 'stages': {
      const projectId = rest[0];
      if (!projectId) exitInvalidArg('Project ID required: framlit narration stages <projectId>', outputFlag);
      validateResourceId(projectId, 'projectId');
      const format = (options.format as string | undefined) ?? 'json';
      if (format !== 'json' && format !== 'md') {
        exitInvalidArg('--format must be "json" or "md"', outputFlag);
      }
      const result = await handlers.handleGetNarratedAdStages(client, {
        projectId,
        format: format as 'json' | 'md',
      });
      // For md format, stream raw markdown to stdout (or --out file).
      if (format === 'md') {
        const md = (result.data as { markdown: string }).markdown;
        const outFile = options.out as string | undefined;
        if (outFile) {
          writeFileSync(outFile, md, 'utf-8');
          if (mode === 'text') process.stderr.write(`wrote ${outFile}\n`);
        } else {
          process.stdout.write(md);
        }
        return;
      }
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    default:
      exitInvalidArg(
        'Usage: framlit narration <generate | cap | stages>',
        outputFlag,
      );
  }
}

// Re-export so the dispatcher can catch ValidationError uniformly.
export { ValidationError };
