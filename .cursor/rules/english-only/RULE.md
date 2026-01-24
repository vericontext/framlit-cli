---
description: "All documentation and code must be written in English"
alwaysApply: true
---

# English-Only Policy

**All documentation and code must be written in English.**

## Scope

This rule applies to:

- **Code comments**: All inline comments, JSDoc/TSDoc comments, and code documentation
- **Documentation files**: All `.md`, `.mdc`, `.txt`, and other documentation files
- **Variable/function names**: Use English for all identifiers (already standard practice)
- **Error messages**: All user-facing and developer-facing error messages
- **API documentation**: All API route comments, OpenAPI/Swagger docs
- **README files**: All README and setup documentation
- **Configuration files**: Comments in config files (JSON, YAML, etc.)
- **MCP tool descriptions**: All MCP tool metadata and descriptions

## Exceptions

The following are exceptions where non-English content is acceptable:

- **Test data**: Test fixtures and sample data may contain non-English content for testing purposes
- **Regular expressions**: Patterns that detect or match non-English text

## Rationale

- **International collaboration**: English ensures all team members and contributors can understand the codebase
- **AI tool compatibility**: Most AI coding assistants work best with English code and documentation
- **Industry standard**: English is the de facto standard for software development
- **MCP compatibility**: MCP tools and clients expect English descriptions and metadata

## Enforcement

When writing or modifying code:

1. Write all comments in English
2. Write all documentation in English
3. Use English for all code identifiers (variables, functions, classes)
4. Write commit messages in English
5. If you find non-English content, translate it to English

## Examples

### ✅ Good

```typescript
/**
 * MCP tool to generate Remotion video code from a prompt
 * 
 * @param prompt Natural language description of the video to generate
 * @param format Video format (landscape, portrait, square)
 * @returns Generated Remotion code
 */
export async function generateCode(prompt: string, format: string): Promise<string> {
  // Validate input parameters
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt cannot be empty");
  }
  // ... rest of implementation
}
```

### ❌ Bad

```typescript
/**
 * 프롬프트로 Remotion 비디오 코드 생성하는 MCP 도구
 * 
 * @param prompt 비디오 설명
 * @param format 비디오 형식
 * @returns 생성된 코드
 */
export async function generateCode(prompt: string, format: string): Promise<string> {
  // 입력 검증
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("프롬프트가 비어있습니다");
  }
}
```

## Related Rules

- See `api-integration/RULE.md` for API integration guidelines
- See `mcp-development/RULE.md` for MCP development patterns
