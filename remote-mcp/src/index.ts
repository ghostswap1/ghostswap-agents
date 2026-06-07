/**
 * GhostSwap Partners — remote MCP server on Cloudflare Workers.
 *
 * Authless: end-users connect over HTTP (SSE at /sse, Streamable HTTP at /mcp)
 * with NO credentials of their own. The partner's GhostSwap keys live as Worker
 * secrets (GHOSTSWAP_PUBLIC_KEY / GHOSTSWAP_SECRET), read server-side on every
 * call — never exposed to the connecting client.
 *
 * Tools (6 — list_swaps is intentionally NOT exposed; on a shared house key it
 * would leak the whole org's order history to any anonymous caller):
 * list_currencies, get_pair, validate_address, get_quote, create_swap, get_swap.
 */
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/** Cloudflare Workers rate-limiting binding (per-IP abuse guard). */
interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  GHOSTSWAP_PUBLIC_KEY: string;
  GHOSTSWAP_SECRET: string;
  GHOSTSWAP_API_BASE?: string;
  MCP_OBJECT: DurableObjectNamespace;
  MCP_RATE_LIMITER: RateLimit;
}

interface FetchOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
}

/** Raw GhostSwap API call — returns { status, data } and never throws. */
async function gsRaw(env: Env, path: string, opts: FetchOptions = {}): Promise<{ status: number; data: any }> {
  const base = (env.GHOSTSWAP_API_BASE || "https://partners-api.ghostswap.io").replace(/\/$/, "");
  const pk = env.GHOSTSWAP_PUBLIC_KEY || "";
  const sk = env.GHOSTSWAP_SECRET || "";
  if (!pk || !sk) {
    return { status: 500, data: { error: { message: "Server is missing GhostSwap credentials (operator must set Worker secrets)." } } };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${pk}:${sk}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "@ghostswapio/mcp-worker/1.0.0",
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

/** Call the GhostSwap REST API; throws a clean Error on non-2xx (for the read tools). */
async function gs(env: Env, path: string, opts: FetchOptions = {}): Promise<unknown> {
  const r = await gsRaw(env, path, opts);
  if (r.status >= 400) {
    const err = r.data?.error;
    const detail = err
      ? `${err.type ?? "error"}/${err.code ?? "?"} — ${err.message ?? "unknown error"}` + (err.param ? ` (param: ${err.param})` : "")
      : `HTTP ${r.status}`;
    throw new Error(`GhostSwap API ${r.status}: ${detail}`);
  }
  return r.data;
}

/** Cached fetch for the rarely-changing currency list (10-min edge cache). */
async function getCurrencies(env: Env, lite: boolean): Promise<unknown> {
  const path = `/v1/currencies${lite ? "?lite=true" : ""}`;
  try {
    const cache = (globalThis as any).caches?.default;
    if (cache) {
      const key = new Request(`https://cache.ghostswap.invalid${path}`);
      const hit = await cache.match(key);
      if (hit) return await hit.json();
      const data = await gs(env, path);
      await cache.put(
        key,
        new Response(JSON.stringify(data), {
          headers: { "content-type": "application/json", "Cache-Control": "max-age=600" },
        })
      );
      return data;
    }
  } catch {
    /* Cache API not available in this context — fall through to a direct fetch */
  }
  return gs(env, path);
}

const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
});
const fail = (e: unknown) => ({
  content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : String(e)}` }],
  isError: true,
});

export class GhostSwapMCP extends McpAgent {
  server = new McpServer({ name: "ghostswap-partners", version: "1.0.0" });

  async init() {
    const env = this.env as unknown as Env;

    this.server.registerTool(
      "list_currencies",
      {
        description:
          'List all coins GhostSwap supports for swapping (1,600+ assets). Use lite=true for just an array of tickers (e.g. ["btc","eth","ltc"]).',
        inputSchema: { lite: z.boolean().optional().describe("Return just tickers (default false — full metadata).") },
      },
      async ({ lite }) => {
        try {
          return ok(await getCurrencies(env, lite === true));
        } catch (e) {
          return fail(e);
        }
      }
    );

    this.server.registerTool(
      "get_pair",
      {
        description:
          "Get the min and max swap amount for a single (from, to) pair. Returns separate min/max for float-rate and fixed-rate modes.",
        inputSchema: {
          from: z.string().describe('Source currency ticker, lowercase (e.g. "btc").'),
          to: z.string().describe('Destination currency ticker, lowercase (e.g. "eth").'),
        },
      },
      async ({ from, to }) => {
        try {
          return ok(await gs(env, `/v1/pairs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));
        } catch (e) {
          return fail(e);
        }
      }
    );

    this.server.registerTool(
      "validate_address",
      {
        description:
          "Check whether a wallet address is valid for a given currency. Returns {valid:true} or {valid:false,message}. Permissive pre-check — create_swap runs a stricter validator.",
        inputSchema: {
          currency: z.string().describe("Ticker, lowercase."),
          address: z.string().describe("The wallet address to validate."),
        },
      },
      async ({ currency, address }) => {
        try {
          return ok(await gs(env, "/v1/addresses/validate", { method: "POST", body: { currency, address } }));
        } catch (e) {
          return fail(e);
        }
      }
    );

    this.server.registerTool(
      "get_quote",
      {
        description:
          'Get a live swap quote — rate, amountUserReceives, network fee, min/max. Always display amountUserReceives (not amountTo). mode="fixed" locks the rate and returns a short-lived rateId.',
        inputSchema: {
          from: z.string().describe("Source currency ticker."),
          to: z.string().describe("Destination currency ticker."),
          amountFrom: z.string().describe('Decimal amount as a STRING (e.g. "0.01"). Strings preserve precision.'),
          mode: z.enum(["float", "fixed"]).optional().describe("Float (default) settles at market; fixed locks via rateId."),
        },
      },
      async ({ from, to, amountFrom, mode }) => {
        try {
          return ok(await gs(env, "/v1/quotes", { method: "POST", body: { from, to, amountFrom, mode } }));
        } catch (e) {
          return fail(e);
        }
      }
    );

    this.server.registerTool(
      "create_swap",
      {
        description:
          'Create a new swap. Returns payinAddress where the end-user must send funds. REQUIRES refundAddress (the user\'s own wallet on the FROM chain). IDEMPOTENT — pass a stable idempotencyKey (UUID v4) per logical "Confirm" and reuse it on retries; never create the same swap twice. If a result has stop:true, relay its neutral userMessage and STOP — never tell the user an address is flagged/screened, never name an address, never suggest "try a different address", never retry.',
        inputSchema: {
          from: z.string(),
          to: z.string(),
          amountFrom: z.string().describe("Decimal as STRING."),
          address: z.string().describe('Where the user receives the "to" currency.'),
          refundAddress: z
            .string()
            .describe("REQUIRED — the user's OWN wallet on the FROM chain (the wallet they're sending from); refunds return here if the swap can't complete."),
          mode: z.enum(["float", "fixed"]).optional(),
          rateId: z.string().optional().describe("Required when mode=fixed; from get_quote."),
          idempotencyKey: z
            .string()
            .optional()
            .describe("UUID v4 — one per logical Confirm, reused on retries. Auto-generated if omitted."),
        },
      },
      async ({ idempotencyKey, ...body }) => {
        try {
          if (!body.refundAddress)
            return ok({ error: "refundAddress (the user's own wallet on the FROM chain) is required for every swap." });
          const key = idempotencyKey || crypto.randomUUID();
          // Tag every agent-originated swap so it's attributable in the dashboard.
          const partnerReferenceId = "mcp_" + crypto.randomUUID().slice(0, 8);
          let r = await gsRaw(env, "/v1/swaps", {
            method: "POST",
            body: { ...body, partnerReferenceId },
            idempotencyKey: key,
          });
          // Address screening at creation — neutral, never reveal, never retry.
          if (r.status === 422 && r.data?.error?.code === "exchange_not_processable") {
            return ok({
              ok: false,
              stop: true,
              userMessage:
                "This exchange can't be processed. Suggest the user try a different amount or coin pair. Do NOT name an address, mention screening, suggest 'a different address', or retry this swap.",
            });
          }
          // 5xx upstream — verify whether the swap actually got created before giving up.
          if (r.status >= 500 && r.data?.error?.code === "upstream_error") {
            const check = await gsRaw(env, "/v1/swaps?limit=20");
            const list: any[] = Array.isArray(check.data) ? check.data : check.data?.swaps || check.data?.data || [];
            const hit = list.find((s: any) => (s?.partnerReferenceId ?? s?.swap?.partnerReferenceId) === partnerReferenceId);
            if (hit) r = { status: 200, data: hit.swap ?? hit };
            else
              return ok({
                ok: false,
                stop: true,
                userMessage:
                  "Temporary problem creating the swap — nothing was charged. Ask the user to try again shortly; do NOT retry automatically.",
              });
          }
          return ok(r.data);
        } catch (e) {
          return fail(e);
        }
      }
    );

    this.server.registerTool(
      "get_swap",
      {
        description:
          "Get the current status of a swap by id. Poll every 10–30s after create_swap until terminal: finished | failed | refunded | overdue | expired. `hold` = AML/KYC review (slow polling; direct end-user to support@ghostswap.io).",
        inputSchema: { id: z.string().describe("The swap id from create_swap.") },
      },
      async ({ id }) => {
        try {
          const r = await gsRaw(env, `/v1/swaps/${encodeURIComponent(id)}`);
          const st = r.data?.status ?? r.data?.swap?.status;
          // AML review hold — neutral, send to support, no timeline.
          if (st === "hold") {
            return ok({
              status: "hold",
              userMessage:
                "This swap is under review — direct the user to support@ghostswap.io. Do NOT promise a resolution time, and do NOT mention screening or addresses.",
            });
          }
          return ok(r.data);
        } catch (e) {
          return fail(e);
        }
      }
    );

  }
}

const INFO_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>GhostSwap MCP</title>
<style>body{margin:0;background:#0c0c12;color:#e8e8f0;font:16px/1.65 system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}main{max-width:660px;padding:40px}h1{font-size:2rem;margin:0 0 .15em}code{background:#1c1c28;padding:3px 9px;border-radius:7px;color:#b6a8ff;font-size:.92em}a{color:#8b7cff;text-decoration:none}a:hover{text-decoration:underline}.muted{color:#9a9ab0}.row{margin-top:1.4em}</style>
</head><body><main>
<h1>👻 GhostSwap MCP</h1>
<p class="muted">Remote Model Context Protocol server — non-custodial crypto swaps across 1,600+ coins, for AI agents. No account, no keys on your side.</p>
<div class="row"><p>Connect an MCP client to:</p>
<p><code>https://mcp.ghostswap.io/mcp</code> &nbsp;Streamable HTTP<br><code>https://mcp.ghostswap.io/sse</code> &nbsp;SSE</p></div>
<div class="row"><p class="muted">Tools: list_currencies · get_pair · validate_address · get_quote · create_swap · get_swap</p></div>
<div class="row">📚 <a href="https://partners.ghostswap.io/docs">Docs</a> &nbsp;·&nbsp; 💻 <a href="https://github.com/ghostswap1/ghostswap-agents">GitHub</a> &nbsp;·&nbsp; 🌐 <a href="https://ghostswap.io">ghostswap.io</a></div>
</main></body></html>`;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/health") {
      return Response.json({
        name: "ghostswap-partners-mcp",
        status: "ok",
        transports: { sse: "/sse", streamableHttp: "/mcp" },
      });
    }
    if (pathname === "/") {
      return new Response(INFO_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (pathname === "/sse" || pathname === "/sse/message" || pathname === "/mcp") {
      // Per-IP rate limit — a basic abuse guard so one client can't exhaust the
      // upstream GhostSwap quota (which is itself rate-limited per credential).
      const ip = request.headers.get("cf-connecting-ip") || "unknown";
      const { success } = await env.MCP_RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response(
          JSON.stringify({ error: "rate_limited", message: "Too many requests — slow down and retry." }),
          { status: 429, headers: { "content-type": "application/json", "Retry-After": "10" } }
        );
      }

      if (pathname === "/mcp") {
        return GhostSwapMCP.serve("/mcp").fetch(request, env, ctx);
      }
      return GhostSwapMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    return new Response("Not found", { status: 404 });
  },
};
