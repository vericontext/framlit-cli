import { describe, it, expect } from 'vitest';
import {
  generateCodeSchema,
  modifyCodeSchema,
  getProjectSchema,
  createProjectSchema,
  updateProjectSchema,
  renderVideoSchema,
  getRenderStatusSchema,
  listTemplatesSchema,
  previewCodeSchema,
} from '../src/core/schemas';

describe('Schema validation', () => {
  describe('generateCodeSchema', () => {
    it('accepts valid input', () => {
      const result = generateCodeSchema.safeParse({ prompt: 'A logo animation' });
      expect(result.success).toBe(true);
    });

    it('accepts with optional format', () => {
      const result = generateCodeSchema.safeParse({ prompt: 'test', format: 'portrait' });
      expect(result.success).toBe(true);
    });

    it('rejects missing prompt', () => {
      const result = generateCodeSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('rejects invalid format', () => {
      const result = generateCodeSchema.safeParse({ prompt: 'test', format: 'widescreen' });
      expect(result.success).toBe(false);
    });
  });

  describe('modifyCodeSchema', () => {
    it('accepts valid input', () => {
      const result = modifyCodeSchema.safeParse({
        code: 'export const MyVideo = () => <div />',
        instruction: 'Change background to blue',
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing code', () => {
      const result = modifyCodeSchema.safeParse({ instruction: 'Change color' });
      expect(result.success).toBe(false);
    });

    it('rejects missing instruction', () => {
      const result = modifyCodeSchema.safeParse({ code: 'some code' });
      expect(result.success).toBe(false);
    });
  });

  describe('project schemas', () => {
    it('getProjectSchema requires projectId', () => {
      expect(getProjectSchema.safeParse({}).success).toBe(false);
      expect(getProjectSchema.safeParse({ projectId: 'abc' }).success).toBe(true);
    });

    it('createProjectSchema requires name, optional code/format', () => {
      expect(createProjectSchema.safeParse({}).success).toBe(false);
      expect(createProjectSchema.safeParse({ name: 'My Project' }).success).toBe(true);
      expect(createProjectSchema.safeParse({ name: 'My Project', code: 'code', format: 'square' }).success).toBe(true);
    });

    it('updateProjectSchema requires projectId', () => {
      expect(updateProjectSchema.safeParse({}).success).toBe(false);
      expect(updateProjectSchema.safeParse({ projectId: 'abc' }).success).toBe(true);
      expect(updateProjectSchema.safeParse({ projectId: 'abc', name: 'New Name' }).success).toBe(true);
    });
  });

  describe('render schemas', () => {
    it('renderVideoSchema requires projectId', () => {
      expect(renderVideoSchema.safeParse({}).success).toBe(false);
      expect(renderVideoSchema.safeParse({ projectId: 'proj_123' }).success).toBe(true);
    });

    it('getRenderStatusSchema requires renderId', () => {
      expect(getRenderStatusSchema.safeParse({}).success).toBe(false);
      expect(getRenderStatusSchema.safeParse({ renderId: 'render_abc' }).success).toBe(true);
    });
  });

  describe('listTemplatesSchema', () => {
    it('accepts empty input', () => {
      expect(listTemplatesSchema.safeParse({}).success).toBe(true);
    });

    it('accepts optional filters', () => {
      expect(listTemplatesSchema.safeParse({ category: 'social', official: true }).success).toBe(true);
    });
  });

  describe('previewCodeSchema', () => {
    it('requires code', () => {
      expect(previewCodeSchema.safeParse({}).success).toBe(false);
      expect(previewCodeSchema.safeParse({ code: 'export const X = () => null' }).success).toBe(true);
    });
  });
});
