/**
 * `framlit narration` — narrated-ad pipeline (script + voiceover + sync codegen).
 *
 * Subcommands:
 *   framlit narration generate "<brief>" [--target 20] [--voice rachel] [--lang en|ko]
 *   framlit narration cap
 *   framlit narration stages <projectId> [--format json|md]
 *
 * Pro-only. `generate` costs 5 credits + 1 monthly slot. ~90-180s wall time
 * — be patient or pipe stderr to a log.
 */

import { writeFileSync } from 'node:fs';
import { FramlitClient } from '../../api/client.js';
import * as handlers from '../../core/handlers.js';
import { detectOutputMode, formatOutput, formatError } from '../output.js';
import { EXIT } from '../exit-codes.js';
import { ValidationError, validateResourceId, validateTextInput } from '../validation.js';


function exitInvalidArg(message: string, output?: string): never {
  console.error(formatError(message, detectOutputMode(output), 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
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
      const brief = rest[0];
      if (!brief) exitInvalidArg('Brief required: framlit narration generate "<brief>"', outputFlag);
      validateTextInput(brief, 'brief', 600);
      if (brief.trim().length < 5) {
        exitInvalidArg('brief must be at least 5 characters', outputFlag);
      }

      const target = options.target ? Number(options.target) : undefined;
      if (target !== undefined && (Number.isNaN(target) || target < 8 || target > 60)) {
        exitInvalidArg('--target must be a number between 8 and 60', outputFlag);
      }
      const voice = options.voice as string | undefined;
      const lang = options.lang as string | undefined;
      if (lang && lang !== 'en' && lang !== 'ko') {
        exitInvalidArg('--lang must be "en" or "ko"', outputFlag);
      }

      if (options['dry-run']) {
        const payload = { brief, targetSeconds: target, voiceId: voice, language: lang };
        console.log(formatOutput(payload, `[dry-run] would POST narrated-ad ${JSON.stringify(payload)}`, mode));
        return;
      }

      // Brief progress to stderr so JSON consumers on stdout aren't polluted.
      if (mode === 'text') {
        process.stderr.write('Writing script... (this takes ~90-180s)\n');
      }
      const result = await handlers.handleGenerateNarratedAd(client, {
        brief,
        targetSeconds: target,
        voiceId: voice,
        language: (lang as 'en' | 'ko' | undefined),
      });
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
