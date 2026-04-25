/**
 * Field Mask
 *
 * Client-side dot-path projection for `--fields` flag. Lets agents request
 * only the fields they need from list/get responses, keeping context windows
 * small. Inspired by Google API field masks + jq-lite paths.
 *
 * Syntax:
 *   "data.projectId"                   → keep that one path
 *   "data.projectId,data.code"         → keep multiple paths
 *   "projects[].id,projects[].name"    → array element projection
 *   "[].id"                            → top-level array projection
 *
 * Behavior:
 *   - Unknown paths are silently skipped (no error)
 *   - Arrays are projected elementwise — each element gets the same mask
 *   - When no path matches, returns an empty object (clear signal: nothing matched)
 *   - When `fields` is undefined or empty, returns input unchanged
 */

type Json = unknown;

export function parseFieldMask(spec: string | undefined): string[] | null {
  if (!spec) return null;
  const paths = spec
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return paths.length ? paths : null;
}

interface Group {
  /** Sub-paths to apply to the value at this head (empty → keep as-is) */
  subPaths: string[];
  /** True when at least one matching path used `head[]` syntax */
  isArray: boolean;
}

/**
 * Apply a field mask to a value. Returns a new value — does not mutate.
 */
export function applyFieldMask(value: Json, paths: string[]): Json {
  if (!paths.length) return value;

  // Group paths by their head segment so we can recurse once per key with
  // all of that key's sub-paths combined. Without this, two paths targeting
  // the same array (`projects[].id`, `projects[].name`) would clobber.
  const groups = new Map<string, Group>();
  let topLevelArray = false;
  for (const path of paths) {
    if (!path) continue;
    const dot = path.indexOf('.');
    const head = dot === -1 ? path : path.slice(0, dot);
    const rest = dot === -1 ? '' : path.slice(dot + 1);

    // Top-level array projection: `[].id` → recurse over each element
    if (head === '[]') {
      topLevelArray = true;
      const g = groups.get('[]') ?? { subPaths: [], isArray: true };
      if (rest) g.subPaths.push(rest);
      groups.set('[]', g);
      continue;
    }

    const arrayMatch = head.match(/^(.+)\[\]$/);
    const key = arrayMatch ? arrayMatch[1] : head;
    const isArr = !!arrayMatch;
    const g = groups.get(key) ?? { subPaths: [], isArray: isArr };
    if (isArr) g.isArray = true;
    if (rest) g.subPaths.push(rest);
    groups.set(key, g);
  }

  // Top-level array case
  if (topLevelArray && Array.isArray(value)) {
    const g = groups.get('[]')!;
    return g.subPaths.length
      ? value.map((el) => applyFieldMask(el, g.subPaths))
      : value;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, Json> = {};
  for (const [key, group] of groups) {
    if (key === '[]') continue;
    if (!(key in (value as Record<string, Json>))) continue;
    const sub = (value as Record<string, Json>)[key];

    if (group.isArray) {
      if (!Array.isArray(sub)) continue;
      result[key] = group.subPaths.length
        ? sub.map((el) => applyFieldMask(el, group.subPaths))
        : sub;
    } else if (group.subPaths.length === 0) {
      result[key] = sub;
    } else {
      result[key] = applyFieldMask(sub, group.subPaths);
    }
  }
  return result;
}
