// End-to-end test: connect to the deployed remote MCP server as a real MCP
// client, list tools, and call get_quote (proves the Worker + secrets work).
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const endpoint = process.argv[2] || "https://ghostswap-mcp.ghostswap.workers.dev/mcp";

const transport = new StreamableHTTPClientTransport(new URL(endpoint));
const client = new Client({ name: "ghostswap-test-client", version: "1.0.0" });

await client.connect(transport);
console.log("✅ connected:", endpoint);

const tools = await client.listTools();
console.log(`✅ tools (${tools.tools.length}): ${tools.tools.map((t) => t.name).join(", ")}`);

const res = await client.callTool({
  name: "get_quote",
  arguments: { from: "btc", to: "xmr", amountFrom: "0.01" },
});
const text = res.content?.[0]?.text ?? JSON.stringify(res);
console.log("✅ get_quote result:\n" + text);

await client.close();
process.exit(0);
