# ghostswap-agents

**The official multi-LLM agent integration pack for [GhostSwap](https://ghostswap.io)** — a no-KYC crypto-to-crypto swap engine supporting 1,600+ coins.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-compatible-orange)](https://modelcontextprotocol.io)
[![OpenAPI 3.1](https://img.shields.io/badge/OpenAPI-3.1-6BA539)](openapi/openapi.yaml)
[![Built for Claude](https://img.shields.io/badge/built%20for-Claude-7c3aed)](https://claude.com/claude-code)
[![Website](https://img.shields.io/badge/website-ghostswap.io-7c3aed)](https://ghostswap.io)
[![Docs](https://img.shields.io/badge/docs-partners.ghostswap.io-purple)](https://partners.ghostswap.io/docs)

Drop the **[GhostSwap Partners API](https://partners.ghostswap.io)** into any AI agent or coding assistant in one line — Claude, ChatGPT, Cursor, Windsurf, Gemini, GitHub Copilot, Continue.dev, OpenAI Agents SDK, LangChain, LlamaIndex, or any [MCP](https://modelcontextprotocol.io)-compatible client.

This repo bundles **every common distribution surface in one place**: an MCP server, a Claude Skill, an OpenAPI 3.1 spec for ChatGPT GPT Actions, project rules for Cursor, an `AGENTS.md` for the 23+ tools that follow that standard, and symlinked files for Copilot / Windsurf / others. Pick the section for your runtime below.

> **About GhostSwap**: <https://ghostswap.io> is a no-KYC, non-custodial crypto-to-crypto exchange built on a partner-revenue-share model. Wallets, dApps, exchanges, and affiliate sites can integrate the [Partners API](https://partners.ghostswap.io) to earn 0–4 % on every swap their users complete, with USDT payouts and no liquidity management on the partner's side.

---

## Contents

- [Quick install by runtime](#quick-install-by-runtime)
- [What's inside this repo](#whats-inside-this-repo)
- [Why ghostswap-agents](#why-ghostswap-agents)
- [Compared to similar projects](#compared-to-similar-projects)
- [Frequently asked questions](#frequently-asked-questions)
- [What the API actually does](#what-the-api-actually-does)
- [What you'll need (the human parts)](#what-youll-need-the-human-parts)
- [Affiliate / referral link — the no-code path](#affiliate--referral-link--the-no-code-path)
- [Updating](#updating)
- [Links](#links)
- [License](#license)

---

## Quick install by runtime

<details open><summary><b>Claude Desktop / Claude Code / claude.ai</b></summary>

**Option A — MCP server (recommended for Desktop)**

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ghostswap": {
      "command": "npx",
      "args": ["-y", "@ghostswap/mcp"],
      "env": {
        "GHOSTSWAP_PUBLIC_KEY": "gspk_live_...",
        "GHOSTSWAP_SECRET": "gssk_live_..."
      }
    }
  }
}
```

Restart Claude Desktop. 7 typed tools appear under the `ghostswap` server.

**Option B — Claude Code plugin**

```bash
/plugin marketplace add ghostswap1/ghostswap-agents
/plugin install ghostswap-partners-api@ghostswap1/ghostswap-agents
```

**Option C — Skill into `~/.claude/skills/`**

```bash
git clone https://github.com/ghostswap1/ghostswap-agents.git
cp -r ghostswap-agents/skills/ghostswap-partners-api ~/.claude/skills/
```

Full canonical SKILL.md also mirrored at <https://partners.ghostswap.io/skill.md>.

</details>

<details><summary><b>Cursor</b></summary>

**MCP** (recommended — typed tools, one-click) — add to `.cursor/mcp.json` in your project (or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "ghostswap": {
      "command": "npx",
      "args": ["-y", "@ghostswap/mcp"],
      "env": {
        "GHOSTSWAP_PUBLIC_KEY": "gspk_live_...",
        "GHOSTSWAP_SECRET": "gssk_live_..."
      }
    }
  }
}
```

**Project rules** (always-on prose conventions) — drop `.cursor/rules/main.mdc` from this repo into your own project. Or just clone this repo and let Cursor read it as a workspace.

</details>

<details><summary><b>Windsurf</b></summary>

**MCP** — add to `~/.codeium/windsurf/mcp_config.json` (same JSON as the Claude / Cursor block above).

**Rules** — copy [`AGENTS.md`](AGENTS.md) to your project root (or symlink it to `.windsurfrules`). Windsurf auto-loads both.

</details>

<details><summary><b>Continue.dev</b></summary>

Add to `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: ghostswap
    command: npx
    args: ["-y", "@ghostswap/mcp"]
    env:
      GHOSTSWAP_PUBLIC_KEY: gspk_live_...
      GHOSTSWAP_SECRET: gssk_live_...
```

</details>

<details><summary><b>ChatGPT (Custom GPT / GPT Action)</b></summary>

1. Sign up at <https://partners.ghostswap.io/sign-up> + get your credential
2. In the [GPT builder](https://chatgpt.com/gpts/editor) → Configure → **Create new action**
3. **Import from URL**:
   ```
   https://partners-api.ghostswap.io/openapi.json
   ```
4. **Auth** → API Key → Bearer → paste `<public_key>:<secret>` (single string, colon-separated)
5. **Privacy Policy URL**: `https://ghostswap.io/privacy`

Full step-by-step in [`gpt-action/README.md`](gpt-action/README.md), including suggested GPT Instructions copy.

</details>

<details><summary><b>GitHub Copilot</b></summary>

Drop [`AGENTS.md`](AGENTS.md) at your repo root (or copy [`.github/copilot-instructions.md`](.github/copilot-instructions.md) — they're symlinked in this repo).

For tool access (typed function calls), use the MCP server via your IDE's MCP plugin.

</details>

<details><summary><b>Gemini Code Assist / Gemini CLI</b></summary>

Gemini CLI reads `AGENTS.md` natively — drop [`AGENTS.md`](AGENTS.md) at your repo root.

For Gemini Code Assist, copy [`AGENTS.md`](AGENTS.md) to `.gemini/styleguide.md`.

For tool access, use the MCP server (Gemini API + Vertex AI added MCP support in March 2026).

</details>

<details><summary><b>Aider</b></summary>

In your project's `.aider.conf.yml`:

```yaml
read: AGENTS.md  # or wherever you've placed this file
```

Aider auto-loads it as read-only context every session.

</details>

<details><summary><b>OpenAI Agents SDK (Python)</b></summary>

```python
from agents import Agent, Runner
from agents.mcp import MCPServerStdio

ghostswap_mcp = MCPServerStdio(
    params={
        "command": "npx",
        "args": ["-y", "@ghostswap/mcp"],
        "env": {
            "GHOSTSWAP_PUBLIC_KEY": "gspk_live_...",
            "GHOSTSWAP_SECRET": "gssk_live_...",
        },
    },
)

agent = Agent(
    name="SwapBot",
    mcp_servers=[ghostswap_mcp],
    instructions="You help users execute crypto-to-crypto swaps.",
)
```

</details>

<details><summary><b>Vercel AI SDK (TypeScript)</b></summary>

```ts
import { experimental_createMCPClient, generateText, openai } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

const client = await experimental_createMCPClient({
  transport: new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y', '@ghostswap/mcp'],
    env: { GHOSTSWAP_PUBLIC_KEY: '…', GHOSTSWAP_SECRET: '…' },
  }),
});

const { text } = await generateText({
  model: openai('gpt-4o'),
  tools: await client.tools(),
  prompt: 'Quote a 0.01 BTC → ETH swap for me.',
});
```

</details>

<details><summary><b>LangChain (Python / JS)</b></summary>

**Via OpenAPI** (the simpler path):

```python
import yaml, requests
from langchain_community.agent_toolkits.openapi.toolkit import OpenAPIToolkit
from langchain_community.tools.json.tool import JsonSpec

spec = yaml.safe_load(requests.get("https://partners-api.ghostswap.io/openapi.yaml").text)
toolkit = OpenAPIToolkit.from_llm(
    llm=...,
    json_spec=JsonSpec(dict_=spec),
    requests_wrapper=...,  # add your Authorization: Bearer header here
)
```

**Via MCP** (cleaner — uses the @ghostswap/mcp server):

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "ghostswap": {
        "command": "npx",
        "args": ["-y", "@ghostswap/mcp"],
        "env": {
            "GHOSTSWAP_PUBLIC_KEY": "gspk_live_...",
            "GHOSTSWAP_SECRET": "gssk_live_...",
        },
        "transport": "stdio",
    }
})
tools = await client.get_tools()
```

</details>

<details><summary><b>LlamaIndex</b></summary>

```python
from llama_index.tools.mcp import McpToolSpec, BasicMCPClient

mcp_client = BasicMCPClient(
    "npx", args=["-y", "@ghostswap/mcp"],
    env={"GHOSTSWAP_PUBLIC_KEY": "...", "GHOSTSWAP_SECRET": "..."},
)
tools = McpToolSpec(client=mcp_client).to_tool_list()
```

Or use the [OpenAPI spec](openapi/openapi.yaml) with `RestAPIToolSpec`.

</details>

<details><summary><b>Generic MCP client / any other runtime</b></summary>

The server is a standard stdio MCP server. Any client that speaks MCP v2024-11-05 works:

```bash
npx -y @ghostswap/mcp
```

Pass `GHOSTSWAP_PUBLIC_KEY` and `GHOSTSWAP_SECRET` via env vars.

Or, for HTTP-style integrations, use the OpenAPI spec directly:
- JSON: <https://partners-api.ghostswap.io/openapi.json>
- YAML: <https://partners-api.ghostswap.io/openapi.yaml>

</details>

<details><summary><b>Paste into any chat (ChatGPT free, Gemini, Perplexity, etc.)</b></summary>

```bash
curl https://partners.ghostswap.io/skill.md | pbcopy
```

Paste into the chat with *"Build me a Node.js integration based on this."* — the SKILL.md is plain markdown with a ~120-line working reference proxy. Works in any LLM.

</details>

---

## What's inside this repo

```
ghostswap-agents/
├── README.md                                       ← you are here
├── AGENTS.md                                       ← Source of truth (agents.md standard, 23+ tools)
├── CLAUDE.md → AGENTS.md                           ← symlink for Claude Code
├── .github/
│   └── copilot-instructions.md → ../AGENTS.md      ← symlink for GitHub Copilot
├── .windsurfrules → AGENTS.md                      ← symlink for Windsurf
├── .cursor/
│   ├── rules/main.mdc                              ← Cursor project rules
│   └── mcp.json                                    ← Cursor MCP config
├── .claude-plugin/
│   └── plugin.json                                 ← Claude Code plugin manifest
├── skills/
│   └── ghostswap-partners-api/
│       └── SKILL.md                                ← Claude Agent Skill (mirror of /skill.md)
├── openapi/
│   ├── openapi.yaml                                ← OpenAPI 3.1 (source of truth)
│   └── openapi.json                                ← Same, JSON
├── mcp-server/                                     ← Published as @ghostswap/mcp on npm
│   ├── src/index.ts
│   ├── package.json
│   ├── manifest.json                               ← DXT/MCPB for one-click Claude Desktop
│   └── README.md
└── gpt-action/
    └── README.md                                   ← Step-by-step for ChatGPT GPT builder
```

---

## Why ghostswap-agents

| | |
|---|---|
| **Built-in to 13+ runtimes out of the box** | Claude (Desktop / Code / .ai), Cursor, Windsurf, Continue.dev, ChatGPT (Custom GPT + GPT Actions), GitHub Copilot, Gemini (Code Assist + CLI), Aider, OpenAI Agents SDK, Vercel AI SDK, LangChain, LlamaIndex, plus any generic MCP client. One repo covers everything. |
| **MIT-licensed, vendor-controlled** | The pack is open source. Fork it, modify it, vendor it inside your own integration. No "developer-tier" tax, no plan-gated tools. |
| **The integration is non-custodial** | GhostSwap routes liquidity and signs upstream. Partners never custody user funds and never hold signing keys. The credential proves "this swap counts towards your commission" — nothing else. |
| **Partner revenue from the first swap** | Set your fee 0–4 % at application time. Earn USDT on every completed swap your integration generates, paid once the balance reaches $100. No upfront cost, no minimum volume. |
| **Production-quality machine-readable surface** | The OpenAPI 3.1 spec covers every endpoint with full request/response schemas, `x-openai-isConsequential` flags, and documented `Idempotency-Key` + `RateLimit-*` headers. ChatGPT GPT Actions, LangChain, LlamaIndex, and openapi-generator-based SDKs all consume it directly. |
| **Mirrors the GhostSwap brand on every surface** | Every install path links back to <https://ghostswap.io> and <https://partners.ghostswap.io/docs> — same docs, same vocabulary, same error envelope, regardless of which runtime the developer is on. |

---

## Compared to similar projects

| | ghostswap-agents | Generic OpenAPI proxy | Self-hosted swap bot |
|---|---|---|---|
| Multi-LLM coverage (MCP + OpenAPI + SKILL + AGENTS) | ✅ Bundled | ⚠️ OpenAPI only | ❌ Hand-written |
| No-KYC swap engine behind it | ✅ 1,600+ coins | ❌ Bring-your-own | ❌ Bring-your-own |
| Partner revenue share | ✅ 0–4 % | ❌ | ❌ |
| USDT payouts handled for you | ✅ | ❌ | ❌ |
| Idempotency baked in | ✅ `Idempotency-Key` required | ⚠️ Depends on origin | ❌ DIY |
| Live OpenAPI URL for ChatGPT GPT Actions | ✅ <https://partners-api.ghostswap.io/openapi.json> | ⚠️ Host it yourself | ❌ |
| MIT-licensed | ✅ | ⚠️ Varies | ⚠️ Varies |

---

## Frequently asked questions

### Which AI runtime should I pick?

If you're shipping in a chat-style assistant (Claude Desktop, ChatGPT, Cursor's chat), use the **MCP server** — it gives the agent typed tools instead of a wall of markdown. If you're embedding into a Custom GPT or a server-side LangChain pipeline, use the **OpenAPI spec**. If you're writing Claude Code workflows, use the **SKILL.md**. The README has copy-pasteable install snippets for all of them.

### Do I need a partner account before I can run this?

To execute real swaps, yes — sign up at <https://partners.ghostswap.io/sign-up>, submit the application form, wait for admin approval (usually under 24 hours), then issue a credential from the dashboard. To just explore the OpenAPI spec, browse the SKILL.md, or run the MCP server's `list_currencies` tool (which doesn't require a partner-specific credential to discover), no account is needed.

### What's the difference between this repo and the GhostSwap REST API itself?

This repo is a thin distribution layer — it does not host the API. The actual API lives at <https://partners-api.ghostswap.io>. Everything in this repo just wraps that API in formats different AI runtimes know how to consume.

### Is the MCP server "official"?

Yes — published by the GhostSwap team to <https://github.com/ghostswap1/ghostswap-agents> and to npm as [`@ghostswap/mcp`](https://www.npmjs.com/package/@ghostswap/mcp). MIT-licensed.

### Can I self-host the MCP server?

Yes. It runs over stdio (the standard MCP transport) and just calls the public REST API. Build it with `cd mcp-server && npm install && npm run build && node dist/index.js`. Forward your `GHOSTSWAP_PUBLIC_KEY` and `GHOSTSWAP_SECRET` env vars and you're set.

### Does the OpenAPI spec auto-update when the API changes?

The canonical spec is served live at <https://partners-api.ghostswap.io/openapi.json> and reflects the deployed API. The copy in `openapi/` of this repo is updated whenever the API changes; the GitHub Actions CI lints it on every PR. If you're consuming this for ChatGPT GPT Actions, point your GPT at the live URL rather than the repo so you get updates automatically.

### How do I know if a swap is real?

Every `POST /v1/swaps` response includes a `payinAddress` — the deposit address the end-user funds. The swap progresses through statuses (`waiting` → `confirming` → `exchanging` → `sending` → `finished`) which you poll via `GET /v1/swaps/{id}`. The full lifecycle is documented in the SKILL.md and at <https://partners.ghostswap.io/docs/concepts/status-lifecycle>.

### What happens if my agent retries `create_swap` after a network error?

Reuse the same `Idempotency-Key` you sent on the first attempt. GhostSwap deduplicates and returns the original swap — no duplicate is created. Regenerating the key on retry is the most common source of partner-side bugs; the MCP server's `create_swap` tool description and the SKILL.md both call this out explicitly.

### How is GhostSwap different from a DEX or a self-custodial swap router?

A DEX requires the user to have a wallet, sign every transaction, and pay gas. GhostSwap is non-custodial in the sense that GhostSwap never holds user funds longer than the swap takes, but the user only needs to send a single on-chain transaction to a deposit address. No wallet integration, no signing flow, no gas-fee UX — that's why it's a popular choice for wallets and apps where the swap is a feature, not the product.

### What about regulatory compliance?

End-users transact with GhostSwap directly through the deposit address. Partners are responsible for their own jurisdiction's compliance posture (terms of service, AML/KYC if their product otherwise requires it, etc.). For high-volume or unusual transaction patterns, GhostSwap may place a swap on `hold` for AML review — the SKILL.md describes how to surface this state to end-users (direct them to <support@ghostswap.io>).

### How do I report a security issue?

Email <support@ghostswap.io> with the subject prefix `[security] ghostswap-agents:` — do not file a public GitHub issue. Full process in [SECURITY.md](SECURITY.md).

---

## What the API actually does

A server-to-server REST API for non-custodial crypto swaps. End-users send funds to a deposit address you return; the destination wallet receives the swapped funds. GhostSwap handles all upstream liquidity, signing, and clearing — **you never hold signing keys**. Partners earn a 0–4 % markup (set at application time) on every completed swap, paid out in USDT (≥ $100 threshold).

| | |
|---|---|
| **Supported coins** | 1,600+ |
| **Auth** | Bearer (`gspk_live_…:gssk_live_…`) |
| **Modes** | Float-rate (default) and fixed-rate (locked) |
| **Rate limits** | 30 RPS per credential, 120 RPS per IP |
| **Idempotency** | `Idempotency-Key` header required on `POST /v1/swaps` |
| **Status polling** | `GET /v1/swaps/{id}` — terminal: `finished` / `failed` / `refunded` / `overdue` / `expired` |
| **Refund** | Optional for float, required for fixed |
| **Payouts** | USDT, $100 minimum, 1–3 business-day admin review |

Full reference: <https://partners.ghostswap.io/docs>.

---

## What you'll need (the human parts)

1. **Sign up** at <https://partners.ghostswap.io/sign-up> → fill the application (business name, website, expected monthly volume, chosen partner fee 0–4 %).
2. **Wait for approval** (admin reviews — usually <24 h). You'll get an email when activated.
3. **Issue a credential** at `/dashboard/api-credentials` → copy the `gspk_live_…` public key and `gssk_live_…` secret.
4. **Set both as server-side env vars** — never in browser code, never in git.

Once you have credentials, all the runtimes above work in <5 minutes.

---

## Affiliate / referral link — the no-code path

If you don't want to integrate the API at all, every approved partner also gets a referral link:

```
https://ghostswap.io/?ref=<your-slug>
```

End-users who click get a 30-day cookie attribution; any swap they complete on ghostswap.io credits you 1 % of the volume. No code on your end — just share the URL. Pick your slug from the dashboard after approval.

---

## Updating

```bash
git pull            # in your local clone
# Or, for the npm package:
npm update -g @ghostswap/mcp
# Or, for the Claude Code plugin:
/plugin update ghostswap-partners-api
```

The OpenAPI spec at <https://partners-api.ghostswap.io/openapi.json> always reflects the live API. The SKILL.md and AGENTS.md are kept in sync with every GhostSwap docs deploy.

---

## Links

| Surface | URL |
|---|---|
| 🔗 Live docs | <https://partners.ghostswap.io/docs> |
| 🔗 OpenAPI 3.1 spec (JSON) | <https://partners-api.ghostswap.io/openapi.json> |
| 🔗 OpenAPI 3.1 spec (YAML) | <https://partners-api.ghostswap.io/openapi.yaml> |
| 🔗 Anthropic Agent Skill | <https://partners.ghostswap.io/skill.md> |
| 🔗 LLM index | <https://partners.ghostswap.io/llms.txt> |
| 🔗 Full corpus for context-stuffing | <https://partners.ghostswap.io/llms-full.txt> |
| 🔗 Sign up | <https://partners.ghostswap.io/sign-up> |
| 💬 Telegram | <https://t.me/ghostswap1> |
| 📧 Email | <support@ghostswap.io> |

---

## License

[MIT](LICENSE). Use it, fork it, ship it.
