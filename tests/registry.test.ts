import { describe, it, expect } from 'vitest';
import { TOOL_REGISTRY, getToolByName, getToolNames, zodToJsonSchema } from '../src/core/registry';

describe('Tool Registry', () => {
  it('should have all tools registered (v0.12 retired batch, variations and campaign)', () => {
    expect(TOOL_REGISTRY).toHaveLength(18);
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
    expect(names).toHaveLength(18);
    expect(names).toContain('framlit_generate_code');
    expect(names).toContain('framlit_create_scene');
    expect(names).toContain('framlit_get_scene');
    expect(names).toContain('framlit_render_video');
    // v0.7 additions
    expect(names).toContain('framlit_generate_narrated_ad');
    expect(names).toContain('framlit_get_brand');
  });

  it('credit costs: code gen tools cost 1, most others cost 0', () => {
    const codeGenTools = TOOL_REGISTRY.filter((t) =>
      t.name === 'framlit_generate_code' || t.name === 'framlit_modify_code'
    );
    for (const tool of codeGenTools) {
      expect(tool.credits).toBe(1);
    }

    expect(getToolByName('framlit_generate_narrated_ad')!.credits).toBe(3);
  });

  it('does not register the retired batch, variations and campaign tools', () => {
    const names = getToolNames();
    for (const name of names) {
      expect(name).not.toMatch(/batch|variation|campaign/);
    }
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
