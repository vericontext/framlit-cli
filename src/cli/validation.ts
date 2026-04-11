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
