<!--
Thanks for opening a PR. Fill out the sections below — keep it tight.
For anything non-trivial, please file an issue first (see CONTRIBUTING.md).
-->

## What changed

<!-- One paragraph describing the change. -->

## Why

<!-- The user-visible problem this solves, or the user-visible improvement it ships. -->

## Surfaces touched

- [ ] MCP server (`mcp-server/`)
- [ ] OpenAPI spec (`openapi/openapi.yaml` — remember to regenerate `openapi.json`)
- [ ] SKILL.md
- [ ] AGENTS.md
- [ ] Cursor rules / Copilot instructions / Windsurf rules
- [ ] GPT Action setup guide
- [ ] README / docs
- [ ] CI workflow / tooling

## Verification

<!-- How you tested. CI should already have run for the relevant pieces. -->

- [ ] `npm run build` in `mcp-server/`
- [ ] `npx @redocly/cli@latest lint openapi/openapi.yaml`
- [ ] Manual smoke test in a real client (which one?)

## Notes for reviewers

<!-- Anything reviewer-specific: trade-offs, alternatives considered, follow-ups. -->
