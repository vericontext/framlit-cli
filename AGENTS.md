# AGENTS.md

> README-for-AI for the **framlit** CLI / MCP server. If you are a human, see
> [README.md](./README.md) instead. This file is the entry point for coding
> agents (Claude Code, Cursor, GitHub Copilot, OpenAI Codex, Devin, etc.) that
> need to use `framlit` on a user's behalf.

## What framlit is

A command-line + MCP interface to [framlit.app](https://framlit.app), an
AI-powered Remotion video generator for e-commerce ads (TikTok / Reels /
YouTube). Naming convention follows `aws` / `gh` / `vercel` — `framlit`
the npm package IS the CLI tool; the web app it talks to is a separate
closed product. Same install ships two binaries from the same package:

- `framlit` — interactive + scriptable CLI
- `framlit-mcp` — MCP server (stdio JSON-RPC) for IDE agents

Every CLI command and every MCP tool maps to the **same** handler in
`src/core/handlers.ts` — so anything you can do in one surface, you can do in
the other.

## Setup

```bash
npm install -g framlit             # one binary, two protocols
export FRAMLIT_API_KEY=fml_xxx     # create at https://framlit.app/developers
framlit whoami                     # confirms key + plan + credits
```

`FRAMLIT_API_KEY` (env) overrides any `framlit login` config — prefer it for
CI, containers, and headless agents.

## Rules of engagement (read before mutating)

1. **Always use `--dry-run` first** on mutating commands (`generate`, `modify`,
   `render`, `batch *`, `variations generate`, `narration generate`, `campaign
   *`, `brand set`). Returns the resolved payload + estimated cost without
   spending credits or hitting Lambda. Works without an API key.
2. **Always use `--output json`** when you intend to parse the output. Auto-on
   when stdout is piped, but be explicit — text mode is for humans.
3. **Prefer `--json '<payload>'`** over bespoke flags. The JSON shape is the
   1:1 tool schema (`framlit schema <tool>`), so you only have to learn one
   surface. `--json -` reads from stdin; `--json-file <path>` reads from disk.
4. **Stream long-running ops with `--poll`** (NDJSON to stdout). Available on
   `render status`, `batch start`, `batch status`. Each line is a status
   frame — terminate when `status` is `completed` / `failed` / `cancelled`.
5. **Confirm before deletes / cancels.** `batch cancel` is irreversible.
6. **Resolve IDs by listing** (`projects list`, `batch list`, `templates`).
   Never guess project / batch / template IDs — they are validated as
   `[A-Za-z0-9_-]+` and bad values fail loudly.
7. **Respect rate limits.** Code-gen tools cost credits (`generate`,
   `modify`, `narration generate`, `campaign execute`). The user pays for
   every retry — fix prompts, don't loop.

## Discoverability

```bash
framlit help                       # full command reference
framlit schema                     # JSON Schema for every tool (29 tools)
framlit schema framlit_generate_code   # one tool's schema
framlit version                    # current package version
```

If you don't know a flag, hit `--help` on the subcommand or read `schema`.
Don't invent flags — `parseArgs` is non-strict, so unknown flags are silently
ignored, which means typos do not error out.

## Output / exit-code contract

| Mode | Format |
|---|---|
| `--output text` (default for tty) | Human prose. Don't parse. |
| `--output json` (default when piped) | Always `{data, message}` on stdout |
| Error in JSON mode | `{error: {code, message}}` on **stderr** |

Exit codes — script reliably on these:

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | General error |
| `2` | Invalid arguments / validation failure |
| `3` | Auth required (no API key, expired session) |
| `4` | API error (network, server, billing) |

## Costs (credits)

See `framlit credits` for current balance. Costs are stable but check
`framlit schema <tool>` for the canonical number per tool.

| Surface | Credits |
|---|---|
| `generate`, `modify` | 1 each |
| `variations generate` | 1 / variation |
| `batch create` | 0.2 / video |
| `narration generate` | 5 (Pro only, 1 monthly slot) |
| `campaign plan` | 10 (Pro only) |
| `campaign execute` | 2 / segment (Pro only) |
| Everything else (list/get/render/cancel/cap/brand) | 0 |

## Codebase layout (if you're editing framlit-cli itself)

```
src/
  api/client.ts           HTTP client → framlit.app/api/mcp/*
  core/
    handlers.ts           Shared business logic — both CLI + MCP call this
    registry.ts           Tool definitions (Zod schemas + handlers + credits)
  cli/
    index.ts              Command dispatcher (parseArgs)
    commands/             One file per top-level command
    output.ts             JSON / text / NDJSON formatters
    validation.ts         validateResourceId, validateSafePath, etc.
    exit-codes.ts         EXIT.* constants
  mcp/server.ts           MCP stdio server (wraps registry)
tests/                    Vitest — 72 tests, 5 files
```

Adding a new tool:

1. Define the Zod schema + handler in `core/registry.ts`
2. Implement the handler call in `core/handlers.ts`
3. Wire a CLI subcommand in `cli/commands/<name>.ts`
4. Bump test count in `tests/registry.test.ts`

The MCP server picks up new tools automatically — same registry.

## Style

- TypeScript strict, ES modules (`.js` import suffix in source).
- No `any` — use `unknown` + narrow.
- No `console.log` for user output — use `formatOutput` (handles json/text mode).
- Errors: throw `ValidationError` for user-facing input problems, otherwise
  let it propagate to the dispatcher's `try/catch` which maps to exit code 4.
- Never log API keys. `FramlitClient` redacts them.

## Verify before commit

```bash
npm run build && npm test          # tsc + 72 vitest tests must pass
npm run lint                       # eslint
```

`prepublishOnly` runs both — `npm publish` will fail if either does.

## Related docs

- [README.md](./README.md) — human-facing quickstart
- [SKILL.md](./SKILL.md) — agent invariants + happy-path patterns
- [CONTEXT.md](./CONTEXT.md) — vocabulary, services, security model
- Upstream business logic lives in the closed `framlit` repo at
  `/api/mcp/*`. This package is a thin client.
