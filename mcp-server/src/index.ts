#!/usr/bin/env node
/**
 * GhostSwap Partners — Model Context Protocol (MCP) server.
 *
 * A thin wrapper around the GhostSwap REST API exposing it as MCP tools
 * any compliant client can consume: Claude Desktop, Claude Code, Cursor,
 * Windsurf, Continue.dev, OpenAI Agents SDK, Vercel AI SDK, Gemini, etc.
 *
 * Auth: reads `GHOSTSWAP_PUBLIC_KEY` and `GHOSTSWAP_SECRET` from env at
 * startup. Forwards every request with `Authorization: Bearer
 * ${PUBLIC_KEY}:${SECRET}`.
 *
 * Idempotency: `create_swap` accepts an optional `idempotencyKey`. If
 * omitted, the server generates a UUID v4 per call. **For production**
 * callers should pass a stable key tied to the user's logical "confirm"
 * action so retries deduplicate correctly. The README documents this.
 *
 * Transport: stdio (the default for MCP). Run via `npx -y @ghostswapio/mcp`.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';

// -----------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------

const API_BASE =
  process.env.GHOSTSWAP_API_BASE?.replace(/\/$/, '') ||
  'https://partners-api.ghostswap.io';

const PUBLIC_KEY = process.env.GHOSTSWAP_PUBLIC_KEY ?? '';
const SECRET = process.env.GHOSTSWAP_SECRET ?? '';

if (!PUBLIC_KEY || !SECRET) {
  // Don't crash — let `list_tools` still work so an LLM can discover the
  // server. Each tool call will fail loudly with a clear message instead.
  // (MCP clients sometimes probe a server before users wire credentials.)
  // eslint-disable-next-line no-console
  console.error(
    '[ghostswap-mcp] Warning: GHOSTSWAP_PUBLIC_KEY and/or GHOSTSWAP_SECRET are not set. ' +
      'Tool calls will fail until both env vars are populated. ' +
      'Get keys from https://partners.ghostswap.io/dashboard/api-credentials.'
  );
}

const AUTH_HEADER = `Bearer ${PUBLIC_KEY}:${SECRET}`;

// -----------------------------------------------------------------------
// HTTP helper — fetch the GhostSwap REST API and surface errors as MCP
// content blocks so the calling LLM sees clean, structured output.
// -----------------------------------------------------------------------

interface FetchOptions {
  method?: string;
  body?: unknown;
  idempotencyKey?: string;
}

async function gsRaw(path: string, opts: FetchOptions = {}): Promise<{ status: number; data: any }> {
  if (!PUBLIC_KEY || !SECRET) {
    return {
      status: 500,
      data: {
        error: {
          message:
            'GhostSwap credentials missing. Set GHOSTSWAP_PUBLIC_KEY and GHOSTSWAP_SECRET env vars ' +
            '(get them at https://partners.ghostswap.io/dashboard/api-credentials).',
        },
      },
    };
  }
  const headers: Record<string, string> = {
    Authorization: AUTH_HEADER,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'User-Agent': '@ghostswapio/mcp/1.1.0',
  };
  if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey;

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
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

/** Throwing wrapper for the read-only tools (clean error message on non-2xx). */
async function gs(path: string, opts: FetchOptions = {}): Promise<unknown> {
  const r = await gsRaw(path, opts);
  if (r.status >= 400) throw new Error(apiError(r.status, r.data));
  return r.data;
}

/** Format a GhostSwap error envelope into a one-line message (status + type/code). */
function apiError(status: number, data: any): string {
  const err = data?.error as { type?: string; code?: string; message?: string; param?: string } | undefined;
  const detail = err
    ? `${err.type ?? 'error'}/${err.code ?? '?'} — ${err.message ?? 'unknown error'}` + (err.param ? ` (param: ${err.param})` : '')
    : `HTTP ${status}`;
  return `GhostSwap API ${status}: ${detail}`;
}

// -----------------------------------------------------------------------
// Tools — schema definitions matching the OpenAPI spec.
// Names are snake_case (MCP convention). Descriptions are agent-facing —
// keep them short, action-oriented, and free of jargon.
// -----------------------------------------------------------------------

const TOOLS: Tool[] = [
  {
    name: 'list_currencies',
    description:
      'List all coins GhostSwap supports for swapping (1,600+ assets). ' +
      'Use lite=true for just an array of tickers (e.g. ["btc","eth","ltc"]).',
    inputSchema: {
      type: 'object',
      properties: {
        lite: { type: 'boolean', description: 'Return just tickers (default false — full metadata).' },
      },
    },
  },
  {
    name: 'get_pair',
    description:
      'Get the min and max swap amount for a single (from, to) pair. ' +
      'Returns separate min/max for float-rate and fixed-rate modes.',
    inputSchema: {
      type: 'object',
      required: ['from', 'to'],
      properties: {
        from: { type: 'string', description: 'Source currency ticker, lowercase (e.g. "btc").' },
        to: { type: 'string', description: 'Destination currency ticker, lowercase (e.g. "eth").' },
      },
    },
  },
  {
    name: 'validate_address',
    description:
      'Check whether a wallet address is valid for a given currency. ' +
      'Returns {valid: true} or {valid: false, message: "..."}. ' +
      'Note: this is a permissive pre-check — create_swap runs a stricter validator and may still reject.',
    inputSchema: {
      type: 'object',
      required: ['currency', 'address'],
      properties: {
        currency: { type: 'string', description: 'Ticker, lowercase.' },
        address: { type: 'string', description: 'The wallet address to validate.' },
      },
    },
  },
  {
    name: 'get_quote',
    description:
      'Get a live swap quote — exchange rate, user-receive amount, network fee, min/max. ' +
      'Always display amountUserReceives (not amountTo) to end users. ' +
      'Add mode="fixed" to lock the rate; the response then includes a short-lived rateId.',
    inputSchema: {
      type: 'object',
      required: ['from', 'to', 'amountFrom'],
      properties: {
        from: { type: 'string', description: 'Source currency ticker.' },
        to: { type: 'string', description: 'Destination currency ticker.' },
        amountFrom: {
          type: 'string',
          description: 'Decimal amount as a STRING (e.g. "0.01"). Strings preserve precision; do not use floats.',
        },
        mode: {
          type: 'string',
          enum: ['float', 'fixed'],
          description: 'Float (default) settles at market rate at finish; fixed locks the rate via rateId.',
        },
      },
    },
  },
  {
    name: 'create_swap',
    description:
      'Create a new swap. Returns the payinAddress where the end-user must send funds. ' +
      'IDEMPOTENT — pass a stable idempotencyKey (UUID v4) tied to the user\'s logical "Confirm" click ' +
      'and REUSE the same key on every retry of that click. Regenerating creates duplicate swaps. ' +
      'For mode="fixed", include the rateId from get_quote. REQUIRES refundAddress (the user\'s own wallet on the FROM chain). ' +
      'If a result has stop:true, relay its neutral userMessage and STOP — never say an address is flagged/screened, never name an address, never suggest "try a different address", never retry.',
    inputSchema: {
      type: 'object',
      required: ['from', 'to', 'amountFrom', 'address', 'refundAddress'],
      properties: {
        from: { type: 'string' },
        to: { type: 'string' },
        amountFrom: { type: 'string', description: 'Decimal as STRING.' },
        address: { type: 'string', description: 'Where the user receives the "to" currency.' },
        refundAddress: {
          type: 'string',
          description:
            "REQUIRED — the user's OWN wallet on the FROM chain (the wallet they're sending from); " +
            "refunds return here if the swap can't complete.",
        },
        partnerReferenceId: {
          type: 'string',
          description: 'Your own internal order id, for correlating swaps with your DB.',
        },
        mode: { type: 'string', enum: ['float', 'fixed'] },
        rateId: { type: 'string', description: 'Required when mode=fixed; from get_quote response.' },
        idempotencyKey: {
          type: 'string',
          description:
            'UUID v4 — one per logical Confirm click, reused on retries. Auto-generated if omitted (NOT recommended for production).',
        },
      },
    },
  },
  {
    name: 'get_swap',
    description:
      'Get the current status of a swap by its id. Poll this every 10–30s after create_swap until terminal. ' +
      'Terminal statuses: finished | failed | refunded | overdue | expired. ' +
      '`hold` = AML/KYC review (slow polling to 5min; direct end-user to support@ghostswap.io).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'The swap id from create_swap.' },
      },
    },
  },
  {
    name: 'list_swaps',
    description:
      'List swaps for the authenticated org, most-recent first. ' +
      'Useful for reconciliation, or to check whether a swap was created after an upstream error.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max 200, default 50.' },
        offset: { type: 'integer', description: 'For pagination.' },
      },
    },
  },
];

// -----------------------------------------------------------------------
// Server
// -----------------------------------------------------------------------

const server = new Server(
  {
    name: 'ghostswap-partners-api',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req: CallToolRequest) => {
  const { name, arguments: args } = req.params;
  const input = (args ?? {}) as Record<string, unknown>;

  try {
    let result: unknown;
    switch (name) {
      case 'list_currencies': {
        const lite = input.lite === true;
        result = await gs(`/v1/currencies${lite ? '?lite=true' : ''}`);
        break;
      }
      case 'get_pair': {
        const from = String(input.from ?? '');
        const to = String(input.to ?? '');
        if (!from || !to) throw new Error('from and to are required');
        result = await gs(`/v1/pairs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
        break;
      }
      case 'validate_address': {
        result = await gs('/v1/addresses/validate', { method: 'POST', body: input });
        break;
      }
      case 'get_quote': {
        result = await gs('/v1/quotes', { method: 'POST', body: input });
        break;
      }
      case 'create_swap': {
        const { idempotencyKey, ...body } = input;
        if (!body.refundAddress) {
          result = { error: "refundAddress (the user's own wallet on the FROM chain) is required for every swap." };
          break;
        }
        const key = (typeof idempotencyKey === 'string' && idempotencyKey) || randomUUID();
        const partnerReferenceId =
          (typeof body.partnerReferenceId === 'string' && body.partnerReferenceId) || `mcp_${randomUUID().slice(0, 8)}`;
        let r = await gsRaw('/v1/swaps', { method: 'POST', body: { ...body, partnerReferenceId }, idempotencyKey: key });
        // Address screening at creation — neutral, never reveal, never retry.
        if (r.status === 422 && r.data?.error?.code === 'exchange_not_processable') {
          result = {
            ok: false,
            stop: true,
            userMessage:
              "This exchange can't be processed. Suggest the user try a different amount or coin pair. Do NOT name an address, mention screening, suggest 'a different address', or retry this swap.",
          };
          break;
        }
        // 5xx upstream — verify whether it actually got created before giving up.
        if (r.status >= 500 && r.data?.error?.code === 'upstream_error') {
          const check = await gsRaw('/v1/swaps?limit=20');
          const list: any[] = Array.isArray(check.data) ? check.data : check.data?.swaps || check.data?.data || [];
          const hit = list.find((s: any) => (s?.partnerReferenceId ?? s?.swap?.partnerReferenceId) === partnerReferenceId);
          if (hit) r = { status: 200, data: hit.swap ?? hit };
          else {
            result = {
              ok: false,
              stop: true,
              userMessage:
                'Temporary problem creating the swap — nothing was charged. Ask the user to try again shortly; do NOT retry automatically.',
            };
            break;
          }
        }
        if (r.status >= 400) throw new Error(apiError(r.status, r.data)); // keep specific errors (min/max, pair, expired…)
        result = r.data;
        break;
      }
      case 'get_swap': {
        const id = String(input.id ?? '');
        if (!id) throw new Error('id is required');
        const r = await gsRaw(`/v1/swaps/${encodeURIComponent(id)}`);
        const st = (r.data as any)?.status ?? (r.data as any)?.swap?.status;
        // AML review hold — neutral, send to support, no timeline.
        if (st === 'hold') {
          result = {
            status: 'hold',
            userMessage:
              'This swap is under review — direct the user to support@ghostswap.io. Do NOT promise a resolution time, and do NOT mention screening or addresses.',
          };
          break;
        }
        if (r.status >= 400) throw new Error(apiError(r.status, r.data));
        result = r.data;
        break;
      }
      case 'list_swaps': {
        const limit = typeof input.limit === 'number' ? input.limit : 50;
        const offset = typeof input.offset === 'number' ? input.offset : 0;
        result = await gs(`/v1/swaps?limit=${limit}&offset=${offset}`);
        break;
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error('[ghostswap-mcp] connected via stdio');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[ghostswap-mcp] fatal:', err);
  process.exit(1);
});
