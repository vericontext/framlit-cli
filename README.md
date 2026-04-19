# framlit

CLI for [Framlit](https://framlit.app) — AI-powered video generation. Generate
Remotion videos from your terminal, render via AWS Lambda, batch-personalize
hundreds at a time. Ships an MCP server for Claude / Cursor / VS Code on the
side.

```bash
npm install -g framlit
framlit login
framlit generate "Logo animation with rotating text"
```

## Why a CLI

The CLI is the canonical surface for everything programmatic — CI pipelines,
cron jobs, agency batch runs, headless personalization for product catalogs.
The web app handles single videos and visual editing; the CLI handles the
hundredth and the thousandth.

- **Composable**: every command supports `--output json` (auto when piped) +
  `--json '<payload>'` for raw JSON-RPC-style input.
- **Streamable**: long-running calls (`render --poll`, `batch start --poll`)
  emit NDJSON status frames you can pipe through `jq`.
- **Safe to script**: every mutating command supports `--dry-run`. Strict
  input validation rejects path traversal, control chars, ID injection.
- **Self-describing**: `framlit schema` returns JSON Schema for every tool —
  no man pages to scrape.
- **One binary, two protocols**: same install (`npm i -g framlit`) ships
  both the `framlit` CLI and the `framlit-mcp` server.

## Install

```bash
# Prerequisites: Node 18+

npm install -g framlit
framlit login                  # opens browser, saves ~/.framlit/config
framlit whoami                 # email · plan · credits
```

Or set an env var (precedence over `framlit login` — handy for CI / containers):

```bash
export FRAMLIT_API_KEY=fml_xxx  # create at https://framlit.app/developers
```

## Commands

```bash
# Generate / modify
framlit generate "Product demo with fade-in text" --format portrait
framlit modify --code ./video.tsx --instruction "Change background to blue"

# Projects
framlit projects list
framlit projects get <id>
framlit projects create "My Video" --code ./video.tsx
framlit projects update <id> --name "New Name"

# Render (single video)
framlit render <projectId>
framlit render status <renderId> --poll          # NDJSON until done

# Batch (many videos from one template)
framlit batch create --rows-file rows.json --template-id flash-sale-burst
framlit batch start <jobId> --poll               # NDJSON until done
framlit batch status <jobId>
framlit batch list
framlit batch cancel <jobId>

# Style variations (A/B testing)
framlit variations generate <projectId> --prompt "..." --styles minimal,bold
framlit variations list <projectId>
framlit variations apply <projectId> <variationId>

# Discovery
framlit templates --category social
framlit credits
framlit schema                                    # all tools
framlit schema framlit_generate_code              # JSON Schema for one tool
```

Run `framlit help` for the full reference.

## Agent-friendly conventions

| Flag | Behavior |
|---|---|
| `--output json\|text` | Force output mode. Auto-JSON when stdout is piped. |
| `--json '<payload>'` or `--json -` (stdin) | Raw JSON-RPC-style input — bypasses bespoke flags, maps 1:1 to tool schema. |
| `--dry-run` | Validate + preview a mutating call without executing. Works without an API key. |
| `--poll` | NDJSON status stream until terminal state. On `render status`, `batch start`, `batch status`. |
| `framlit schema [tool]` | Runtime JSON Schema introspection for agents. |

Errors go to stderr as JSON when output is JSON:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Exit codes: `0` success · `1` general · `2` invalid args / validation · `3`
auth required · `4` API error.

## Example: batch-personalize a catalog

```bash
# rows.json — one object per video; keys map to template props
cat > rows.json <<'JSON'
[
  {"productName":"Linen Tee",   "price":"$48", "productImage":"https://..."},
  {"productName":"Wool Hoodie", "price":"$129","productImage":"https://..."}
]
JSON

# Create + start, stream until done, extract download URLs
framlit batch create --rows-file rows.json --template-id flash-sale-burst --output json \
  | jq -r '.jobId' \
  | xargs -I {} framlit batch start {} --poll \
  | jq -r 'select(.status=="completed") | .results[].videoUrl'
```

## MCP server (for IDE integration)

The same package ships an MCP server. Add to your IDE's config:

```jsonc
{
  "mcpServers": {
    "framlit": {
      "command": "npx",
      "args": ["framlit-mcp"],
      "env": { "FRAMLIT_API_KEY": "fml_your_api_key_here" }
    }
  }
}
```

Works with Cursor (`.cursor/mcp.json`), Claude Desktop
(`claude_desktop_config.json`), VS Code, Windsurf. Every CLI command above is
also exposed as an MCP tool — same handlers, same auth, same credits.

> **Back-compat note:** This package was renamed `framlit-mcp` → `framlit` in
> v0.5.0. Existing configs invoking `npx framlit-mcp` keep working — the
> `framlit` package still ships the `framlit-mcp` binary as an alias.

## Tools

All tools below are available as both CLI commands and MCP tools.

| Tool | CLI | Credits |
|------|-----|---------|
| `framlit_generate_code` | `framlit generate` | 1 |
| `framlit_modify_code` | `framlit modify` | 1 |
| `framlit_list_projects` | `framlit projects list` | 0 |
| `framlit_get_project` | `framlit projects get` | 0 |
| `framlit_create_project` | `framlit projects create` | 0 |
| `framlit_update_project` | `framlit projects update` | 0 |
| `framlit_render_video` | `framlit render` | 0 |
| `framlit_get_render_status` | `framlit render status` | 0 |
| `framlit_list_templates` | `framlit templates` | 0 |
| `framlit_get_credits` | `framlit credits` | 0 |
| `framlit_preview_code` | `framlit preview` | 0 |
| `framlit_batch_create` | `framlit batch create` | 0.2 / video |
| `framlit_batch_start` | `framlit batch start` | 0 |
| `framlit_batch_status` | `framlit batch status` | 0 |
| `framlit_batch_list` | `framlit batch list` | 0 |
| `framlit_batch_cancel` | `framlit batch cancel` | 0 |
| `framlit_generate_variations` | `framlit variations generate` | 1 / variation |
| `framlit_list_variations` | `framlit variations list` | 0 |
| `framlit_apply_variation` | `framlit variations apply` | 0 |

## Pricing

CLI and MCP use the same credit system as the Framlit web app — see
[framlit.app/pricing](https://framlit.app/pricing) for current limits and
prices. Hobby plan videos include a watermark; Pro and Team don't.

## Development

```bash
npm install
npm run dev:cli -- generate "test"        # CLI in watch mode
npm run dev                               # MCP server in watch mode
npm run build
npm test
```

## Environment

| Variable | Description |
|---|---|
| `FRAMLIT_API_KEY` | Your API key. Overrides `framlit login` config. |
| `FRAMLIT_API_URL` | Custom API URL (for local development). |

## Links

- [framlit.app](https://framlit.app) · [Developers](https://framlit.app/developers) · [Pricing](https://framlit.app/pricing) · [API Keys](https://framlit.app/settings/api-keys)

## License

MIT
