import { describe, it, expect } from 'vitest';
import { TOOL_REGISTRY, getToolByName, getToolNames, zodToJsonSchema } from '../src/core/registry';

describe('Tool Registry', () => {
  it('should have 11 tools registered', () => {
    expect(TOOL_REGISTRY).toHaveLength(19);
  });

  it('should have unique tool names', () => {
    const names = TOOL_REGISTRY.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all tool names should start with framlit_', () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.name).toMatch(/^framlit_/);
    }
  });

  it('all tools should have description, schema, handler, credits, and category', () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.description).toBeTruthy();
      expect(tool.schema).toBeDefined();
      expect(typeof tool.handler).toBe('function');
      expect(tool.credits).toBeDefined();
      expect(tool.category).toBeTruthy();
    }
  });

  it('getToolByName returns correct tool', () => {
    const tool = getToolByName('framlit_generate_code');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('framlit_generate_code');
    expect(tool!.credits).toBe(1);
  });

  it('getToolByName returns undefined for unknown tool', () => {
    expect(getToolByName('nonexistent')).toBeUndefined();
  });

  it('getToolNames returns all names', () => {
    const names = getToolNames();
    expect(names).toHaveLength(19);
    expect(names).toContain('framlit_generate_code');
    expect(names).toContain('framlit_render_video');
  });

  it('credit costs: code gen tools cost 1, most others cost 0', () => {
    const codeGenTools = TOOL_REGISTRY.filter((t) =>
      t.name === 'framlit_generate_code' || t.name === 'framlit_modify_code'
    );
    for (const tool of codeGenTools) {
      expect(tool.credits).toBe(1);
    }

    // Batch and variation tools have string-based costs
    const batchCreate = getToolByName('framlit_batch_create');
    expect(batchCreate!.credits).toBe('0.2/video');

    const genVariations = getToolByName('framlit_generate_variations');
    expect(genVariations!.credits).toBe('1/variation');
  });
});

describe('zodToJsonSchema', () => {
  it('converts generateCodeSchema correctly', () => {
    const tool = getToolByName('framlit_generate_code')!;
    const jsonSchema = zodToJsonSchema(tool.schema);

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties).toBeDefined();

    const props = jsonSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.prompt).toBeDefined();
    expect(props.prompt.type).toBe('string');
    expect(props.format).toBeDefined();

    const required = jsonSchema.required as string[];
    expect(required).toContain('prompt');
    expect(required).not.toContain('format');
  });

  it('converts empty schema (listProjects) correctly', () => {
    const tool = getToolByName('framlit_list_projects')!;
    const jsonSchema = zodToJsonSchema(tool.schema);

    expect(jsonSchema.type).toBe('object');
    const props = jsonSchema.properties as Record<string, unknown>;
    expect(Object.keys(props)).toHaveLength(0);
  });
});
