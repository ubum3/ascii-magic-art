/*
 * ama-mcp: an MCP server so coding agents can search the pieces, read a frame
 * as text, make banners and brand specs, and export files.
 *
 *   import { createServer } from "ascii-magic-art-mcp";
 *   await createServer().connect(transport);
 */
import fs from "fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TOOLS, guarded } from "./tools.js";

const { version } = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

export function createServer({ timeout } = {}) {
  const server = new McpServer({ name: "ama-mcp", version });
  for (const t of TOOLS) server.registerTool(t.name, t.config, guarded(t.handler, timeout));
  return server;
}

export { TOOLS };
