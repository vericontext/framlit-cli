/**
 * `framlit campaign` — multi-segment campaign agent.
 *
 * Subcommands:
 *   framlit campaign plan "<brief>"
 *   framlit campaign plan --json '{"brief":"..."}' | --json - | --json-file <path>
 *   framlit campaign execute (--plan-file <path> | --plan '<json>' | -)
 *   framlit campaign runs
 *   framlit campaign run <runId>
 *
 * Workflow:
 *   $ framlit campaign plan "Black Friday push for outerwear" --output json > plan.json
 *   $ framlit campaign execute --plan-file plan.json
 *   $ framlit campaign run <returned-runId>
 */

import { readFileSync } from 'node:fs';
import { FramlitClient, type CampaignPlan } from '../../api/client.js';
import * as handlers from '../../core/handlers.js';
import { detectOutputMode, formatOutput, formatError } from '../output.js';
import { EXIT } from '../exit-codes.js';
import {
  ValidationError,
  sanitizeUntrustedText,
  validateResourceId,
  validateTextInput,
  validateSafePath,
} from '../validation.js';

function exitInvalidArg(message: string, output?: string): never {
  console.error(formatError(message, detectOutputMode(output), 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
}

function readJsonInput(value: string): string {
  return value === '-' ? readFileSync(0, 'utf-8') : value;
}

export async function cmdCampaign(
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
    case 'plan': {
      // --json overrides positional brief — agents prefer the JSON path so
      // they only have to learn one tool surface.
      let brief: string | undefined;
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
          exitInvalidArg(`Could not parse JSON payload: ${err instanceof Error ? err.message : 'unknown'}`, outputFlag);
        }
        if (!parsed || typeof parsed !== 'object' || typeof (parsed as { brief?: unknown }).brief !== 'string') {
          exitInvalidArg('JSON payload must be {"brief": "<string>"}', outputFlag);
        }
        brief = (parsed as { brief: string }).brief;
      } else {
        brief = rest[0];
        if (!brief) exitInvalidArg('Brief required: framlit campaign plan "<brief>" (or pass --json)', outputFlag);
      }
      if (options.sanitize) {
        const { value, removed } = sanitizeUntrustedText(brief!);
        if (removed.length) {
          process.stderr.write(
            `[sanitize] stripped ${removed.length} suspicious line(s) from brief\n`,
          );
        }
        brief = value;
      }
      validateTextInput(brief!, 'brief', 400);

      if (options['dry-run']) {
        console.log(formatOutput({ brief }, `[dry-run] would POST campaign/plan with brief: ${brief}`, mode));
        return;
      }
      if (mode === 'text') process.stderr.write('Planning campaign... (Opus 8-turn loop, ~30-90s)\n');
      const result = await handlers.handleCampaignPlan(client, { brief });
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    case 'execute': {
      let planJson: string | undefined;
      if (options['plan-file']) {
        const file = String(options['plan-file']);
        validateSafePath(file, '--plan-file');
        planJson = readFileSync(file, 'utf-8');
      } else if (options.plan) {
        planJson = readJsonInput(String(options.plan));
      } else {
        exitInvalidArg(
          'Pass --plan-file <path>, --plan \'<json>\', or --plan -  (stdin)',
          outputFlag,
        );
      }

      let plan: CampaignPlan;
      try {
        plan = JSON.parse(planJson!);
      } catch (err) {
        exitInvalidArg(`Could not parse plan JSON: ${err instanceof Error ? err.message : 'unknown'}`, outputFlag);
      }

      if (!Array.isArray(plan.segments) || plan.segments.length === 0) {
        exitInvalidArg('plan.segments missing or empty', outputFlag);
      }

      if (options['dry-run']) {
        const previewCost = plan.segments.length * 2;
        console.log(formatOutput({ segments: plan.segments.length }, `[dry-run] would execute ${plan.segments.length} segments (~${previewCost} credits)`, mode));
        return;
      }

      if (mode === 'text') {
        process.stderr.write(`Executing ${plan.segments.length} segments in parallel...\n`);
      }
      const result = await handlers.handleCampaignExecute(client, { plan });
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    case 'runs': {
      const result = await handlers.handleListCampaignRuns(client);
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    case 'run': {
      const runId = rest[0];
      if (!runId) exitInvalidArg('Run ID required: framlit campaign run <runId>', outputFlag);
      validateResourceId(runId, 'runId');
      const result = await handlers.handleGetCampaignRun(client, { runId });
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    default:
      exitInvalidArg(
        'Usage: framlit campaign <plan | execute | runs | run>',
        outputFlag,
      );
  }
}

export { ValidationError };
