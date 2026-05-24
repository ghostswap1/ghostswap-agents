# Contributing to ghostswap-agents

Thank you for your interest in improving the GhostSwap multi-LLM agent pack. This repo accepts contributions in three areas:

## What we accept

| Type | Where | Examples |
|---|---|---|
| **MCP server improvements** | `mcp-server/` | Better error messages, new helper tools that map to existing REST endpoints, performance tweaks |
| **OpenAPI spec corrections** | `openapi/openapi.yaml` (regenerate `openapi.json`) | Missing fields, undocumented behaviour, schema bugs |
| **Documentation** | `README.md`, `AGENTS.md`, `gpt-action/README.md`, `mcp-server/README.md` | New runtime install snippets, fixing typos, clarifying examples |
| **Skill content** | `skills/ghostswap-partners-api/SKILL.md` | Improvements to the prose flow / new anti-patterns / better code samples |
| **Cursor / Copilot / IDE rules** | `.cursor/rules/`, `AGENTS.md` | Per-IDE prose tweaks |

## What we don't accept

- **New endpoints or breaking schema changes** — those originate from the API itself. File an issue and we'll coordinate with the backend team.
- **Auto-generated dumps** (whole-repo lint passes, mass formatter runs) — keep PRs focused.
- **Renames** of tool/operation IDs — they're a stable contract; breaking them breaks every downstream agent.

## How to contribute

1. **File an issue first** for anything non-trivial. Avoid surprise PRs.
2. **Fork** and create a branch named `fix/short-description` or `feat/short-description`.
3. **Test your changes** locally:
   ```bash
   cd mcp-server
   npm install
   npm run build
   node dist/index.js   # smoke-test stdio
   ```
   And for the OpenAPI spec:
   ```bash
   npx @redocly/cli@latest lint openapi/openapi.yaml
   ```
4. **Open a PR** against `main`. The PR template (auto-populated) will ask for: what changed, why, how you verified.
5. **CI** will run validation + a build of the MCP server. Wait for green.

## Style

- Markdown: two spaces for nested lists, no trailing whitespace, prefer reference-style links for the same URL used 3+ times.
- TypeScript (MCP server): match existing style. No new dependencies without a one-line "why".
- Commit messages: imperative present tense, ≤72 char subject, body explains *why*. Use Conventional Commits if you like, but not required.

## Security

Please **do not file public issues for security vulnerabilities**. See [SECURITY.md](SECURITY.md) for the responsible-disclosure process.

## Code of Conduct

Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to abide by its terms.

## Questions

- For integration questions: <https://t.me/ghostswap1> · <support@ghostswap.io>
- For repo-specific questions: open a [Discussion](https://github.com/ghostswap1/ghostswap-agents/discussions) (when enabled) or [Issue](https://github.com/ghostswap1/ghostswap-agents/issues)
