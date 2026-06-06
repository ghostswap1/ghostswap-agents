# @ghostswapio/mcp — Model Context Protocol server

Drop the GhostSwap Partners API into Claude Desktop, Cursor, Windsurf, Continue.dev, OpenAI Agents SDK, Vercel AI SDK, Gemini, or any MCP client in one line.

## What it exposes

7 typed tools matching the [GhostSwap REST API](https://partners.ghostswap.io/docs):

| Tool | Calls | Purpose |
|---|---|---|
| `list_currencies` | `GET /v1/currencies` | List supported coins (1,600+) |
| `get_pair` | `GET /v1/pairs` | Min/max for a (from, to) pair |
| `validate_address` | `POST /v1/addresses/validate` | Pre-check a wallet address |
| `get_quote` | `POST /v1/quotes` | Live rate quote |
| `create_swap` | `POST /v1/swaps` | Create a swap (auto-generates `Idempotency-Key` if you don't pass one) |
| `get_swap` | `GET /v1/swaps/{id}` | Poll status |
| `list_swaps` | `GET /v1/swaps` | List swaps for the org |

## Required env vars

```
GHOSTSWAP_PUBLIC_KEY=gspk_live_...
GHOSTSWAP_SECRET=gssk_live_...
```

Get both from your [GhostSwap dashboard](https://partners.ghostswap.io/dashboard/api-credentials) after admin approval. Optional `GHOSTSWAP_API_BASE` (defaults to `https://partners-api.ghostswap.io`).

## Install

### Claude Desktop / Claude Code

Add to `~/.claude/claude_desktop_config.json` (Desktop) or your Claude Code MCP config:

```json
{
  "mcpServers": {
    "ghostswap": {
      "command": "npx",
      "args": ["-y", "@ghostswapio/mcp"],
      "env": {
        "GHOSTSWAP_PUBLIC_KEY": "gspk_live_...",
        "GHOSTSWAP_SECRET": "gssk_live_..."
      }
    }
  }
}
```

Restart Claude. The 7 tools appear under the `ghostswap` server in the tools picker.

### Cursor

Add to `.cursor/mcp.json` (project-level) or `~/.cursor/mcp.json` (global). Same JSON as above.

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`. Same JSON as above.

### Continue.dev

In `~/.continue/config.yaml`:

```yaml
mcpServers:
  - name: ghostswap
    command: npx
    args: ["-y", "@ghostswapio/mcp"]
    env:
      GHOSTSWAP_PUBLIC_KEY: gspk_live_...
      GHOSTSWAP_SECRET: gssk_live_...
```

### OpenAI Agents SDK (Python)

```python
from agents.mcp import MCPServerStdio

server = MCPServerStdio(
    params={
        "command": "npx",
        "args": ["-y", "@ghostswapio/mcp"],
        "env": {
            "GHOSTSWAP_PUBLIC_KEY": "gspk_live_...",
            "GHOSTSWAP_SECRET": "gssk_live_...",
        },
    },
)
```

### Vercel AI SDK

```ts
import { experimental_createMCPClient } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';

const client = await experimental_createMCPClient({
  transport: new Experimental_StdioMCPTransport({
    command: 'npx',
    args: ['-y', '@ghostswapio/mcp'],
    env: {
      GHOSTSWAP_PUBLIC_KEY: 'gspk_live_...',
      GHOSTSWAP_SECRET: 'gssk_live_...',
    },
  }),
});
```

### LangChain (via MCP adapter)

```python
from langchain_mcp_adapters.client import MultiServerMCPClient

client = MultiServerMCPClient({
    "ghostswap": {
        "command": "npx",
        "args": ["-y", "@ghostswapio/mcp"],
        "env": {
            "GHOSTSWAP_PUBLIC_KEY": "gspk_live_...",
            "GHOSTSWAP_SECRET": "gssk_live_...",
        },
        "transport": "stdio",
    }
})
tools = await client.get_tools()
```

### Claude Desktop one-click (DXT/MCPB bundle)

Coming soon — `dxt pack` artifact will be available in [Releases](https://github.com/ghostswap1/ghostswap-agents/releases). Until then, use the JSON config above.

## Local development

```bash
git clone https://github.com/ghostswap1/ghostswap-agents.git
cd ghostswap-agents/mcp-server
npm install
npm run build
GHOSTSWAP_PUBLIC_KEY=gspk_live_... GHOSTSWAP_SECRET=gssk_live_... node dist/index.js
```

The server speaks JSON-RPC over stdio. To smoke-test:

```bash
(echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
 echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
 sleep 0.5) | node dist/index.js
```

## Idempotency note

`create_swap` accepts an optional `idempotencyKey` argument. If omitted, the server generates a fresh UUID v4 per call.

**For production-grade integrations** the caller should pass a stable key tied to the user's logical "Confirm" action so retries deduplicate correctly. Auto-generation is fine for interactive LLM use (the human reviews each call) but unsafe for automation where the same logical swap might trigger multiple tool calls.

## License

MIT — see [LICENSE](../LICENSE).
