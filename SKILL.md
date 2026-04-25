---
name: framlit
description: Rules and patterns for using the framlit CLI / MCP server to generate, render, batch-personalize, and ship Remotion video ads. Load when the user mentions framlit, Remotion video generation, ad batch personalization, narrated ads, or campaign planning.
---

# framlit Skill

framlit is an AI video-ad generator for e-commerce. You'll use it to turn a
prompt or product catalog into MP4s rendered on AWS Lambda. Same package
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
4. **Stream long ops with `--poll`**. Render and batch operations emit NDJSON
   status frames — terminate when status is `completed` / `failed` /
   `cancelled`. Don't poll-and-sleep yourself.
5. **Never guess IDs.** Resolve project / batch / template / run IDs by
   listing first. IDs are validated as `[A-Za-z0-9_-]+` and bad values
   raise `VALIDATION_ERROR` (exit 2).
6. **Confirm with the user before destructive ops.** `batch cancel` is
   irreversible. Code generation is irreversible (credits spent).
7. **Respect Pro gating.** `narration *`, `campaign *`, and `brand set`
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

### 2. Batch-personalize from a product catalog

```bash
# Local images: --manifest. Any key ending in `Path` is uploaded;
# the URL replaces the matching non-`Path` key.
cat > catalog.json <<'JSON'
[
  { "productImagePath": "./photos/runner.jpg", "productName": "Cloud Runner", "price": "$129" },
  { "productImagePath": "./photos/vest.jpg",   "productName": "Hydration Vest", "price": "$89" }
]
JSON

framlit batch create --manifest catalog.json --template-id spotlight-minimal \
  --dry-run                            # preview cost (0.2 cr/video)

framlit batch create --manifest catalog.json --template-id spotlight-minimal \
  --output json | jq -r .data.jobId | \
  xargs -I {} framlit batch start {} --poll --output json | \
  jq -r 'select(.status=="completed") | .results[].videoUrl'
```

Hosted images? Use `--rows-file rows.json` instead — same structure, but
plain `productImage` URLs.

### 3. Narrated ad (Pro, 5 cr, ~90-180s wall time)

```bash
framlit narration cap                                   # check monthly slot
framlit narration generate --json '{"brief":"Built for runners who hate stiff shoes","targetSeconds":20,"language":"en"}' \
  --dry-run --output json
framlit narration generate --json '{"brief":"Built for runners who hate stiff shoes","targetSeconds":20,"language":"en"}' \
  --output json
framlit narration stages <projectId> --format md > narration.md
```

### 4. Multi-segment campaign (Pro)

```bash
framlit campaign plan --json '{"brief":"Black Friday push for outerwear"}' \
  --output json > plan.json                 # 10 cr
framlit campaign execute --plan-file plan.json \
  --dry-run                                 # estimates 2 cr/segment
framlit campaign execute --plan-file plan.json --output json
framlit campaign run <returned-runId> --output json
```

### 5. Brand DNA upsert

```bash
# Free tier: name + 3 colors + fonts only
cat > brand.json <<'JSON'
{ "brand_name": "Acme Run", "colors": ["#0F172A", "#22C55E", "#FFFFFF"] }
JSON
framlit brand set --json-file brand.json --dry-run --output json
framlit brand set --json-file brand.json --output json
framlit brand get --output json
```

### 6. Shopify (read-only — connect via web first)

```bash
framlit shopify products --limit 10 --output json | jq '.data.products[]'
```

## Discoverability

```bash
framlit help                       # all commands + flags
framlit schema                     # full tool registry (29 tools, JSON Schema)
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
- ❌ Using `framlit batch cancel` without confirming — irreversible.
- ❌ Treating text-mode output as parseable. It isn't.

## When to escalate to the user

- A `generate` / `modify` request returns code that doesn't match the brief.
  Don't loop more than once — surface the brief mismatch.
- `batch create --dry-run` shows >50 videos (~10+ credits). Confirm scope.
- Any Pro-gated call (`narration`, `campaign`, full `brand set`) when
  `framlit whoami` shows `plan: hobby`. Don't try, you'll get 403.
