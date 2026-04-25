# framlit

> **`framlit`** is the **command-line + MCP server** for the Framlit AI video
> ad platform (web app at https://framlit.app). Same naming convention as
> `aws` / `gh` / `vercel` — the brand IS the CLI tool. The web app is a
> separate, closed product; this npm package only talks to its public
> `/api/mcp/*` endpoints. MIT licensed, PRs welcome.

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
framlit batch create --manifest catalog.json --template-id spotlight-minimal  # local images
framlit batch start <jobId> --poll               # NDJSON until done
framlit batch status <jobId>
framlit batch list
framlit batch cancel <jobId>

# Style variations (A/B testing)
framlit variations generate <projectId> --prompt "..." --styles minimal,bold
framlit variations list <projectId>
framlit variations apply <projectId> <variationId>

# Narrated ads — script + voiceover + word-synced visuals (Pro, v0.7+)
framlit narration generate "Built for runners who hate stiff shoes"
framlit narration cap                        # current month usage / cap
framlit narration stages <projectId> --format md > narration.md

# Campaigns — multi-segment plan + parallel fan-out (Pro, v0.7+)
framlit campaign plan "Black Friday push for outerwear" --output json > plan.json
framlit campaign execute --plan-file plan.json
framlit campaign runs
framlit campaign run <runId>

# Brand DNA (v0.7+)
framlit brand get
framlit brand set --json-file brand.json     # Free: name + 3 colors only

# Shopify (v0.7+, read-only — connect via web first)
framlit shopify products --limit 10 --output json | jq

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
| `--json-file <path>` | Read the same JSON payload from disk. Path-traversal validated. |
| `--fields "data.id,data.name"` | Client-side projection. Shrinks the JSON response to just these dot-paths so big list/get responses don't blow up your context. Supports `items[].id` array projection. |
| `--sanitize` | Strip known prompt-injection markers from text inputs (`brief`, `prompt`, `instruction`) before dispatching. Reports stripped lines on stderr. Opt-in. |
| `--image-gen` (`generate` only) | Force AI product image generation. Adds 3 cr (default flux-schnell) or 12 cr (`--image-gen-model gpt-image-2`). Use when prompt mentions a product but no image is attached — prevents hallucinated URLs / CSS-painted placeholders. v0.9.0+. |
| `--dry-run` | Validate + preview a mutating call without executing. Works without an API key. |
| `--poll` | NDJSON status stream until terminal state. On `render status`, `batch start`, `batch status`. |
| `framlit schema [tool]` | Runtime JSON Schema introspection for agents. |

For agents loading the CLI as a tool, ship these alongside your harness:

- [`SKILL.md`](./SKILL.md) — invariants and happy-path patterns
- [`CONTEXT.md`](./CONTEXT.md) — vocabulary, services, security model
- [`AGENTS.md`](./AGENTS.md) — README-for-AI entry point

The MCP server can be subset to keep tool count small:

```bash
# Only load narration + campaign + brand tools (7/29) — saves prompt tokens
npx framlit-mcp --services narration,campaign,brand
# or via env:
FRAMLIT_MCP_SERVICES=batch,brand npx framlit-mcp
```

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

## Example: batch from a local catalog (`--manifest`)

When your product photos live on disk (Etsy, Squarespace, pre-launch brands),
use `--manifest` to upload them as part of `batch create`. Any key ending in
`Path` is treated as a local file — the CLI uploads it and substitutes the
resulting URL under the matching non-`Path` key.

```bash
# catalog.json lives alongside ./photos/*.jpg
cat > catalog.json <<'JSON'
[
  { "productImagePath": "./photos/cloud-runner.jpg", "productName": "Cloud Runner", "price": "$129" },
  { "productImagePath": "./photos/hydration-vest.jpg", "productName": "Hydration Vest", "price": "$89" },
  { "productImage": "https://cdn.example.com/existing.jpg", "productName": "Signature Tee", "price": "$39" }
]
JSON

# Dry-run first to see what will upload
framlit batch create --manifest catalog.json --template-id spotlight-minimal --dry-run

# Run for real — uploads 2 images then creates the batch
framlit batch create --manifest catalog.json --template-id spotlight-minimal
```

Rules:
- Field suffix `Path` → local file path (relative to the manifest's directory, or absolute).
  The uploaded URL replaces that key with the non-`Path` counterpart.
- Same field without `Path` → URL or data URL → passed through unchanged.
- `http://`, `https://`, or `data:` URLs under a `*Path` key are hoisted automatically
  (no upload trip).
- Supported extensions: `.jpg` / `.jpeg` / `.png` / `.webp` / `.gif`. Max 5 MiB per image.

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
