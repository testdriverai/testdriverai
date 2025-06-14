import { FastMCP } from "fastmcp";
import { type } from "arktype";

import pkg from "../package.json" with { type: "json" };

const { description, name, version } = pkg;

const SessionSchema = type({
  user: {
    id: "string",
  },
});

type Session = typeof SessionSchema.infer;

const OptionsSchema = type({
  description: "string",
  name: "string",
  version: "string.semver" as type.cast<`${number}.${number}.${number}`>,
});

const options = OptionsSchema.assert({ description, name, version });
const server: FastMCP<Session> = new FastMCP({
  async authenticate(request) {
    console.info(request);

    if (!request.headers["authorization"]) {
      throw new Response(null, { status: 401 });
    }

    return {
      user: {
        id: "1",
      },
    };
  },
  instructions: `
    This MCP is for vision-based automated testing.
  `,
  ...options,
});

server.addPrompt({
  name: "go-to-url",
  description: "Open the Browser to a specific URL",
  arguments: [
    {
      name: "browser",
      description: "The browser to use (e.g. Safari, Chrome)",
      enum: ["safari", "chrome"],
    },
    {
      name: "url",
      description: "The URL to open (e.g. https://www.google.com)",
    },
  ],
  load: async (args) => {
    return `Opened ${args.url} in ${args.browser}`;
  },
});

// TODO: Open Application
// TODO: Open URL
// TODO: Click
// TODO: Type
// TODO: Press
// TODO: Scroll
// TODO: Wait

server.addTool({
  annotations: {
    title: "Add two numbers",
    readOnlyHint: true,
    openWorldHint: true,
  },
  name: "add",
  description: "Add two numbers",
  parameters: type({
    a: "number",
    b: "number",
  }),
  execute: async (args, { log }) => {
    log.info("Executing add tool");
    return String(args.a + args.b);
  },
});

export { server };
