# framlit Agent Context

Vocabulary, services, and security model for the `framlit` CLI / MCP server.
Pair with [SKILL.md](./SKILL.md) (rules + happy paths) and
[AGENTS.md](./AGENTS.md) (entry-point README for agents).

## Overview

`framlit` is a thin client over the closed framlit.app HTTP API
(`/api/mcp/*`). All business logic — codegen, render orchestration, billing
— lives upstream. This package's job is to:

1. Validate inputs (path traversal, control chars, resource ID format)
2. Marshal CLI flags / `--json` payload → tool schema
3. Stream long-running responses as NDJSON
4. Map HTTP errors to deterministic exit codes

The CLI and MCP server share `core/registry.ts` — same Zod schemas, same
handlers, same credits. Any tool added to one surface appears in the other.

## Vocabulary

| Term | Meaning |
|---|---|
| **Project** | A single Remotion video (code + metadata). Has a stable `projectId`. |
| **Render** | One MP4 output for a project. Has a `renderId` and `videoUrl` when complete. |
| **Batch** | A job that fans out one template across many rows of data. Has a `jobId` and N child videos. |
| **Template** | A pre-built Remotion component with parameter slots — feeds batch jobs. |
| **Variation** | An A/B style alternative for an existing project (same content, different look). |
| **Narrated ad** | Pipeline output: AI script + ElevenLabs voiceover + word-synced visuals. Pro-only. |
| **Campaign** | Multi-segment plan (e.g. 3 audience cuts × 3 hooks) executed in parallel fan-out. Pro-only. |
| **Brand DNA** | Saved brand profile (name, colors, fonts, tone) injected into every generation. |
| **Manifest** | A `--manifest` JSON for `batch create` — keys ending in `Path` are local files to upload. |
| **Skill** | Internal: pre-compiled Remotion best-practice rules baked into the codegen prompt. Not user-facing. |

## Services

29 tools total, grouped by category. `framlit schema` returns the full
JSON Schema; this is the human map.

| Category | Tools | CLI namespace |
|---|---|---|
| Generate | `framlit_generate_code`, `framlit_modify_code`, `framlit_preview_code` | `generate`, `modify`, `preview` |
| Project | `framlit_list_projects`, `framlit_get_project`, `framlit_create_project`, `framlit_update_project` | `projects *` |
| Render | `framlit_render_video`, `framlit_get_render_status` | `render`, `render status` |
| Templates | `framlit_list_templates` | `templates` |
| Credits | `framlit_get_credits` | `credits` |
| Batch | `framlit_batch_create`, `framlit_batch_start`, `framlit_batch_status`, `framlit_batch_list`, `framlit_batch_cancel` | `batch *` |
| Variations | `framlit_generate_variations`, `framlit_list_variations`, `framlit_apply_variation` | `variations *` |
| Narration (Pro) | `framlit_generate_narrated_ad`, `framlit_get_narration_cap`, `framlit_get_narrated_ad_stages` | `narration *` |
| Campaign (Pro) | `framlit_campaign_plan`, `framlit_campaign_execute`, `framlit_list_campaign_runs`, `framlit_get_campaign_run` | `campaign *` |
| Brand | `framlit_get_brand`, `framlit_set_brand` | `brand *` |
| Shopify | `framlit_list_shopify_products` | `shopify products` |

## Schema introspection

```bash
framlit schema                            # all 29 tools (compact)
framlit schema framlit_generate_code      # one tool's JSON Schema
framlit help                              # all CLI subcommands + flags
framlit <command> --help                  # one subcommand
```

`schema` is the source of truth. Help text is for humans and may lag.

## Output modes

| `--output` | Used when |
|---|---|
| `text` (default for tty) | Interactive use. Don't parse. |
| `json` (default when piped) | Scripts, agents. Always returns `{data, message}` on stdout, `{error: {code, message}}` on stderr. |

NDJSON streaming (`--poll`) emits one JSON object per line on stdout,
terminating when the operation reaches `completed` / `failed` / `cancelled`.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments / validation failure |
| `3` | Auth required |
| `4` | API error (network, server, billing) |

## Security model

Input validation is enforced at the CLI boundary and re-enforced upstream:

- **Path traversal**: `--rows-file`, `--manifest`, `--plan-file`,
  `--json-file`, `--code` reject paths containing `..`, absolute paths
  outside CWD, or symlinks pointing out of the project tree
  (`validateSafePath` in `cli/validation.ts`).
- **Control characters**: text inputs (briefs, prompts, instructions) reject
  control characters and overly long strings (`validateTextInput`).
- **Resource ID injection**: project / batch / template / run IDs must
  match `^[A-Za-z0-9_-]+$` and have a length ceiling
  (`validateResourceId`).
- **Auth**: `FRAMLIT_API_KEY` env var takes precedence over `~/.framlit/config`.
  Keys are redacted from any error output. Never logged.
- **Mutating ops**: every command that costs credits or alters server state
  supports `--dry-run` for preview without execution.

For the agent runtime: when a user prompt contains untrusted text (e.g.
content fetched from a URL), pass it through `--json-file` rather than
shell-interpolating into `--json '...'`. There is no built-in `--sanitize`
yet (planned — see roadmap).

## Long-running operations

| Op | Typical wall time | Polling |
|---|---|---|
| `generate` | 10-30s | Synchronous response |
| `modify` | 10-30s | Synchronous |
| `render` (single) | 30-90s | `render status <id> --poll` |
| `batch start` | minutes-hours | `batch start <jobId> --poll` |
| `narration generate` | 90-180s | Synchronous (be patient) |
| `campaign execute` | varies, parallel fan-out | `campaign run <runId>` (no `--poll` yet) |

For sync calls >60s, set your runtime's HTTP timeout to ≥240s. Vercel
deployment ceilings are 300s (Pro plan).

## Where business logic lives

This repo is the client. The actual codegen, voice synthesis, render
orchestration, and billing live in the closed `framlit` Next.js repo at
`/api/mcp/*`. If a tool returns unexpected data or a 5xx, the issue is
almost always upstream — the CLI just relays.

For schema bugs (CLI accepted bad input that upstream rejected, or vice
versa), file an issue at https://github.com/vericontext/framlit-cli.

## Versioning

Semver. Current: see `framlit version` or `package.json`. Tool registry is
stable across minor versions; breaking changes (renamed tools, changed
required fields) bump the major. New tools may appear in any minor — check
`framlit schema | jq 'length'` if you cache the registry.
