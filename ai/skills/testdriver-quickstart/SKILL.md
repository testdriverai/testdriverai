---
name: testdriver:quickstart
description: Run your first computer-use test in minutes.
---
<!-- Generated from quickstart.mdx. DO NOT EDIT. -->

TestDriver makes it easy to write automated computer-use tests for web browsers, desktop apps, and more. Follow the directions below to run your first TestDriver test.

<Tip><a href="https://discord.com/invite/cWDFW8DzPm" target="_blank" rel="noreferrer">Join our Discord</a> if you have any questions or need help getting started!</Tip>

<Tabs>
  <Tab title="Add to GitHub" icon="github">

    Drop-in UI testing for any GitHub repository. Mention `@testdriverai` anywhere in your repo and it writes UI tests and catches regressions before they merge.

    <Card
      title="Add to GitHub"
      icon="github"
      href="https://go.testdriver.ai/github"
      arrow
      horizontal
    >
      Install the TestDriver GitHub app and start testing in minutes — no setup required.
    </Card>

    <Steps>
      <Step title="Install the GitHub App">
        Click **Add to GitHub** above and install TestDriver on the repositories you want to test.
      </Step>

      <Step title="Mention @testdriverai">
        Open a pull request or issue and mention `@testdriverai` to have it write and run UI tests:

        ```
        @testdriverai Write a test that verifies the homepage loads and the signup button works.
        ```

        TestDriver spawns a sandbox, writes the test, and posts results right in the conversation.
      </Step>

      <Step title="Catch Regressions Automatically">
        Once your tests are committed, TestDriver runs them on every pull request and flags regressions before they merge.
      </Step>
    </Steps>

    Want to use TestDriver from GitHub Copilot or the GitHub Mobile app instead? See the full GitHub guide:

    <Card
      title="GitHub Integration Guide"
      icon="arrow-right"
      href="/v7/copilot/auto-healing#use-testdriver-in-github"
      arrow
      horizontal
    >
      Use TestDriver from GitHub web, Copilot chat, PR reviews, and mobile.
    </Card>

  </Tab>
  <Tab title="CLI" icon="terminal">

    Get started quickly with the TestDriver CLI.

    <Steps>
      <Step title="Install TestDriver">

        Use `npx` to quickly set up an example project:

        ```bash
        npx testdriverai init
        ```

        This will walk you through creating a new project folder, installing dependencies, setting up your API key, and configuring MCP for your preferred AI assistant (VS Code, Cursor, Claude Desktop, etc.).

      </Step>
      
      <Step title="Run Your Test">

        TestDriver uses Vitest as the test runner. To run your test, use:
        
        ```bash
        vitest run
        ```

        This will spawn a sandbox, launch Chrome, and run the example test!

      </Step>
    </Steps>
  </Tab>
  <Tab title="AI Setup" icon="robot">

    Plug TestDriver into your AI client so you can write, run, and debug real end-to-end tests right from chat. There are three pieces, and `testdriverai init` installs all of them for you:

    - **The agent** — an expert test-creator that drives a live sandbox, writes code after each step, and reruns the test until it passes.
    - **Skills** — small instruction files that teach the agent the exact syntax for each TestDriver capability (`find`, `click`, `type`, `assert`, …).
    - **The MCP server** — exposes TestDriver's computer-use tools over the [Model Context Protocol](https://modelcontextprotocol.io) so any MCP-capable client can use them.

    ### Quick install (recommended)

    `testdriverai init` wires up the agent, skills, and MCP server for you, writing each client's config in the exact format and location it expects:

    ```bash
    # interactive — pick your client(s)
    npx testdriverai init

    # one client
    npx testdriverai init --client claude-code

    # several
    npx testdriverai init --client claude-code,cursor,vscode

    # everything
    npx testdriverai init --client all
    ```

    <Info>
    `init` detects clients already present in your project and pre-selects them in the picker. Re-running `init` is safe — it merges the TestDriver entry into existing config without overwriting your other servers.
    </Info>

    You'll need a TestDriver API key. Create one at [console.testdriver.ai/team](https://console.testdriver.ai/team) and `init` will save it to `.env` as `TD_API_KEY`.

    ### The agent

    The **TestDriver agent** is an expert test-creator that runs inside your AI client (Claude Code, Cursor, VS Code, and others). It writes, runs, and debugs real end-to-end tests by driving your app the same way a person would — using AI vision to find elements, click, type, and assert — through the TestDriver MCP server.

    Unlike a chat assistant that only suggests code, the agent works **iteratively against a live sandbox**: it starts a session, performs each action, writes the generated code to your test file, verifies the result with a screenshot, and reruns the test until it passes.

    During init you'll be asked which AI client(s) to install into. The agent is written to the location each client expects:

    | Client | Agent location |
    | --- | --- |
    | Claude Code | `.claude/agents/testdriver.md` |
    | VS Code (Copilot) | `.github/agents/testdriver.agent.md` |
    | Cursor | `.cursor/rules/testdriver.mdc` |
    | Windsurf | `.windsurf/rules/testdriver.md` |
    | Codex | `AGENTS.md` |
    | Zed | `.rules` |

    Once installed, invoke it from your client's chat:

    ```text
    @testdriver write a test that logs in and verifies the dashboard loads
    ```

    The agent will spin up a sandbox, perform the steps live, write them into a test file under `tests/`, and run it for you.

    ### Skills

    **Skills** are small, focused instruction files — one per TestDriver capability — that teach your AI client exactly how to use each part of the TestDriver SDK and MCP tools. They follow the [Anthropic `SKILL.md` format](https://code.claude.com/docs/en/skills): a folder per skill, each containing a `SKILL.md` with YAML frontmatter and a markdown body.

    There are **106 skills**, generated directly from the TestDriver documentation, covering every action and concept: `find`, `click`, `type`, `assert`, `check`, `scroll`, `press-keys`, `provision`, caching, secrets, CI/CD, and more. They're written to the directory each client expects:

    | Client | Skills location |
    | --- | --- |
    | Claude Code | `.claude/skills/<name>/SKILL.md` |
    | Zed | `.agents/skills/<name>/SKILL.md` |
    | Codex | referenced from `AGENTS.md` |
    | VS Code · Cursor · Windsurf | folded into the agent rules/instructions |

    <Note>
    Skills are **generated, not hand-edited** — each is built from a `.mdx` docs page and carries a `DO NOT EDIT` marker. To change a skill, edit the corresponding documentation page and run `node docs/_scripts/generate-skills.js`.
    </Note>

    ### MCP server

    The **TestDriver MCP server** exposes TestDriver's computer-use tools — `session_start`, `find`, `click`, `type`, `assert`, `check`, `screenshot`, and more — over the [Model Context Protocol](https://modelcontextprotocol.io). It runs as a local stdio process:

    ```bash
    npx -p testdriverai testdriverai-mcp
    ```

    and authenticates with your `TD_API_KEY`. `testdriverai init` configures it for you, but you can also wire it up by hand:

    | Client | Auto-install | MCP config file | Config key |
    | --- | --- | --- | --- |
    | Claude Code | ✅ | `.mcp.json` | `mcpServers` |
    | Claude Desktop | ✅ | OS-specific | `mcpServers` |
    | Cursor | ✅ | `.cursor/mcp.json` | `mcpServers` |
    | VS Code (Copilot) | ✅ | `.vscode/mcp.json` | `servers` |
    | Windsurf | ✅ | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` |
    | Codex | ✅ | `~/.codex/config.toml` | `[mcp_servers]` |
    | Zed | ✅ | `.zed/settings.json` | `context_servers` |
    | Lovable | ⚙️ partial | GitHub `AGENTS.md` + UI | — |
    | Replit | ⚙️ partial | `replit.md` + UI | — |
    | v0 (Vercel) | 📝 manual | web UI only | — |

    <Note>
    Each client uses a **different top-level key** for MCP servers. The most common mistake when configuring by hand is using `mcpServers` for VS Code (it wants `servers`), Codex (TOML `[mcp_servers]`), or Zed (`context_servers`).
    </Note>

    <Tabs>
      <Tab title="Claude Code">
        Add to `.mcp.json` at your project root (or `~/.claude.json` for all projects):

        ```json
        {
          "mcpServers": {
            "testdriver": {
              "type": "stdio",
              "command": "npx",
              "args": ["-p", "testdriverai", "testdriverai-mcp"],
              "env": { "TD_API_KEY": "${TD_API_KEY}" }
            }
          }
        }
        ```
      </Tab>

      <Tab title="Claude Desktop">
        Edit the Claude Desktop config file:

        - **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
        - **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
        - **Linux:** `~/.config/Claude/claude_desktop_config.json`

        ```json
        {
          "mcpServers": {
            "testdriver": {
              "command": "npx",
              "args": ["-p", "testdriverai", "testdriverai-mcp"],
              "env": { "TD_API_KEY": "your_api_key" }
            }
          }
        }
        ```

        Restart Claude Desktop after saving.
      </Tab>

      <Tab title="Cursor">
        Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

        ```json
        {
          "mcpServers": {
            "testdriver": {
              "type": "stdio",
              "command": "npx",
              "args": ["-p", "testdriverai", "testdriverai-mcp"],
              "env": { "TD_API_KEY": "${TD_API_KEY}" }
            }
          }
        }
        ```
      </Tab>

      <Tab title="VS Code">
        Add to `.vscode/mcp.json`. VS Code uses the `servers` key and an `inputs` prompt for secrets:

        ```json
        {
          "servers": {
            "testdriver": {
              "type": "stdio",
              "command": "npx",
              "args": ["-p", "testdriverai", "testdriverai-mcp"],
              "env": { "TD_API_KEY": "${input:testdriver-api-key}" }
            }
          },
          "inputs": [
            {
              "type": "promptString",
              "id": "testdriver-api-key",
              "description": "TestDriver API Key From https://console.testdriver.ai/team",
              "password": true
            }
          ]
        }
        ```
      </Tab>

      <Tab title="Windsurf">
        Windsurf reads MCP config globally. Add to `~/.codeium/windsurf/mcp_config.json`:

        ```json
        {
          "mcpServers": {
            "testdriver": {
              "command": "npx",
              "args": ["-p", "testdriverai", "testdriverai-mcp"],
              "env": { "TD_API_KEY": "${TD_API_KEY}" }
            }
          }
        }
        ```
      </Tab>

      <Tab title="Codex">
        Codex uses TOML. Add to `~/.codex/config.toml`:

        ```toml
        [mcp_servers.testdriver]
        command = "npx"
        args = ["-p", "testdriverai", "testdriverai-mcp"]
        env = { TD_API_KEY = "${TD_API_KEY}" }
        ```
      </Tab>

      <Tab title="Zed">
        Zed calls them "context servers". Add to `.zed/settings.json` (project) or `~/.config/zed/settings.json` (global):

        ```json
        {
          "context_servers": {
            "testdriver": {
              "command": "npx",
              "args": ["-p", "testdriverai", "testdriverai-mcp"],
              "env": { "TD_API_KEY": "${TD_API_KEY}" }
            }
          }
        }
        ```
      </Tab>
    </Tabs>

    **Web-based clients** — Lovable, Replit, and v0 run in the browser, so the MCP server can't be launched as a local process. Configure them through each product's UI:

    <AccordionGroup>
      <Accordion title="Lovable">
        1. Connect your GitHub repo and run `npx testdriverai init --client lovable` — this writes `AGENTS.md` and the skills into the repo so Lovable's agent picks them up.
        2. In Lovable, open **Settings → MCP** and add the TestDriver server.
      </Accordion>

      <Accordion title="Replit">
        1. Run `npx testdriverai init --client replit` to write `replit.md` with the TestDriver agent guidance.
        2. In Replit, open **Tools → Integrations → MCP** and add a custom MCP server.
      </Accordion>

      <Accordion title="v0 (Vercel)">
        v0 is fully UI-driven and does not read repo files.

        1. Open **[v0.app/chat/settings/mcp-connections](https://v0.app/chat/settings/mcp-connections)** and add the TestDriver MCP connection.
        2. Paste the agent guidance into **Instructions** (the **+** in the prompt bar).
      </Accordion>
    </AccordionGroup>

    ### Verifying the install

    Open your client's chat and ask the agent to write a test:

    ```text
    @testdriver write a test that opens the homepage and asserts the title
    ```

    If the MCP server is wired up correctly, the agent will start a session and you'll see screenshots come back as it works. If tools don't appear, check that `TD_API_KEY` is set and restart the client.

  </Tab>
  <Tab title="Manual" icon="wrench">

    Install TestDriver and manually create the files yourself.

    <Steps>
      <Step title="Create a TestDriver Account">

        You will need a TestDriver account to get an API key.

        <Card
          title="Get an API Key"
          icon="user-plus"
          href="https://console.testdriver.ai/team"
          arrow
          horizontal
        >
          Start with 60 free device minutes, no credit-card required!
        </Card>

      </Step>
      <Step title="Install Dependencies">

        Install Vitest and TestDriver as dev dependencies:

        ```bash
        npm install --save-dev vitest testdriverai
        ```

      </Step>
      <Step title="Create a vitest.config.js File">

        In your project root, create a `vitest.config.js` file with the following content:

        ```js vitest.config.js
        import TestDriver from 'testdriverai/vitest';
        import { defineConfig } from 'vitest/config';

        export default defineConfig({
          test: {
            testTimeout: 900000,
            hookTimeout: 900000,
            reporters: [
              'default',
              TestDriver()
            ],
            setupFiles: ['testdriverai/vitest/setup'],
          },
        });
        ```

      </Step>
      <Step title="Create an Example Test File">

        Add your API key to the example test file below and save it as `test.mjs` in your project root.

        ```js test.mjs highlight={9}
        import { describe, expect, it } from "vitest";
        // Import TestDriver from the vitest hooks
        import { TestDriver } from "testdriverai/vitest/hooks";

        describe("Google Search Example", () => {
          it("should search for TestDriver", async (context) => {
            // Create TestDriver instance - automatically connects to sandbox
            const testdriver = TestDriver(context, {
              apiKey: 'YOUR_API_KEY_HERE' // supply your API key here 
            });

            // Provision Chrome browser with a URL
            // This also starts dashcam recording automatically
            await testdriver.provision.chrome({ url: "https://duckduckgo.com" });

            // Find and interact with elements using natural language
            const searchBox = await testdriver.find("DuckDuckGo search input field");
            await searchBox.click();

            // Type into the focused element
            await testdriver.type("testdriver.ai");

            // Press Enter to search
            await testdriver.pressKeys(["enter"]);

            // Assert something is visible on the page
            const result = await testdriver.assert("search results are displayed");
            expect(result).toBeTruthy();
          });
        });
        ```

      </Step>
      <Step title="Run Your Test">

        TestDriver uses Vitest as the test runner. To run your test, use:
        
        ```bash
        vitest run
        ```

        This will spawn a sandbox, launch Chrome, and run the example test!

      </Step>
    </Steps>
  </Tab>
</Tabs>
