// import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// import { type } from "arktype";

import {
  description,
  name,
  version,
} from "../package.json" with { type: "json" };

// const server = new McpServer({ name, version, description });

import { FastMCP } from "fastmcp";
import { type } from "arktype";

const OptionsSchema = type({
  description: "string",
  name: "string",
  version: "string.semver" as type.cast<`${number}.${number}.${number}`>,
});

const options = OptionsSchema.assert({ description, name, version });
const server = new FastMCP(options);

server.addTool({
  name: "add",
  description: "Add two numbers",
  parameters: type({
    a: "number",
    b: "number",
  }),
  execute: async (args) => {
    return String(args.a + args.b);
  },
});

server.start({ transportType: "stdio" });
