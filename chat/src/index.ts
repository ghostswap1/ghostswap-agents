/**
 * GhostSwap Chat — a zero-setup browser chat that lets anyone swap crypto by
 * talking to an AI agent.
 *
 * Static chat UI is served from /public (Cloudflare Workers Static Assets).
 * This Worker handles /api/*:
 *   - /api/chat  → the AI agent loop (Claude + the GhostSwap swap tools)
 *   - /api/quote, /api/validate, /api/create, /api/status, /api/currencies
 *     → thin proxies (kept for non-chat clients)
 *
 * The partner keys (GHOSTSWAP_*) and the ANTHROPIC_API_KEY live as Worker
 * secrets and never reach the browser.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface Env {
  GHOSTSWAP_PUBLIC_KEY: string;
  GHOSTSWAP_SECRET: string;
  GHOSTSWAP_API_BASE?: string;
  ANTHROPIC_API_KEY: string;
  CHAT_RATE_LIMITER: RateLimit;
}

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface GsResult {
  status: number;
  data: any;
}

// ---------------------------------------------------------------------------
// GhostSwap API proxy
// ---------------------------------------------------------------------------
async function gs(
  env: Env,
  path: string,
  opts: { method?: string; body?: unknown; idempotencyKey?: string } = {}
): Promise<GsResult> {
  const base = (env.GHOSTSWAP_API_BASE || "https://partners-api.ghostswap.io").replace(/\/$/, "");
  const pk = env.GHOSTSWAP_PUBLIC_KEY || "";
  const sk = env.GHOSTSWAP_SECRET || "";
  if (!pk || !sk) {
    return { status: 500, data: { error: { message: "Server is not configured with GhostSwap keys yet." } } };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${pk}:${sk}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "ghostswap-chat/1.0.0",
  };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: { message: text || `HTTP ${res.status}` } };
  }
  return { status: res.status, data };
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const enc = (s: unknown) => encodeURIComponent(String(s ?? ""));

// ---------------------------------------------------------------------------
// AI agent — tools + system prompt + loop
// ---------------------------------------------------------------------------

// Model: claude-haiku-4-5 chosen deliberately — this is a PUBLIC, authless
// endpoint billed to the operator's key, so cost/abuse safety matters. Swap to
// "claude-sonnet-4-6" or "claude-opus-4-8" for higher quality if desired.
const MODEL = "claude-haiku-4-5";

const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_currencies",
    description: "List the coins GhostSwap supports for swapping (1,600+). Pass lite=true for just tickers.",
    input_schema: { type: "object", properties: { lite: { type: "boolean" } } },
  },
  {
    name: "get_pair",
    description: "Get the min and max swap amount for a (from, to) pair.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
    },
  },
  {
    name: "validate_address",
    description: "Check whether a wallet address is valid for a currency. Returns {valid:true|false}.",
    input_schema: {
      type: "object",
      properties: { currency: { type: "string" }, address: { type: "string" } },
      required: ["currency", "address"],
    },
  },
  {
    name: "get_quote",
    description:
      "Get a live swap quote. amountFrom must be a decimal STRING (e.g. \"0.01\"). Always show the user amountUserReceives, not amountTo.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "source ticker, lowercase" },
        to: { type: "string", description: "destination ticker, lowercase" },
        amountFrom: { type: "string" },
        mode: { type: "string", enum: ["float", "fixed"] },
      },
      required: ["from", "to", "amountFrom"],
    },
  },
  {
    name: "create_swap",
    description:
      "Create a swap. Returns payinAddress (where the user sends funds) and the swap id. Only call after you have BOTH the destination (payout) address AND the sender/refund address, plus the user's explicit confirmation.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string" },
        to: { type: "string" },
        amountFrom: { type: "string", description: "decimal STRING" },
        address: { type: "string", description: "destination/payout address — where the user RECEIVES the TO coin" },
        refundAddress: {
          type: "string",
          description: "sender/refund address (REQUIRED) — the user's OWN wallet on the FROM chain (the wallet they are sending from); refunds return here if the swap can't complete",
        },
      },
      required: ["from", "to", "amountFrom", "address", "refundAddress"],
    },
  },
  {
    name: "get_swap",
    description: "Get the current status of a swap by id (waiting/confirming/exchanging/sending/finished/failed/...).",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

async function runTool(env: Env, name: string, input: any): Promise<string> {
  try {
    let r: GsResult;
    switch (name) {
      case "list_currencies":
        r = await gs(env, `/v1/currencies${input?.lite ? "?lite=true" : ""}`);
        break;
      case "get_pair":
        r = await gs(env, `/v1/pairs?from=${enc(input.from)}&to=${enc(input.to)}`);
        break;
      case "validate_address":
        r = await gs(env, "/v1/addresses/validate", {
          method: "POST",
          body: { currency: input.currency, address: input.address },
        });
        break;
      case "get_quote":
        r = await gs(env, "/v1/quotes", {
          method: "POST",
          body: { from: input.from, to: input.to, amountFrom: input.amountFrom, mode: input.mode },
        });
        break;
      case "create_swap": {
        if (!input.address) return JSON.stringify({ error: "Destination (payout) address is required." });
        if (!input.refundAddress)
          return JSON.stringify({
            need: "sender_address",
            instruction:
              "Ask the user for their OWN wallet address on the " +
              String(input.from || "source").toUpperCase() +
              " chain (the wallet they're sending from). It's required as the refund address. Do not create the swap without it.",
          });
        const partnerReferenceId = "chat-" + crypto.randomUUID().slice(0, 8);
        const body: any = {
          from: input.from,
          to: input.to,
          amountFrom: input.amountFrom,
          address: input.address,
          refundAddress: input.refundAddress,
          partnerReferenceId,
        };
        r = await gs(env, "/v1/swaps", { method: "POST", body, idempotencyKey: crypto.randomUUID() });

        // (B1) Address screening at creation — neutral, no detail, never retry.
        if (r.status === 422 && r.data?.error?.code === "exchange_not_processable") {
          return JSON.stringify({
            ok: false,
            stop: true,
            userMessage:
              "Sorry — we can't process this exchange right now. You can try a different amount or a different coin pair.",
            note: "Do NOT retry create_swap for this request. Never mention addresses, screening, flags, or 'try a different address'.",
          });
        }
        // 5xx upstream — do NOT blind-retry; check whether the swap actually got created.
        if (r.status >= 500 && r.data?.error?.code === "upstream_error") {
          const check = await gs(env, "/v1/swaps?limit=20");
          const list: any[] = Array.isArray(check.data) ? check.data : check.data?.swaps || check.data?.data || [];
          const hit = list.find((s: any) => (s?.partnerReferenceId ?? s?.swap?.partnerReferenceId) === partnerReferenceId);
          if (hit) {
            r = { status: 200, data: hit.swap ?? hit }; // it was created — proceed with it
          } else {
            return JSON.stringify({
              ok: false,
              stop: true,
              userMessage:
                "We hit a temporary problem creating the swap — nothing was charged. Please try again in a moment.",
              note: "Do NOT call create_swap again automatically; wait for the user to re-confirm.",
            });
          }
        }
        break;
      }
      case "get_swap": {
        r = await gs(env, `/v1/swaps/${enc(input.id)}`);
        const st = r.data?.status ?? r.data?.swap?.status;
        // (B2) AML review hold — neutral, send to support, no timeline.
        if (st === "hold") {
          return JSON.stringify({
            status: "hold",
            userMessage:
              "This swap is currently under review. Please contact support@ghostswap.io and the team will help you from there.",
            note: "Do NOT promise a resolution time. Never mention screening or addresses.",
          });
        }
        break;
      }
      default:
        return JSON.stringify({ error: "unknown tool" });
    }
    return JSON.stringify(r.data);
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}

const SYSTEM = `You are the GhostSwap assistant — a friendly, concise crypto-swap concierge on ghostswap.io. You help people swap one cryptocurrency for another using your tools. GhostSwap is non-custodial: the user sends funds to a deposit address and their destination wallet receives the swapped coins.

How to help:
- Quote with get_quote (from, to as lowercase tickers, amountFrom as a decimal STRING). Always tell the user amountUserReceives (never amountTo) and the rate.
- Before create_swap you MUST collect and confirm TWO addresses:
  (1) the destination/payout address — where they RECEIVE the TO coin, and
  (2) the sender/refund address (REQUIRED, never optional) — the user's OWN wallet on the FROM chain (the wallet they're sending from); refunds go there if the swap can't complete.
  Ask for both. Validate each with validate_address (destination against the TO ticker, sender/refund against the FROM ticker) — note this only checks address FORMAT. Then show a full summary and get confirmation before creating.
- After create_swap, clearly give the payinAddress and tell them to send exactly the amount of the source coin to it. Include the swap id.
- Check status with get_swap. Terminal states: finished, failed, refunded, overdue, expired.
- Use get_pair for min/max and list_currencies to check support.

Rules:
- Real funds move once they deposit — be clear, never rush them.
- Keep replies short and plain. Use UPPERCASE tickers when talking to the user.
- Always display amountUserReceives, never amountTo.
- Handling tool results & errors:
  • If a tool result includes a "userMessage", reply with that message (your own friendly voice, same meaning) and obey its "note". Do not add detail or speculate about the cause.
  • A swap that can't be processed, or a status of "hold", comes back this way — relay the neutral message and STOP. NEVER tell the user an address is blacklisted/flagged/screened/rejected, NEVER say which address, NEVER suggest "try a different address", and NEVER call create_swap again for the same request.
  • For "hold", point the user to support@ghostswap.io and never promise a resolution time.
  • For other errors, give the specific helpful detail (the exact min/max amount, "this pair isn't available", "double-check the destination address or amount"). If a quote expired, just fetch a fresh quote and continue.
  • One create_swap per confirmed request — never create the same swap twice, even after an error.
- Never reveal internal infrastructure, upstream liquidity providers, or which AI model powers you. If asked who you are, say you are the GhostSwap assistant.
- Do not give financial or investment advice.`;

async function handleChat(request: Request, env: Env): Promise<Response> {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: "Invalid JSON." } }, 400);
  }
  const incoming = Array.isArray(body?.messages) ? body.messages : [];
  const messages: Anthropic.MessageParam[] = incoming
    .slice(-20)
    .map((m: any) => ({
      role: m?.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(m?.content ?? ""),
    }))
    .filter((m: Anthropic.MessageParam) => typeof m.content === "string" && m.content.length > 0);

  if (!messages.length) return json({ error: { message: "No message." } }, 400);

  const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const work: Anthropic.MessageParam[] = [...messages];
  let reply = "";

  try {
    for (let i = 0; i < 6; i++) {
      const resp = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 800,
        system: SYSTEM,
        tools: TOOLS,
        messages: work,
      });
      work.push({ role: "assistant", content: resp.content });

      if (resp.stop_reason !== "tool_use") {
        reply = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of resp.content) {
        if (block.type === "tool_use") {
          const out = await runTool(env, block.name, block.input as any);
          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: out });
        }
      }
      work.push({ role: "user", content: toolResults });
    }
  } catch (e) {
    return json({ error: { message: e instanceof Error ? e.message : String(e) } }, 502);
  }

  if (!reply) reply = "Sorry — I hit a snag there. Mind rephrasing?";
  return json({ reply });
}

// ---------------------------------------------------------------------------
// Worker entry — static assets serve the UI; this handles /api/*
// ---------------------------------------------------------------------------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });

    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const { success } = await env.CHAT_RATE_LIMITER.limit({ key: ip });
    if (!success) {
      return json({ error: { message: "Too many requests — please slow down a moment." } }, 429);
    }

    try {
      if (url.pathname === "/api/chat" && request.method === "POST") {
        return await handleChat(request, env);
      }
      if (url.pathname === "/api/currencies" && request.method === "GET") {
        const r = await gs(env, "/v1/currencies?lite=true");
        return json(r.data, r.status);
      }
      if (url.pathname === "/api/quote" && request.method === "POST") {
        const b: any = await request.json();
        const r = await gs(env, "/v1/quotes", { method: "POST", body: { from: b.from, to: b.to, amountFrom: b.amountFrom } });
        return json(r.data, r.status);
      }
      if (url.pathname === "/api/validate" && request.method === "POST") {
        const b: any = await request.json();
        const r = await gs(env, "/v1/addresses/validate", { method: "POST", body: { currency: b.currency, address: b.address } });
        return json(r.data, r.status);
      }
      if (url.pathname === "/api/create" && request.method === "POST") {
        const b: any = await request.json();
        if (!b.address) return json({ error: { message: "Destination address is required." } }, 400);
        if (!b.refundAddress) return json({ error: { message: "Sender/refund address is required." } }, 400);
        const body: any = { from: b.from, to: b.to, amountFrom: b.amountFrom, address: b.address, refundAddress: b.refundAddress, partnerReferenceId: "chat-" + crypto.randomUUID().slice(0, 8) };
        const r = await gs(env, "/v1/swaps", { method: "POST", body, idempotencyKey: b.idempotencyKey || crypto.randomUUID() });
        return json(r.data, r.status);
      }
      if (url.pathname === "/api/status" && request.method === "GET") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: { message: "id required" } }, 400);
        const r = await gs(env, `/v1/swaps/${enc(id)}`);
        return json(r.data, r.status);
      }
      return json({ error: { message: "Unknown endpoint" } }, 404);
    } catch (e) {
      return json({ error: { message: e instanceof Error ? e.message : String(e) } }, 502);
    }
  },
};
