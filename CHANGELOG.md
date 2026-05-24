# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/ghostswap1/ghostswap-agents/releases/tag/v1.0.0
