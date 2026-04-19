/**
 * Batch manifest loader.
 *
 * Issue #90: `framlit batch create --manifest <path.json>` lets users
 * feed a JSON file with local image paths instead of pre-uploaded URLs.
 * This module handles the pure parts — read + validate the JSON, find
 * which keys need uploading, normalise the rows after the uploader has
 * returned URLs. The network + fs side stays in the command file so
 * tests here only need in-memory data.
 *
 * Convention:
 *   Any row key ending in `Path` (camelCase, case-sensitive) is treated
 *   as a local-file field. After upload, the CLI emits a row where that
 *   key is replaced by its same-name-minus-"Path" counterpart and the
 *   value is the returned public URL:
 *
 *     { productImagePath: "./shirt.jpg" }  →  { productImage: "https://…/shirt.jpg" }
 *
 *   Rows may also carry pre-uploaded URLs under any key (unchanged):
 *
 *     { productImage: "https://cdn.example.com/shirt.jpg" }
 *
 *   Mixed manifests are fine — the uploader only fires for `*Path` keys
 *   whose values don't already look like URLs.
 */

export type ManifestRow = Record<string, string>;

export interface PendingUpload {
  /** Row index in the original manifest (for error reporting). */
  rowIndex: number;
  /** Field in that row — ends in "Path". */
  fieldName: string;
  /** The local path (relative or absolute). */
  localPath: string;
  /** The field name the uploaded URL will be placed under. */
  targetField: string;
}

export interface ParsedManifest {
  rows: ManifestRow[];
  /** Every `*Path` field across all rows that looks like a local path. */
  uploads: PendingUpload[];
}

const URL_RE = /^(?:https?:|data:)/i;

function isUrl(value: string): boolean {
  return URL_RE.test(value.trim());
}

/**
 * Parse a manifest from raw JSON text. Throws with a human-readable
 * message on any shape error so the CLI can surface it verbatim to the
 * user. Exported for testing.
 */
export function parseManifest(raw: string): ParsedManifest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Manifest is not valid JSON: ${(err as Error).message}`,
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error('Manifest must be a non-empty JSON array');
  }

  const rows: ManifestRow[] = [];
  const uploads: PendingUpload[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`Manifest[${i}] must be an object`);
    }

    const row: ManifestRow = {};
    for (const [key, value] of Object.entries(entry as Record<string, unknown>)) {
      // Stringify primitives so the batch API sees consistent strings.
      // Reject objects / arrays — templates expect scalar props per cell.
      if (typeof value === 'string') {
        row[key] = value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        row[key] = String(value);
      } else if (value === null || value === undefined) {
        // Preserve "explicit empty" as empty string so templates that
        // fall back on defaults still see a present key.
        row[key] = '';
      } else {
        throw new Error(
          `Manifest[${i}].${key} must be a string, number, boolean, or null — got ${typeof value}`,
        );
      }
    }

    for (const [key, value] of Object.entries(row)) {
      if (!key.endsWith('Path')) continue;
      if (!value) continue; // empty path = user intentionally skipped
      if (isUrl(value)) {
        // Allow pre-uploaded URLs under the *Path key: move them to the
        // target field and drop the path key. Same post-condition the
        // uploader produces, minus the network trip.
        const target = key.slice(0, -'Path'.length);
        row[target] = value;
        delete row[key];
        continue;
      }
      uploads.push({
        rowIndex: i,
        fieldName: key,
        localPath: value,
        targetField: key.slice(0, -'Path'.length),
      });
    }

    rows.push(row);
  }

  return { rows, uploads };
}

/**
 * After uploads complete, substitute URLs into the parsed rows. Input
 * `resolved` maps `${rowIndex}:${fieldName}` to the uploaded URL.
 * Mutates `rows` in place AND returns it for chaining.
 */
export function applyUploadResults(
  rows: ManifestRow[],
  uploads: PendingUpload[],
  resolved: Map<string, string>,
): ManifestRow[] {
  for (const u of uploads) {
    const key = `${u.rowIndex}:${u.fieldName}`;
    const url = resolved.get(key);
    if (!url) {
      throw new Error(
        `Upload result missing for row ${u.rowIndex} field ${u.fieldName}`,
      );
    }
    const row = rows[u.rowIndex];
    delete row[u.fieldName];
    row[u.targetField] = url;
  }
  return rows;
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Return the MIME type we should send for a given local filename.
 * Throws when the extension isn't on the server-side whitelist so the
 * CLI fails fast instead of discovering the mismatch after upload.
 */
export function mimeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf('.');
  if (dot === -1 || dot === lower.length - 1) {
    throw new Error(`Cannot infer MIME type from filename: ${filename}`);
  }
  const ext = lower.slice(dot + 1);
  const mime = EXT_TO_MIME[ext];
  if (!mime) {
    throw new Error(
      `Unsupported image extension .${ext} for ${filename}. Allowed: ${Object.keys(EXT_TO_MIME).join(', ')}`,
    );
  }
  return mime;
}
