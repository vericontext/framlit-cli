import { describe, it, expect } from 'vitest';
import { applyFieldMask, parseFieldMask } from '../src/cli/field-mask';

describe('parseFieldMask', () => {
  it('returns null for empty / undefined', () => {
    expect(parseFieldMask(undefined)).toBeNull();
    expect(parseFieldMask('')).toBeNull();
    expect(parseFieldMask('  ,  ')).toBeNull();
  });

  it('splits on commas and trims', () => {
    expect(parseFieldMask('a, b ,c')).toEqual(['a', 'b', 'c']);
  });
});

describe('applyFieldMask', () => {
  it('keeps top-level field', () => {
    const data = { id: '1', name: 'foo', secret: 'shh' };
    expect(applyFieldMask(data, ['id', 'name'])).toEqual({ id: '1', name: 'foo' });
  });

  it('keeps nested dot-paths', () => {
    const data = { data: { projectId: 'p1', code: 'x', meta: { v: 1 } } };
    expect(applyFieldMask(data, ['data.projectId'])).toEqual({ data: { projectId: 'p1' } });
  });

  it('merges multiple paths under same head', () => {
    const data = { data: { a: 1, b: 2, c: 3 } };
    expect(applyFieldMask(data, ['data.a', 'data.c'])).toEqual({ data: { a: 1, c: 3 } });
  });

  it('projects array elements with [] syntax', () => {
    const data = { projects: [{ id: 1, name: 'a', desc: 'x' }, { id: 2, name: 'b', desc: 'y' }] };
    expect(applyFieldMask(data, ['projects[].id', 'projects[].name'])).toEqual({
      projects: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
    });
  });

  it('returns empty object when no path matches', () => {
    expect(applyFieldMask({ a: 1 }, ['b', 'c'])).toEqual({});
  });

  it('returns input unchanged when paths empty', () => {
    const data = { a: 1, b: 2 };
    expect(applyFieldMask(data, [])).toBe(data);
  });

  it('handles top-level array projection', () => {
    const data = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
    expect(applyFieldMask(data, ['[].id'])).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('silently skips array path on non-array value', () => {
    expect(applyFieldMask({ items: 'not-an-array' }, ['items[].id'])).toEqual({});
  });
});
