/**
 * `framlit shopify` — Shopify integration (read-only).
 *
 * Subcommands:
 *   framlit shopify products [--limit N]
 *
 * The OAuth connect flow is browser-only — connect a store at
 * https://framlit.app/dashboard first. This command just lists what
 * has already been synced.
 *
 * Use case: pair with `framlit batch create --manifest` to feed real
 * product data into bulk video generation.
 */

import { FramlitClient } from '../../api/client.js';
import * as handlers from '../../core/handlers.js';
import { detectOutputMode, formatOutput, formatError } from '../output.js';
import { EXIT } from '../exit-codes.js';
import { ValidationError } from '../validation.js';

function exitInvalidArg(message: string, output?: string): never {
  console.error(formatError(message, detectOutputMode(output), 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
}

export async function cmdShopify(
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
    case 'products': {
      const result = await handlers.handleListShopifyProducts(client);
      // Honor --limit to trim the JSON payload for piping into other tools.
      const limit = options.limit ? Number(options.limit) : undefined;
      if (limit !== undefined && (Number.isNaN(limit) || limit < 1)) {
        exitInvalidArg('--limit must be a positive integer', outputFlag);
      }
      let data = result.data;
      if (limit !== undefined && data && typeof data === 'object' && 'products' in data) {
        const products = (data as { products: unknown[] }).products;
        data = { products: products.slice(0, limit) };
      }
      console.log(formatOutput(data, result.message, mode));
      return;
    }

    default:
      exitInvalidArg('Usage: framlit shopify <products>', outputFlag);
  }
}

export { ValidationError };
