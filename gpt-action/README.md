# GhostSwap Partners — ChatGPT GPT Action

Drop the GhostSwap Partners API into a Custom GPT in 90 seconds.

## What this enables

Any Custom GPT you build can now call the GhostSwap API directly — list currencies, quote rates, validate addresses, create swaps, check status — without you writing a single line of integration code.

## Setup

1. **Get your credentials** at <https://partners.ghostswap.io/dashboard/api-credentials> (sign up + admin approval required; usually <24 h).
2. **Open the [Custom GPT builder](https://chatgpt.com/gpts/editor)** → either edit an existing GPT or create a new one.
3. Go to **Configure** → scroll to **Actions** → click **Create new action**.
4. Under **Schema**, click **Import from URL** and paste:
   ```
   https://partners-api.ghostswap.io/openapi.json
   ```
   (Or paste the contents of [openapi/openapi.yaml](../openapi/openapi.yaml) directly.)
5. Under **Authentication**, choose:
   - **API Key**
   - **Auth Type**: `Bearer`
   - **API Key**: paste `<your_public_key>:<your_secret>` (a single string, colon-separated — e.g. `gspk_live_abc123:gssk_live_xyz789`)
6. **Privacy Policy**: paste `https://ghostswap.io/privacy` (required for public GPTs).
7. Save the action. Available tools the GPT can now call: **listCurrencies, getPair, validateAddress, getQuote, createSwap, getSwap, listSwaps**.

## Optional: add to the GPT's Instructions

Paste this into the GPT's **Instructions** field so it follows the right workflow:

> You can execute crypto-to-crypto swaps using the GhostSwap Partners API actions.
>
> Standard workflow when a user wants to swap:
> 1. Call `getQuote` to show the user-receive amount, rate, and min/max.
> 2. Confirm the user's destination address with `validateAddress`.
> 3. Only after the user explicitly confirms, call `createSwap`. Generate a UUID v4 for `idempotencyKey` and reuse it on any retries.
> 4. Show the user the returned `payinAddress` prominently.
> 5. Optionally call `getSwap` to check status (`finished` means user got their funds).
>
> Never call `createSwap` without explicit user confirmation. Display `amountUserReceives` from quotes, not raw `amountTo`. If the user provides a refund address, include it; otherwise omit the field (do not pass empty string).

## Why this works (notes on the spec)

The OpenAPI 3.1 spec at `partners-api.ghostswap.io/openapi.json` is hand-curated specifically for GPT Actions:

- Every endpoint has a `summary` under 300 chars (GPT builder limit)
- Every parameter has a `description` under 700 chars (GPT builder limit)
- `createSwap` is marked `x-openai-isConsequential: true` (always prompts the user before executing — money-touching by definition)
- Read-only endpoints are `x-openai-isConsequential: false` (can be `always-allow`ed for friction-free UX)
- Only one server URL — GPT Actions don't support multiple
- Bearer auth (the GPT builder's `API Key → Bearer` mode handles this)

## Caveats

- **GPT Actions only support one auth scheme.** Bearer is what we use.
- **No file uploads, no streaming.** All endpoints are request/response.
- **Privacy Policy URL is required** to publish the GPT publicly.
- For automated agents (not Custom GPTs), use the [MCP server](../mcp-server/) instead — better tool typing and stdio transport.
