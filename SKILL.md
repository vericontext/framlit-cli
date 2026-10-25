---
name: framlit
description: Rules and patterns for using the framlit CLI / MCP server to generate, design, render, and ship Remotion video ads. Load when the user mentions framlit, Remotion video generation, Framlit scenes, narrated ads, or brand profiles.
---

# framlit Skill

> **Naming**: `framlit` (the npm package) is the CLI + MCP server. The web
> app at https://framlit.app is a separate closed product the CLI talks to
> via `/api/mcp/*`. Same convention as `aws`, `gh`, `vercel`.

framlit is an AI video-ad generator for e-commerce. You'll use it to turn a
prompt or a JSON scene into MP4s rendered on AWS Lambda. Same package
ships both the `framlit` CLI and `framlit-mcp` server — pick whichever
surface your harness wires up.

## Invariants

1. **Dry-run first** on anything that costs credits. `--dry-run` validates
   the payload + previews cost without spending. Works without an API key.
2. **Use `--output json`** when parsing. It's auto-on when stdout is piped,
   but be explicit in scripts.
3. **Use `--json '<payload>'`** instead of bespoke flags whenever the command
   supports it. The shape is the canonical tool schema (see
   `framlit schema <tool_name>`). Stdin (`--json -`) and file
   (`--json-file <path>`) variants exist for every json-capable command.
4. **Stream long ops with `--poll`**. `render status --poll` emits NDJSON
   status frames; terminate when status is `completed` or `failed`.
   Don't poll-and-sleep yourself.
5. **Never guess IDs.** Resolve project / render / template IDs by
   listing first. IDs are validated as `[A-Za-z0-9_-]+` and bad values
   raise `VALIDATION_ERROR` (exit 2).
6. **Confirm with the user before destructive ops.** `scene create --project`
   replaces that project's video. Code generation is irreversible (credits spent).
7. **Respect Pro gating.** `narration *` and `brand set`
   beyond name+colors require Pro. Free-tier calls return `403`.

## Auth

```bash
export FRAMLIT_API_KEY=fml_xxx     # preferred for agents — overrides login
framlit whoami                     # confirms key + plan + credits
```

If the user hasn't created a key, point them to
https://framlit.app/developers.

## Happy paths

### 1. One-off video from a prompt

```bash
# Validate the prompt without spending credits
framlit generate --json '{"prompt":"Product demo with fade-in text","format":"portrait"}' \
  --dry-run --output json

# Generate the code (1 credit)
framlit generate --json '{"prompt":"Product demo with fade-in text","format":"portrait"}' \
  --output json > project.json

# Render to MP4 — stream progress until done
RENDER_ID=$(framlit render "$(jq -r .data.projectId project.json)" --output json | jq -r .data.renderId)
framlit render status "$RENDER_ID" --poll --output json | jq -r 'select(.status=="completed") | .videoUrl'
```

### 1b. Product ad without a product photo (🪄 AI image, v0.9.0+)

When the user wants a product showcase but has no image attached, opt into
AI image generation so the agent calls `generate_product_image` first
instead of hallucinating an image URL or painting CSS shapes:

```bash
# Default: FLUX-schnell (1 base + 3 image-gen = 4 cr, ~3s wall time)
framlit generate "15-second sneaker showcase ad, dark premium background" \
  --image-gen --output json

# Premium: GPT Image 2 (1 + 12 = 13 cr, ~10-15s, photoreal + reference-image input)
framlit generate "Hero shot of a luxury watch, studio lighting" \
  --image-gen --image-gen-model gpt-image-2 --output json

# Same via --json
framlit generate --json '{"prompt":"...","imageGen":{"enabled":true,"model":"flux-schnell"}}' \
  --output json
```

Default to `flux-schnell` unless the user asks for photorealism or has
already mentioned a reference photo. The generated image is saved to the
user's `workspace-assets` Supabase bucket and lands inside `<Img src=...>`
in the returned code automatically — no extra step.

### 2. Narrated ad (Pro, 3 cr, ~90-180s wall time)

```bash
framlit narration cap                                   # check monthly slot
framlit narration generate --json '{"brief":"Built for runners who hate stiff shoes","targetSeconds":20,"language":"en"}' \
  --dry-run --output json
framlit narration generate --json '{"brief":"Built for runners who hate stiff shoes","targetSeconds":20,"language":"en"}' \
  --output json
framlit narration stages <projectId> --format md > narration.md
```

### 3. Brand DNA upsert

```bash
# Free tier: name + 3 colors + fonts only
cat > brand.json <<'JSON'
{ "brand_name": "Acme Run", "colors": ["#0F172A", "#22C55E", "#FFFFFF"] }
JSON
framlit brand set --json-file brand.json --dry-run --output json
framlit brand set --json-file brand.json --output json
framlit brand get --output json
```

### 4. Design the video yourself (Framlit Scene v1, 0 credits, v0.11.0+)

When you know exactly what the video should look like, write it as a scene
instead of a prompt. Framlit compiles the JSON into an editable project:
the user can drag layers, retime them and record motion in the editor, and
you can read their edits back. Never send Remotion code; Framlit only
renders code it produced.

```bash
cat > scene.json <<'JSON'
{
  "version": 1,
  "canvas": { "width": 1080, "height": 1920, "fps": 30, "durationInFrames": 150 },
  "background": { "gradient": { "from": "#0f172a", "to": "#1e293b", "angle": 160 } },
  "layers": [
    { "id": "headline", "type": "text", "text": "Ship faster", "x": 80, "y": 300, "width": 920, "height": 260,
      "style": { "fontFamily": "Poppins", "fontSize": 120, "fontWeight": 800, "color": "#ffffff", "textAlign": "center" },
      "enter": { "preset": "rise" } },
    { "id": "product", "type": "image", "src": "https://example.com/product.png", "x": 140, "y": 640, "width": 800, "height": 800,
      "frameRange": [20, 149], "style": { "objectFit": "contain" }, "enter": { "preset": "pop", "durationInFrames": 20 } },
    { "id": "cta", "type": "text", "text": "Order now", "x": 240, "y": 1560, "width": 600, "height": 140, "frameRange": [60, 149],
      "style": { "background": "#22c55e", "borderRadius": 70, "fontSize": 56, "textAlign": "center", "color": "#052e16" },
      "enter": { "preset": "slideLeft" } }
  ],
  "motion": [{ "layerId": "headline", "points": [{ "frame": 30, "x": 0, "y": 0 }, { "frame": 60, "x": 0, "y": -80 }] }]
}
JSON
framlit scene create --file scene.json --name "Launch" --output json > made.json   # 0 credits
PROJECT=$(jq -r .data.projectId made.json)

# After the user edits it in the browser, read their changes back:
framlit scene get "$PROJECT" --output json | jq .data.scene > scene.json
# ...change scene.json, then replace the project's video:
framlit scene create --file scene.json --project "$PROJECT" --output json
```

- Coordinates are pixels on the canvas; `frameRange` is `[first, last]` frame.
- Layer types: `text`, `image`, `video`, `shape`. Media must be `https://`.
- Presets: `fade`, `rise`, `pop`, `slideLeft`, `slideRight`, `wipe`.
- Full schema: https://framlit.app/schemas/framlit-scene.v1.json
- `scene get` on a project Framlit's AI generated returns `complete: false`:
  its layers come back, but sending it back replaces the AI's design.

## Discoverability

```bash
framlit help                       # all commands + flags
framlit schema                     # full tool registry (18 tools, JSON Schema)
framlit schema framlit_generate_code   # one tool's input schema
```

If you don't know what arg a tool takes, `framlit schema <name>` is the
authoritative answer — not `--help`, not training data, not this file.

## Output / error contract

JSON mode (the mode you should always use as an agent):

```json
{ "data": { ... }, "message": "<human prose, ignore>" }
```

Errors go to **stderr** as JSON:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

Common error codes you should expect to handle:

| Code | Meaning | What to do |
|---|---|---|
| `VALIDATION_ERROR` (exit 2) | Bad input — wrong type, traversal, control char, ID format | Re-read schema, fix payload |
| `INVALID_ARGUMENT` (exit 2) | Missing required arg, bad enum | Same |
| `AUTH_REQUIRED` (exit 3) | No key / expired session | Ask user to set `FRAMLIT_API_KEY` or `framlit login` |
| `INSUFFICIENT_CREDITS` (exit 4) | Out of credits | Don't retry — point user at upgrade |
| `RATE_LIMITED` (exit 4) | Too many requests | Backoff, then retry |
| `API_ERROR` (exit 4) | Server / network issue | Retry once with backoff; surface to user if it persists |

## Anti-patterns

- ❌ Hardcoding credit costs — they change. Read `framlit schema`.
- ❌ Polling render status without `--poll` (you'll burn cycles).
- ❌ Running `generate` in a retry loop — every attempt costs 1 credit.
- ❌ Building payloads with shell string interpolation that contains user
  input. Pipe through `jq -n` instead, or use `--json-file`.
- ❌ Treating text-mode output as parseable. It isn't.

## When to escalate to the user

- A `generate` / `modify` request returns code that doesn't match the brief.
  Don't loop more than once — surface the brief mismatch.
- Any Pro-gated call (`narration`, full `brand set`) when
  `framlit whoami` shows `plan: hobby`. Don't try, you'll get 403.
