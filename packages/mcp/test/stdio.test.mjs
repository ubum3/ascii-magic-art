import { test } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "../bin/ama-mcp.js");

test("stdio: the bin speaks MCP and keeps stdout for the protocol", async () => {
  const transport = new StdioClientTransport({ command: process.execPath, args: [BIN], stderr: "pipe" });
  let log = "";
  transport.stderr.on("data", (d) => (log += d));
  const client = new Client({ name: "stdio-test", version: "0" });
  await client.connect(transport);
  try {
    assert.equal(client.getServerVersion().name, "ama-mcp");
    assert.equal((await client.listTools()).tools.length, 5);
    const r = await client.callTool({ name: "render_frame", arguments: { source: "alien-wave", t: 1 } });
    assert.match(r.content[1].text, /SCORE/);
    const s = JSON.parse((await client.callTool({ name: "search_pieces", arguments: { query: "aliens" } })).content[0].text);
    assert.equal(s.results[0].slug, "alien-wave");
  } finally {
    await client.close();
  }
  assert.match(log, /ama-mcp: ready on stdio/);
});
