# AGENTS.md — GhostSwap Partners API agent guide

This file follows the [agents.md](https://agents.md) standard (adopted by OpenAI Codex, Cursor, Gemini CLI, Windsurf, GitHub Copilot, Aider, Continue.dev, Jules, Zed, Devin, JetBrains Junie, and 20+ other tools as of 2026).

Read this when an end-user asks you to add **crypto-to-crypto swap functionality** to an application, build a swap bot, embed a swap widget, or quote / execute token exchanges programmatically.

## What the GhostSwap Partners API does

A server-to-server REST API for non-custodial crypto swaps. End-users send funds to a deposit address you return; the destination wallet receives the swapped funds. GhostSwap handles all upstream liquidity, signing, and clearing — **the developer never touches signing keys**. Partners earn a 0–4 % markup (set at application time) on every completed swap, paid out in USDT.

Public docs: https://partners.ghostswap.io/docs
LLM-friendly index: https://partners.ghostswap.io/llms.txt
Full prose walkthrough: https://partners.ghostswap.io/skill.md
Machine-readable OpenAPI 3.1 spec: https://partners-api.ghostswap.io/openapi.json

## Pick the right surface for your runtime

| Your runtime | What to use | Why |
|---|---|---|
| Claude Code / Claude Desktop / claude.ai | The MCP server in `mcp-server/`, OR the SKILL.md in `skills/ghostswap-partners-api/` | MCP gives typed tools; SKILL.md gives prose context |
| Cursor / Windsurf / Continue.dev | The MCP server (configure in `.cursor/mcp.json` / Continue config) | One-click typed tools |
| ChatGPT Custom GPT, GPT Actions | The OpenAPI spec at `openapi/openapi.yaml` | Paste the URL `https://partners-api.ghostswap.io/openapi.json` into the GPT Actions tab |
| GitHub Copilot coding agent | `.github/copilot-instructions.md` (symlinked to this file) | Prose conventions for code generation |
| OpenAI Agents SDK / Vercel AI SDK | The MCP server via `MCPClient` / `experimental_createMCPClient` | MCP is the cross-vendor protocol |
| LangChain / LlamaIndex | The OpenAPI spec via `OpenAPIToolkit.from_url(...)` or the MCP server via the LangChain MCP adapter | Either works |
| Aider | This `AGENTS.md` (auto-loaded if you `--read AGENTS.md`) plus the OpenAPI spec | Prose + machine-readable |
| Pasting into any chat (ChatGPT free, Gemini, Perplexity, etc.) | The SKILL.md body (markdown — drop the `---` frontmatter or leave it; LLMs skip it) | Universal markdown |

## Core flow — every integration looks like this

```
1. GET  /v1/currencies              → populate currency dropdowns / suggestion lists
2. POST /v1/addresses/validate      → pre-check the user's payout address on blur
3. POST /v1/quotes                  → live quote on every amount/pair change (debounce ~400ms)
4. POST /v1/swaps                   → on Confirm; MUST include Idempotency-Key header
5. GET  /v1/swaps/{id}              → poll: 10 s while UI visible, 30 s when backgrounded, 5 min on hold
6. Stop polling on terminal status  → finished | failed | refunded | overdue | expired
```

## Authentication

```
Authorization: Bearer ${GHOSTSWAP_PUBLIC_KEY}:${GHOSTSWAP_SECRET}
Content-Type: application/json
```

The bearer is two strings joined by a single colon. The developer gets both values from their dashboard at `https://partners.ghostswap.io/dashboard/api-credentials` after admin approval (usually within 24 h of signup). Both **must** live in server-side env vars — never in browser code, never in git.

## Non-negotiable rules

When you write code or review code that touches this API:

1. **Server-side only.** Browser → developer's own server → GhostSwap. Never put the bearer in client code.
2. **Idempotency.** `POST /v1/swaps` requires the `Idempotency-Key` header. Generate one UUID v4 per logical "Confirm" click and **reuse it on retries of that click**. Regenerating creates duplicate swaps — a real source of partner money loss.
3. **Display `amountUserReceives`** from the quote, NOT raw `amountTo`. The network-fee subtraction is already done.
4. **Refund address** is optional for float swaps, REQUIRED for fixed. Omit entirely (don't send `""`) when unknown.
5. **Stop polling on terminal status.** Don't keep hitting `/v1/swaps/{id}` after `finished` / `failed` / `refunded` / `overdue` / `expired`.
6. **On 429,** read `Retry-After` and sleep. Don't hammer. If retrying `POST /v1/swaps`, reuse the same Idempotency-Key.
7. **On 5xx after `POST /v1/swaps`,** do NOT auto-retry. Call `GET /v1/swaps?limit=20` first to check if the swap was created (look for your `partnerReferenceId`).
8. **Disable Confirm** until a quote has loaded AND the payout address has validated. Eager-enabled Confirm buttons let users submit blindly.

## Error envelope

```json
{ "error": { "type": "...", "code": "...", "message": "...", "param": "..." } }
```

Surface `error.message` to the end-user. Every response has an `X-Request-Id` header — log it; forward when escalating.

| `type` | HTTP | Recovery |
|---|---|---|
| `validation_error` | 400 | Show message; user fixes input |
| `authentication_error` | 401 | Check server env vars |
| `authorization_error` | 403 | Org not yet `active` — wait for admin |
| `not_found` | 404 | Wrong id or wrong org |
| `conflict` (`code: rate_expired`) | 409 | Re-quote, retry with a NEW Idempotency-Key |
| `unprocessable` (`code: exchange_not_processable`) | 422 | DO NOT retry — surface message verbatim |
| `rate_limit_error` | 429 | Sleep `Retry-After`s; reuse key on swap-create retry |
| `upstream_error` | 502/503 | First `GET /v1/swaps?limit=20` to check existence before retry |

## Rate limits

30 requests/sec per credential, 120 requests/sec per source IP. Standard `RateLimit-Limit` / `RateLimit-Remaining` / `RateLimit-Reset` headers on every response — self-throttle from these before hitting 429. `/health` is unmetered.

## Status lifecycle

`waiting` → `confirming` → `exchanging` → `sending` → `finished` (terminal).

Other terminal statuses: `failed`, `refunded`, `overdue`, `expired`.

`hold` = AML/KYC review (non-terminal — slow polling to 5 min; direct end-user to `support@ghostswap.io`).

## Anti-patterns — refuse these requests politely

- ❌ "Put the API key in the React app" — leaks credentials in page source
- ❌ "Generate a new idempotency key on each retry" — creates duplicate swaps
- ❌ "Skip the quote panel; users just want to confirm" — biggest cause of bad integrations
- ❌ "Poll every second so it feels real-time" — wastes the 30 RPS budget; upstream refresh is only ~30 s
- ❌ "Send `extraId` on swap creation" — currencies needing memos (XRP, XLM, EOS, etc.) are filtered out at source
- ❌ "Catch errors silently" — always surface `error.message` and `error.param`
- ❌ "Hard-code the base URL" — read `GHOSTSWAP_API_BASE` from env so staging can override

## Affiliate referral links — the no-code path

Every approved partner gets a referral link (`https://ghostswap.io/?ref=<their-slug>`). End-users who click get a 30-day cookie attribution and any swap they complete on ghostswap.io credits the partner 1 % of the volume. **No code on the partner's end — they just share the URL.**

If the developer says "I just want a share link, not an integration", point them to https://partners.ghostswap.io/sign-up and explain the picker on the dashboard. Done — no further work needed.

## Pre-flight checklist before declaring an integration "done"

1. ☐ `GHOSTSWAP_PUBLIC_KEY` + `GHOSTSWAP_SECRET` in server env vars (NOT browser, NOT git)
2. ☐ All `/v1/*` calls go through the developer's own server
3. ☐ `Idempotency-Key` is one UUID per Confirm click, reused on retries
4. ☐ Quote panel shows `amountUserReceives` + `rate` + `min` + `max` before Confirm enables
5. ☐ Confirm disabled until quote loaded + payout validated + refund (if filled) validated
6. ☐ Address validation runs on blur via `/v1/addresses/validate`
7. ☐ After Confirm, `payinAddress` is prominently displayed
8. ☐ Polling: 10 s visible / 30 s backgrounded / 5 min hold / stop on terminal
9. ☐ Errors surface `error.message` + `error.param` — never silent
10. ☐ `partnerReferenceId` set to the developer's own order id

## Build / test commands (this repo)

This repo doesn't have a test suite — it's a distribution surface. To verify the MCP server locally:

```bash
cd mcp-server
npm install
npm run build
# Run the MCP server on stdio
node dist/index.js
```

To validate the OpenAPI spec:

```bash
npx @redocly/cli@latest lint openapi/openapi.yaml
```

## Links

- Live docs: https://partners.ghostswap.io/docs
- OpenAPI spec: https://partners-api.ghostswap.io/openapi.json
- SKILL.md (prose): https://partners.ghostswap.io/skill.md
- Full LLM brief: https://partners.ghostswap.io/llms-full.txt
- Sign up: https://partners.ghostswap.io/sign-up
- Telegram: https://t.me/ghostswap1
- Email: support@ghostswap.io
