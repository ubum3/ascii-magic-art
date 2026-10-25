#!/usr/bin/env node
// ama-mcp: the server over stdio. stdout carries the protocol, so anything that logs goes to stderr.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "../src/server.js";

console.log = console.info = console.debug = console.error;
await createServer().connect(new StdioServerTransport());
console.error("ama-mcp: ready on stdio");
