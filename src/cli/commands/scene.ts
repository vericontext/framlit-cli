/**
 * `framlit scene` — the open format: describe a video as JSON, get an
 * editable Framlit project.
 *
 * Subcommands:
 *   framlit scene create --file <scene.json> | --json '<scene>' | --json -  [--name <name>] [--project <id>]
 *   framlit scene get <projectId>
 *
 * Schema: https://framlit.app/schemas/framlit-scene.v1.json
 */

import { readFileSync } from 'node:fs';
import { FramlitClient } from '../../api/client.js';
import * as handlers from '../../core/handlers.js';
import { detectOutputMode, formatOutput, formatError } from '../output.js';
import { EXIT } from '../exit-codes.js';
import { validateResourceId, validateSafePath, validateTextInput } from '../validation.js';

function exitInvalidArg(message: string, output?: string): never {
  console.error(formatError(message, detectOutputMode(output), 'INVALID_ARGUMENT'));
  process.exit(EXIT.INVALID_ARGS);
}

export async function cmdScene(
  args: string[],
  options: Record<string, unknown>,
  getApiKey: () => string,
): Promise<void> {
  const sub = args[0];
  const outputFlag = options.output as string | undefined;
  const mode = detectOutputMode(outputFlag);

  switch (sub) {
    case 'create': {
      let scene: string;
      if (options.file) {
        const file = String(options.file);
        validateSafePath(file, '--file');
        scene = readFileSync(file, 'utf-8');
      } else if (options.json) {
        scene = options.json === '-' ? readFileSync(0, 'utf-8') : String(options.json);
      } else {
        exitInvalidArg("Pass --file <scene.json>, --json '<scene>', or --json - (stdin)", outputFlag);
      }
      const name = options.name ? String(options.name) : undefined;
      if (name) validateTextInput(name, '--name');
      const projectId = options.project ? String(options.project) : undefined;
      if (projectId) validateResourceId(projectId, '--project');

      if (options['dry-run']) {
        console.log(formatOutput({ scene: JSON.parse(scene), name, projectId }, '[dry-run] would POST /api/mcp/scenes', mode));
        return;
      }
      const result = await handlers.handleCreateScene(new FramlitClient(getApiKey()), { scene, name, projectId });
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    case 'get': {
      const projectId = args[1];
      if (!projectId) exitInvalidArg('Usage: framlit scene get <projectId>', outputFlag);
      validateResourceId(projectId, 'projectId');
      const result = await handlers.handleGetScene(new FramlitClient(getApiKey()), { projectId });
      console.log(formatOutput(result.data, result.message, mode));
      return;
    }

    default:
      exitInvalidArg('Usage: framlit scene <create|get>. See https://framlit.app/schemas/framlit-scene.v1.json', outputFlag);
  }
}
