# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-01

### Added

- **Memo / destination-tag support** across every agent surface. `create_swap` in
  the npm MCP server (`@ghostswapio/mcp` 1.2.0), the hosted MCP at
  `mcp.ghostswap.io` and GhostSwap Chat now accept `extraId`,
  `extraIdNotRequired` and `refundExtraId`, so swaps into tag coins (XRP, XLM,
  ATOM, HBAR, TON…) no longer fail with `missing_extra_id`. Chat asks the user
  for the tag instead of giving up.
- **`GET /v1/public/quote`** in the OpenAPI spec — unauthenticated,
  CORS-open display quote for price widgets and comparison sites
  (60 req/min/IP).
- README: hosted no-key MCP (`https://mcp.ghostswap.io/mcp`) and
  [GhostSwap Chat](https://chat.ghostswap.io) install paths, plus FAQ entries on
  no-KYC swaps, memo / tag coins and the public quote endpoint.

### Changed

- **OpenAPI spec synced with the live API** (still OpenAPI 3.1, lint-clean):
  `requiresExtraId` / `extraIdName` on currencies; `extraId`,
  `extraIdNotRequired`, `refundExtraId` on swap creation; `amountExpectedFrom`,
  `amountActualFrom`, `amountActualTo`, `actualNetworkFee`, `amountAnomalyPct`,
  `payinHash`, `payoutHash`, `moneyReceivedAt`, `moneySentAt` on swaps; canonical
  ticker guidance (e.g. TRON-USDT is `usdtrx`).
- `SKILL.md` synced with <https://partners.ghostswap.io/skill.md>, and both
  `SKILL.md` and `AGENTS.md` now require collecting a memo / tag when
  `requiresExtraId` is true. The old "don't send `extraId`" rule is removed —
  tag coins are no longer filtered out.
- Chat `llms.txt` wording tidied; sitemap `lastmod` refreshed.

## [1.1.0] - 2026-06-08

### Added

- **Hosted remote MCP server** source in `remote-mcp/` (Cloudflare Worker behind
  `mcp.ghostswap.io`, Streamable HTTP + SSE, no client credential) and its MCP
  registry entry `io.github.ghostswap1/mcp`.
- **GhostSwap Chat** source in `chat/` — the AI swap assistant at
  `chat.ghostswap.io`, with its logo, Open Graph image, `llms.txt`, `robots.txt`
  (AI crawlers welcome) and `sitemap.xml`.

### Changed

- npm package renamed to **`@ghostswapio/mcp`** (1.1.0).
- `create_swap` now requires the sender's own wallet as `refundAddress` on every
  surface, and failed or paused swaps return a neutral message that points the
  user to support.

## [1.0.0] - 2026-05-25

### Added

- **Model Context Protocol (MCP) server** in `mcp-server/` — TypeScript implementation
  built on `@modelcontextprotocol/sdk`. Exposes 7 typed tools (`list_currencies`,
  `get_pair`, `validate_address`, `get_quote`, `create_swap`, `get_swap`,
  `list_swaps`) over stdio transport. Compatible with Claude Desktop, Claude Code,
  Cursor, Windsurf, Continue.dev, OpenAI Agents SDK, Vercel AI SDK, LangChain,
  LlamaIndex, Gemini, and any MCP-compliant client.
- **OpenAPI 3.1 specification** in `openapi/` — YAML and JSON variants covering
  8 operations across 7 paths. Includes `x-openai-isConsequential` flags for
  ChatGPT GPT Actions, documented `RateLimit-*` headers, documented
  `Idempotency-Key` requirement on `createSwap`. Also mirrored live at
  <https://partners-api.ghostswap.io/openapi.json> and `/openapi.yaml`.
- **Anthropic Agent Skill** in `skills/ghostswap-partners-api/SKILL.md` —
  ~400-line markdown skill with YAML frontmatter, installable into Claude Code
  via plugin marketplace or `~/.claude/skills/`. Mirror of
  <https://partners.ghostswap.io/skill.md>.
- **`AGENTS.md`** at the repo root — cross-tool agent guide following the
  [agents.md](https://agents.md) standard adopted by 23+ AI coding tools.
- **Symlinked tool-specific instruction files** routing to `AGENTS.md`:
  `CLAUDE.md`, `.github/copilot-instructions.md`, `.windsurfrules`.
- **Cursor project rules** in `.cursor/rules/main.mdc` + one-click MCP config
  in `.cursor/mcp.json`.
- **Claude Code plugin manifest** in `.claude-plugin/plugin.json`.
- **ChatGPT GPT Action setup guide** in `gpt-action/README.md` — step-by-step
  for adding the API to a Custom GPT.
- **DXT/MCPB manifest** in `mcp-server/manifest.json` for one-click Claude
  Desktop bundle installs.
- **README.md** with one collapsible install section per supported runtime
  (Claude / Cursor / Windsurf / Continue.dev / ChatGPT / GitHub Copilot /
  Gemini / Aider / OpenAI Agents SDK / Vercel AI SDK / LangChain / LlamaIndex
  / any MCP client / paste-into-any-chat).

[1.2.0]: https://github.com/ghostswap1/ghostswap-agents/releases/tag/v1.2.0
[1.1.0]: https://github.com/ghostswap1/ghostswap-agents/releases/tag/v1.1.0
[1.0.0]: https://github.com/ghostswap1/ghostswap-agents/releases/tag/v1.0.0
