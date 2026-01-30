# TestDriver Skills for Claude Code

This file is intended to be used as `SKILLs.md` for Claude Code and other MCP-compatible agents.

For the complete, always-up-to-date guide to working with TestDriver, **see `agents.md` in this repository**. It contains:

- How to initialize and use the `TestDriver` SDK
- Recommended two-file workflow (`setup.test.mjs` + `experiment.test.mjs`)
- Patterns for finding elements, asserting, typing, scrolling, screenshots, and more

In short:

- Use `agents.md` as your **primary reference** for how to write and iterate on tests.
- Use the HTTP MCP server exposed by your API (e.g. `POST /api/v1/mcp`) to **query test results, runs, and analytics** from Claude Code.

> Tip: When building tools or workflows for TestDriver inside Claude Code, prefer **explicit steps** (find/click/type/assert) guided by `agents.md`, and use the MCP tools only to **inspect test history and failures**, not to drive the sandbox itself.

