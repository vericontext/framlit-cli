/**
 * Input Validation
 *
 * Defends against path traversal, control character injection,
 * and resource ID injection from untrusted agent input.
 */

// Control characters (0x00-0x1F except tab 0x09, newline 0x0A, CR 0x0D)
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;

// Dangerous resource ID characters that could cause URL injection
const UNSAFE_ID_RE = /[?#%&=\s/\\]/;

// Path traversal patterns
const PATH_TRAVERSAL_RE = /(?:^|\/)\.\.(?:\/|$)/;

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Reject strings containing control characters (except tab/newline/CR).
 * Prevents terminal escape injection and hidden content.
 */
export function rejectControlChars(value: string, fieldName: string): void {
  if (CONTROL_CHAR_RE.test(value)) {
    throw new ValidationError(
      `${fieldName} contains control characters — rejected for safety`
    );
  }
}

/**
 * Validate a resource ID (project ID, render ID, etc).
 * Blocks characters that could cause URL parameter injection.
 */
export function validateResourceId(id: string, fieldName: string): void {
  rejectControlChars(id, fieldName);
  if (UNSAFE_ID_RE.test(id)) {
    throw new ValidationError(
      `${fieldName} contains invalid characters (?, #, %, &, =, spaces, slashes are not allowed)`
    );
  }
  if (id.length === 0 || id.length > 200) {
    throw new ValidationError(
      `${fieldName} must be 1-200 characters`
    );
  }
}

/**
 * Validate a file path is safe (no traversal).
 */
export function validateSafePath(filePath: string, fieldName: string): void {
  rejectControlChars(filePath, fieldName);
  if (PATH_TRAVERSAL_RE.test(filePath)) {
    throw new ValidationError(
      `${fieldName} contains path traversal (../) — rejected for safety`
    );
  }
}

/**
 * Validate user-provided text input (prompts, names, instructions).
 * Allows most content but rejects control characters.
 */
export function validateTextInput(value: string, fieldName: string, maxLength = 10000): void {
  rejectControlChars(value, fieldName);
  if (value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} exceeds maximum length of ${maxLength} characters`
    );
  }
}

// Common prompt-injection markers. Conservative — these are known patterns,
// not a complete defense. Matches case-insensitively, line-anchored where
// it makes sense to avoid false positives in legitimate prose.
const INJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\bignore\s+(?:all|any|the|previous|prior|above|earlier)\s+instructions?\b/i,
  /\bdisregard\s+(?:all|any|the|previous|prior|above|earlier)\s+instructions?\b/i,
  /<\/?(?:system|instructions?|user|assistant|prompt)>/i,
  /^\s*(?:system|user|assistant|human)\s*:\s*/im,
  /\[\[\s*(?:system|prompt|instructions?)\s*\]\]/i,
];

/**
 * Strip lines matching known prompt-injection patterns from untrusted text.
 * Opt-in via `--sanitize` — agents should call this before passing
 * user-supplied / web-scraped strings into prompts (`brief`, `prompt`,
 * `instruction`).
 *
 * Returns `{ value, removed }` so the caller can warn the user when
 * something was actually stripped.
 */
export function sanitizeUntrustedText(input: string): { value: string; removed: string[] } {
  const removed: string[] = [];
  const cleanedLines: string[] = [];
  for (const line of input.split(/\r?\n/)) {
    const matched = INJECTION_PATTERNS.some((re) => re.test(line));
    if (matched) {
      removed.push(line.trim());
    } else {
      cleanedLines.push(line);
    }
  }
  return { value: cleanedLines.join('\n').trim(), removed };
}
