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
  ...options,
  // async authenticate(request) {
  //   console.info(request);

  //   if (!request.headers["authorization"]) {
  //     throw new Response(null, { status: 401 });
  //   }

  //   return {
  //     user: {
  //       id: "1",
  //     },
  //   };
  // },
  instructions: `
    You are a QA Engineer. You will be given a prompt of multiple tasks to complete for a single application.

    If you don't know which application to use, ask the user which application to use for testing with the <list_applications_for_testing> prompt and then call the <select_application_for_testing> tool.

    Your job is to break the prompt into single steps and call the appropriate tool to execute each one against the selected application.

    Before & after each step, take a screenshot of the application with the <take_screenshot> tool.

    Keep track of which step number you are on.
 `,
});

server.addPrompt({
  name: "list_applications_for_testing",
  description: "List the applications that are available for testing",
  async load(args) {
    return `Selected application: ${args.application}`;
  },
});

const TimeoutSchema = type("number")
  .describe("The timeout to wait for in seconds")
  .default(30);

server.addPrompt({
  name: "run_test",
  description: "Use TestDriver to automate a test from a prompt",
  arguments: [
    {
      name: "prompt",
      description: "The prompt to use to automate the test",
    },
  ],
  async load(args) {
    return `Running test with prompt: ${args.prompt}`;
  },
});

server.addTool({
  name: "wait_for_duration",
  description: "Wait for a duration to pass",
  parameters: type({
    duration: type("number").describe("The duration to wait for in seconds"),
    timeout: TimeoutSchema,
  }),
  async execute(args, { log }) {
    log.info(`Waiting for ${args.duration} seconds`);
  },
});

server.addTool({
  name: "wait_for_element",
  description: "Wait for an element to become visible",
  parameters: type({
    description: type("string").describe(
      "The description of the element to wait for",
    ),
    timeout: TimeoutSchema,
  }),
  async execute(args, { log }) {
    log.info(`Waiting for element: ${args.description}`);
  },
});

server.addResourceTemplate({
  uriTemplate: "file:///screenshots/{application}/{step}.png",
  name: "Screenshot",
  mimeType: "image/png",
  arguments: [
    {
      name: "application",
      description: "The application to take a screenshot of",
    },
    {
      name: "step",
      description: "The step number of the screenshot",
    },
  ],
  async load(args) {
    return {
      text: `Loading screenshot for step ${args.step}`,
    };
  },
});

server.addTool({
  name: "take_screenshot",
  description: "Take a screenshot of the current screen",
  parameters: type({
    application: type("string").describe(
      "The application to take a screenshot of",
    ),
    step: type("number").describe("The step number of the screenshot"),
  }),
  async execute(args, { log }) {
    log.info(`Took screenshot of ${args.application} with step: ${args.step}`);

    return {
      content: [
        {
          type: "resource",
          resource: await server.embedded(
            `file:///screenshots/${args.application}/${args.step}.png`,
          ),
        },
      ],
    };
  },
});

server.addTool({
  name: "select_application_for_testing",
  description: "Ask the user which application to use for testing",
  parameters: type({
    application: type("string").describe("The application to use for testing"),
  }),
  async execute(args, { log }) {
    log.info("Executing select_application tool");
    return `Selected application: ${args.application}`;
  },
});

server.addTool({
  annotations: {
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
    title: "Type",
  },
  name: "type",
  description: "What keys to press on the keyboard to type text into a field",
  parameters: type({
    description: type("string").describe(
      "The visual description of the field to type into",
    ),
    text: type("string").describe("The text to type into the field"),
  }),
  async execute(args, { log }) {
    log.info("Executing type tool");
    return `Typed ${args.text}`;
  },
});

server.addTool({
  name: "click",
  description: "Click on a button or element",
  parameters: type({
    type: type("'click' | 'double-click' | 'right-click'")
      .describe("The type of click to perform")
      .default("click"),
    description: type("string").describe(
      "The visual description of the element to click on",
    ),
  }),
  async execute(args, { log }) {
    log.info("Executing click tool");
    return `Clicked on ${args.description} with ${args.type}`;
  },
});

server.addTool({
  name: "assert",
  description: "Assert that a condition is true",
  parameters: type({
    expected: type("string").describe(
      "The expected condition that should be true",
    ),
  }),
  async execute(args, { log }) {
    log.info("Executing assert tool", args.expected);
  },
});

// server.addTool({
//   annotations: {
//     title: "Add two numbers",
//     readOnlyHint: true,
//     openWorldHint: true,
//   },
//   name: "add",
//   description: "Add two numbers",
//   parameters: type({
//     a: "number",
//     b: "number",
//   }),
//   execute: async (args, { log }) => {
//     log.info("Executing add tool");
//     return String(args.a + args.b);
//   },
// });

export { server };
