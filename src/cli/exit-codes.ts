/**
 * CLI Exit Codes
 *
 * Meaningful exit codes for agent retry/debugging logic.
 */

export const EXIT = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  INVALID_ARGS: 2,
  AUTH_REQUIRED: 3,
  API_ERROR: 4,
} as const;

export type ExitCode = typeof EXIT[keyof typeof EXIT];

/**
 * Error code strings for structured JSON error responses.
 */
export type ErrorCode =
  | 'INVALID_ARGUMENT'
  | 'AUTH_REQUIRED'
  | 'INSUFFICIENT_CREDITS'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'API_ERROR'
  | 'UNKNOWN_COMMAND'
  | 'VALIDATION_ERROR';

/**
 * Map error code to exit code.
 */
export function exitCodeForError(code: ErrorCode): ExitCode {
  switch (code) {
    case 'INVALID_ARGUMENT':
    case 'VALIDATION_ERROR':
      return EXIT.INVALID_ARGS;
    case 'AUTH_REQUIRED':
      return EXIT.AUTH_REQUIRED;
    case 'UNKNOWN_COMMAND':
      return EXIT.INVALID_ARGS;
    default:
      return EXIT.API_ERROR;
  }
}
