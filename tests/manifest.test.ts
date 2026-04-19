import { describe, it, expect } from 'vitest';
import {
  parseManifest,
  applyUploadResults,
  mimeFromFilename,
} from '../src/core/manifest';

describe('parseManifest', () => {
  it('collects *Path fields as pending uploads', () => {
    const raw = JSON.stringify([
      { productImagePath: './shirt.jpg', productName: 'Shirt', price: '$29' },
      { productImagePath: '/abs/path/tee.png', productName: 'Tee', price: '$19' },
    ]);
    const result = parseManifest(raw);
    expect(result.rows).toHaveLength(2);
    expect(result.uploads).toHaveLength(2);
    expect(result.uploads[0]).toEqual({
      rowIndex: 0,
      fieldName: 'productImagePath',
      localPath: './shirt.jpg',
      targetField: 'productImage',
    });
    expect(result.uploads[1].targetField).toBe('productImage');
  });

  it('substitutes pre-uploaded URLs under the *Path key without queuing an upload', () => {
    const raw = JSON.stringify([
      {
        productImagePath: 'https://cdn.example.com/shirt.jpg',
        productName: 'Shirt',
      },
    ]);
    const result = parseManifest(raw);
    expect(result.uploads).toHaveLength(0);
    // URL was hoisted up to the target field.
    expect(result.rows[0].productImage).toBe('https://cdn.example.com/shirt.jpg');
    expect(result.rows[0]).not.toHaveProperty('productImagePath');
  });

  it('accepts mixed URL + local path rows in one manifest', () => {
    const raw = JSON.stringify([
      { productImagePath: './local.jpg', productName: 'A' },
      { productImagePath: 'https://cdn.example.com/b.png', productName: 'B' },
      { productImage: 'https://cdn.example.com/c.png', productName: 'C' },
    ]);
    const result = parseManifest(raw);
    expect(result.uploads).toHaveLength(1);
    expect(result.uploads[0].rowIndex).toBe(0);
    // Row 1: URL hoisted.
    expect(result.rows[1].productImage).toBe('https://cdn.example.com/b.png');
    expect(result.rows[1]).not.toHaveProperty('productImagePath');
    // Row 2: unchanged.
    expect(result.rows[2].productImage).toBe('https://cdn.example.com/c.png');
  });

  it('stringifies number + boolean cell values for batch API compatibility', () => {
    const raw = JSON.stringify([{ productName: 'X', price: 29, onSale: true }]);
    const result = parseManifest(raw);
    expect(result.rows[0]).toEqual({ productName: 'X', price: '29', onSale: 'true' });
  });

  it('accepts data: URLs without queuing upload', () => {
    const raw = JSON.stringify([
      {
        productImagePath:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA',
        productName: 'X',
      },
    ]);
    const result = parseManifest(raw);
    expect(result.uploads).toHaveLength(0);
    expect(result.rows[0].productImage).toMatch(/^data:image\/png/);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseManifest('{not json}')).toThrow(/not valid JSON/);
  });

  it('rejects non-array root', () => {
    expect(() => parseManifest('{"a": 1}')).toThrow(/non-empty JSON array/);
  });

  it('rejects empty array', () => {
    expect(() => parseManifest('[]')).toThrow(/non-empty JSON array/);
  });

  it('rejects primitive row', () => {
    expect(() => parseManifest('["string"]')).toThrow(/must be an object/);
  });

  it('rejects nested object value', () => {
    const raw = JSON.stringify([{ meta: { nested: true } }]);
    expect(() => parseManifest(raw)).toThrow(/string, number, boolean/);
  });

  it('ignores empty path values (user intentionally skipped)', () => {
    const raw = JSON.stringify([
      { productImagePath: '', productName: 'Skip Me' },
    ]);
    const result = parseManifest(raw);
    expect(result.uploads).toHaveLength(0);
    // Empty path is preserved as empty string on the *Path key.
    expect(result.rows[0].productImagePath).toBe('');
  });
});

describe('applyUploadResults', () => {
  it('substitutes URLs into the target field and drops the *Path key', () => {
    const { rows, uploads } = parseManifest(
      JSON.stringify([
        { productImagePath: './a.jpg', productName: 'A' },
        { heroImagePath: './b.jpg', productName: 'B' },
      ]),
    );
    const resolved = new Map<string, string>([
      ['0:productImagePath', 'https://upload/a.jpg'],
      ['1:heroImagePath', 'https://upload/b.jpg'],
    ]);
    applyUploadResults(rows, uploads, resolved);
    expect(rows[0]).toEqual({
      productImage: 'https://upload/a.jpg',
      productName: 'A',
    });
    expect(rows[1]).toEqual({
      heroImage: 'https://upload/b.jpg',
      productName: 'B',
    });
  });

  it('throws when a resolved URL is missing for a pending upload', () => {
    const { rows, uploads } = parseManifest(
      JSON.stringify([{ productImagePath: './a.jpg' }]),
    );
    expect(() => applyUploadResults(rows, uploads, new Map())).toThrow(
      /Upload result missing/,
    );
  });
});

describe('mimeFromFilename', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.JPEG', 'image/jpeg'],
    ['photo.png', 'image/png'],
    ['photo.webp', 'image/webp'],
    ['photo.gif', 'image/gif'],
  ])('maps %s → %s', (filename, mime) => {
    expect(mimeFromFilename(filename)).toBe(mime);
  });

  it('rejects unknown extension', () => {
    expect(() => mimeFromFilename('doc.pdf')).toThrow(/Unsupported image extension/);
  });

  it('rejects no extension', () => {
    expect(() => mimeFromFilename('noext')).toThrow(/Cannot infer MIME/);
  });
});
