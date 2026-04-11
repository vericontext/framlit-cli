import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  rejectControlChars,
  validateResourceId,
  validateSafePath,
  validateTextInput,
} from '../src/cli/validation';

describe('rejectControlChars', () => {
  it('allows normal text', () => {
    expect(() => rejectControlChars('Hello World', 'test')).not.toThrow();
  });

  it('allows tabs and newlines', () => {
    expect(() => rejectControlChars('line1\nline2\ttab', 'test')).not.toThrow();
  });

  it('rejects null bytes', () => {
    expect(() => rejectControlChars('hello\x00world', 'test')).toThrow(ValidationError);
  });

  it('rejects escape sequences', () => {
    expect(() => rejectControlChars('hello\x1b[31m', 'test')).toThrow(ValidationError);
  });

  it('rejects backspace', () => {
    expect(() => rejectControlChars('hello\x08', 'test')).toThrow(ValidationError);
  });
});

describe('validateResourceId', () => {
  it('allows valid UUIDs', () => {
    expect(() => validateResourceId('550e8400-e29b-41d4-a716-446655440000', 'id')).not.toThrow();
  });

  it('allows alphanumeric IDs', () => {
    expect(() => validateResourceId('abc123-def456', 'id')).not.toThrow();
  });

  it('rejects query parameter injection', () => {
    expect(() => validateResourceId('abc?admin=true', 'id')).toThrow(ValidationError);
  });

  it('rejects hash injection', () => {
    expect(() => validateResourceId('abc#fragment', 'id')).toThrow(ValidationError);
  });

  it('rejects percent encoding', () => {
    expect(() => validateResourceId('abc%2F..%2F', 'id')).toThrow(ValidationError);
  });

  it('rejects spaces', () => {
    expect(() => validateResourceId('abc def', 'id')).toThrow(ValidationError);
  });

  it('rejects slashes', () => {
    expect(() => validateResourceId('abc/def', 'id')).toThrow(ValidationError);
  });

  it('rejects empty string', () => {
    expect(() => validateResourceId('', 'id')).toThrow(ValidationError);
  });

  it('rejects overly long IDs', () => {
    expect(() => validateResourceId('a'.repeat(201), 'id')).toThrow(ValidationError);
  });
});

describe('validateSafePath', () => {
  it('allows normal paths', () => {
    expect(() => validateSafePath('./video.tsx', 'path')).not.toThrow();
    expect(() => validateSafePath('src/code.ts', 'path')).not.toThrow();
  });

  it('rejects path traversal', () => {
    expect(() => validateSafePath('../../etc/passwd', 'path')).toThrow(ValidationError);
    expect(() => validateSafePath('foo/../../../bar', 'path')).toThrow(ValidationError);
  });

  it('allows single dots', () => {
    expect(() => validateSafePath('./file.ts', 'path')).not.toThrow();
  });
});

describe('validateTextInput', () => {
  it('allows normal text', () => {
    expect(() => validateTextInput('Create a logo animation', 'prompt')).not.toThrow();
  });

  it('allows unicode', () => {
    expect(() => validateTextInput('로고 애니메이션 만들기', 'prompt')).not.toThrow();
  });

  it('rejects control chars', () => {
    expect(() => validateTextInput('hello\x00world', 'prompt')).toThrow(ValidationError);
  });

  it('rejects text exceeding max length', () => {
    expect(() => validateTextInput('a'.repeat(10001), 'prompt')).toThrow(ValidationError);
  });

  it('respects custom max length', () => {
    expect(() => validateTextInput('a'.repeat(201), 'name', 200)).toThrow(ValidationError);
    expect(() => validateTextInput('a'.repeat(200), 'name', 200)).not.toThrow();
  });
});
