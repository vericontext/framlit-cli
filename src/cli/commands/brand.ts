/**
 * `framlit brand` — Brand DNA CRUD.
 *
 * Subcommands:
 *   framlit brand get
 *   framlit brand set --json '<payload>' | --json -  (stdin) | --json-file <path>
 *
 * Free tier may set brand_name + fonts + up to 3 colors + logo_url only.
 * Pro tier unlocks tone_examples / do_nots / past_ad_urls / product_archetypes.
 */

import { readFileSync } from 'node:fs';
import { FramlitClient, type BrandPayload } from '../../api/client.js';
import * as handlers from '../../core/handlers.js';
import { detectOutputMode, formatOutput, formatError } from '../output.js';
import { EXIT } from '../exit-codes.js';
import { ValidationError, validateSafePath } from '../validation.js';

function exitInvalidArg(message: string, output?: string): never {
  console.error(formatError(message, detectOutputMode(output), 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
}

function readJsonInput(value: string): string {
  return value === '-' ? readFileSync(0, 'utf-8') : value;
}

export async function cmdBrand(
  args: string[],
  options: Record<string, unknown>,
  getApiKey: () => string,
): Promise<void> {
  const sub = args[0];
  const outputFlag = options.output as string | undefined;
  const mode = detectOutputMode(outputFlag);
  const apiKey = getApiKey();
  const client = new FramlitClient(apiKey);

  switch (sub) {
    case 'get': {
      const result = await handlers.handleGetBrand(client);
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    case 'set': {
      let json: string | undefined;
      if (options['json-file']) {
        const file = String(options['json-file']);
        validateSafePath(file, '--json-file');
        json = readFileSync(file, 'utf-8');
      } else if (options.json) {
        json = readJsonInput(String(options.json));
      } else {
        exitInvalidArg(
          'Pass --json \'<payload>\', --json - (stdin), or --json-file <path>',
          outputFlag,
        );
      }

      let payload: BrandPayload;
      try {
        payload = JSON.parse(json!);
      } catch (err) {
        exitInvalidArg(
          `Could not parse JSON payload: ${err instanceof Error ? err.message : 'unknown'}`,
          outputFlag,
        );
      }

      if (options['dry-run']) {
        console.log(formatOutput(payload, `[dry-run] would PUT brand: ${JSON.stringify(payload)}`, mode));
        return;
      }
      const result = await handlers.handleSetBrand(client, payload);
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    default:
      exitInvalidArg('Usage: framlit brand <get | set>', outputFlag);
  }
}

export { ValidationError };
