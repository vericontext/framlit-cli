# Framlit MCP

MCP (Model Context Protocol) server for [Framlit](https://framlit.app) - AI-powered video generation.

Generate Remotion videos directly from your IDE using natural language.

## Features

- **Generate Video Code**: Create Remotion video code from text descriptions
- **Modify Code**: Edit existing code with natural language instructions
- **Project Management**: Create, list, and update Framlit projects
- **Video Rendering**: Render videos to MP4 via AWS Lambda
- **Templates**: Browse and use video templates

## Installation

### Prerequisites

- Node.js 18+
- A Framlit account with API key

### Get Your API Key

1. Go to [Framlit Settings](https://framlit.app/settings/api-keys)
2. Click "Create API Key"
3. Copy the key (you'll only see it once!)

### Configure in Cursor

Add to your Cursor settings (`.cursor/mcp.json`):

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

Or install globally:

```bash
npm install -g framlit-mcp
```

## Usage

Once configured, you can use Framlit tools in Cursor:

### Generate Video Code

```
Create a 3D logo animation with the text "HELLO" rotating in space
```

The AI will use `framlit_generate_code` to generate Remotion code.

### Modify Existing Code

```
Change the background color to blue and make the text larger
```

Uses `framlit_modify_code` with your existing code.

### Manage Projects

```
List my Framlit projects
Create a new project called "Product Demo"
```

### Render Video

```
Render the project to MP4
```

## Available Tools

| Tool | Description | Credits |
|------|-------------|---------|
| `framlit_generate_code` | Generate Remotion code from text | 1 |
| `framlit_modify_code` | Modify existing code | 1 |
| `framlit_list_projects` | List your projects | 0 |
| `framlit_get_project` | Get project details | 0 |
| `framlit_create_project` | Create a new project | 0 |
| `framlit_update_project` | Update a project | 0 |
| `framlit_render_video` | Start video rendering | 0 |
| `framlit_get_render_status` | Check render progress | 0 |
| `framlit_list_templates` | Browse templates | 0 |
| `framlit_get_credits` | Check credit balance | 0 |

## Pricing

MCP uses the same credit system as the Framlit web app:

- **Free Plan**: 50 credits/month
- **Pro Plan**: 500 credits/month ($29/mo)
- **Credit Packs**: Available for purchase

Each code generation or modification costs 1 credit.

### Watermark

- Free/Hobby plans: Videos include a Framlit watermark
- Pro/Team plans: No watermark

[View Pricing](https://framlit.app/pricing)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Test locally
FRAMLIT_API_KEY=fml_xxx npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `FRAMLIT_API_KEY` | Your Framlit API key | Yes |
| `FRAMLIT_API_URL` | Custom API URL (for development) | No |

## Resources

- [Framlit Website](https://framlit.app)
- [Documentation](https://framlit.app/docs)
- [Pricing](https://framlit.app/pricing)
- [API Key Settings](https://framlit.app/settings/api-keys)

## License

MIT
