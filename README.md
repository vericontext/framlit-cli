# Framlit MCP + CLI

MCP server and CLI for [Framlit](https://framlit.app) — AI-powered video generation.

Generate Remotion videos from your IDE or terminal using natural language.

## Features

- **Generate Video Code**: Create Remotion video code from text descriptions
- **Modify Code**: Edit existing code with natural language instructions
- **Project Management**: Create, list, and update Framlit projects
- **Video Rendering**: Render videos to MP4 via AWS Lambda
- **Templates**: Browse and use video templates
- **Narration**: AI-generated voiceover with ElevenLabs TTS
- **Style Variations**: Generate multiple visual styles from one prompt
- **Batch Rendering**: Render multiple videos at once with variable substitution

## Installation

### Prerequisites

- Node.js 18+
- A Framlit account with API key

### Get Your API Key

1. Go to [Framlit Settings](https://framlit.app/settings/api-keys)
2. Click "Create Key" and copy the key (you'll only see it once!)

### MCP Server (IDE Integration)

Add to your editor's MCP config:

**Cursor** (`.cursor/mcp.json`), **Claude Desktop** (`claude_desktop_config.json`), **VS Code** (MCP settings), **Windsurf** (MCP settings):

```json
{
  "mcpServers": {
    "framlit": {
      "command": "npx",
      "args": ["framlit-mcp"],
      "env": {
        "FRAMLIT_API_KEY": "fml_your_api_key_here"
      }
    }
  }
}
```

### CLI (Terminal)

```bash
# Use directly via npx
npx framlit generate "A logo animation with rotating 3D text"

# Or install globally
npm install -g framlit-mcp
framlit generate "Product demo with fade-in text"
```

## CLI Usage

```bash
# Generate video code
framlit generate "Logo animation with rotating text" --format landscape

# Modify existing code
framlit modify --code ./video.tsx --instruction "Change background to blue"

# Manage projects
framlit projects list
framlit projects get <id>
framlit projects create "My Video" --code ./video.tsx
framlit projects update <id> --name "New Name"

# Render video
framlit render <projectId>
framlit render status <renderId> --poll   # Stream progress as NDJSON

# Browse templates
framlit templates --category social

# Preview code
framlit preview ./video.tsx

# Check credits
framlit credits

# Discover tool schemas (agent-friendly)
framlit schema                           # List all tools
framlit schema framlit_generate_code     # JSON Schema for a specific tool

# Start MCP server from CLI
framlit mcp
```

### Agent-Friendly Features

The CLI is designed to work seamlessly with AI agents:

- **`--output json`**: Structured JSON output (auto-enabled when piped)
- **`--json '{"prompt":"..."}'`**: Raw JSON input, bypass arg parsing
- **`--dry-run`**: Preview mutations without executing
- **`framlit schema <tool>`**: Runtime schema introspection (Zod → JSON Schema)
- **`--poll`**: NDJSON streaming for render progress tracking

### Full Render Workflow

```bash
# 1. Generate code
framlit generate "Product demo video" --output json > code.json

# 2. Create a project
framlit projects create "Product Demo" --code ./generated.tsx --output json

# 3. Start render
framlit render <projectId> --output json

# 4. Poll until complete
framlit render status <renderId> --poll
```

## Available Tools

| Tool | Description | Credits |
|------|-------------|---------|
| `framlit_generate_code` | Generate Remotion code from text | 1 |
| `framlit_modify_code` | Modify existing code | 1 |
| `framlit_list_projects` | List your projects | 0 |
| `framlit_get_project` | Get project details with code | 0 |
| `framlit_create_project` | Create a new project | 0 |
| `framlit_update_project` | Update a project | 0 |
| `framlit_render_video` | Start video rendering | 0 |
| `framlit_get_render_status` | Check render progress | 0 |
| `framlit_list_templates` | Browse templates | 0 |
| `framlit_get_credits` | Check credit balance | 0 |
| `framlit_preview_code` | Create temporary preview URL | 0 |

## Pricing

MCP and CLI use the same credit system as the Framlit web app:

- **Hobby (Free)**: 30 credits/month
- **Pro**: 500 credits/month ($29/mo)
- **Team**: 2,000 credits/month ($99/mo)
- **Credit Packs**: 100 for $6 / 350 for $19 / 700 for $35

### Credit Costs

| Action | Credits |
|--------|---------|
| Text-to-Code generation | 1 |
| Code modification | 1 |
| Image analysis | 3 |
| Narration (voiceover) | 5 |
| Style variation | 1 |
| Batch rendering (per video) | 0.2 |
| MP4 rendering | 0 |
| Preview | 0 |

### Watermark

- Hobby plan: Videos include a Framlit watermark
- Pro/Team plans: No watermark

[View Pricing](https://framlit.app/pricing)

## Development

```bash
# Install dependencies
npm install

# Run MCP server in development mode
npm run dev

# Run CLI in development mode
npm run dev:cli -- generate "test"

# Build
npm run build

# Test MCP server locally
FRAMLIT_API_KEY=fml_xxx npm start

# Test CLI locally
FRAMLIT_API_KEY=fml_xxx npm run start:cli -- credits
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FRAMLIT_API_KEY` | Your Framlit API key | Yes |
| `FRAMLIT_API_URL` | Custom API URL (for development) | No |

## Resources

- [Framlit Website](https://framlit.app)
- [Developer Guide](https://framlit.app/developers)
- [Documentation](https://framlit.app/docs)
- [Pricing](https://framlit.app/docs/pricing)
- [API Key Settings](https://framlit.app/settings/api-keys)

## License

MIT
