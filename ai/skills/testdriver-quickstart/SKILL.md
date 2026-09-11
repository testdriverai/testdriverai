---
name: testdriver:quickstart
description: Run your first computer-use test in minutes.
---
<!-- Generated from quickstart.mdx. DO NOT EDIT. -->

TestDriver makes it easy to write automated computer-use tests. You can test web browsers, desktop apps, and more. Follow the directions below to run your first TestDriver test.

<Tip><a href="https://discord.com/invite/cWDFW8DzPm" target="_blank" rel="noreferrer">Join our Discord</a> if you have any questions or need help getting started!</Tip>

<Tabs>
  <Tab title="Add to GitHub" icon="github">

    Drop-in UI tests for any GitHub repository. Mention `@testdriverai` in your repo. It writes UI tests and it finds regressions before they merge.

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
        Click **Add to GitHub** above. Then install TestDriver on the repositories that you want to test.
      </Step>

      <Step title="Mention @testdriverai">
        Open a pull request or an issue. Mention `@testdriverai` to make it write and run UI tests:

        ```
        @testdriverai Write a test that verifies the homepage loads and the signup button works.
        ```

        TestDriver starts a sandbox, writes the test, and shows the results in the conversation.
      </Step>

      <Step title="Catch Regressions Automatically">
        After you commit your tests, TestDriver runs them on each pull request. It shows regressions before they merge.
      </Step>
    </Steps>

    Do you want to use TestDriver from GitHub Copilot or the GitHub Mobile app? Read the full GitHub guide:

    <Card
      title="GitHub Integration Guide"
      icon="arrow-right"
      href="/copilot/auto-healing#use-testdriver-in-github"
      arrow
      horizontal
    >
      Use TestDriver from GitHub web, Copilot chat, PR reviews, and mobile.
    </Card>

  </Tab>
  <Tab title="CLI" icon="terminal">

    Start quickly with the TestDriver CLI.

    <Steps>
      <Step title="Install TestDriver">

        Use `npx` to set up an example project quickly:

        ```bash
        npx testdriverai init
        ```

        This helps you to make a new project folder, install dependencies, set up your API key, and configure MCP for your AI assistant (VS Code, Cursor, Claude Desktop, and others).

      </Step>
      
      <Step title="Run Your Test">

        TestDriver uses Vitest as the test runner. To run your test, use:
        
        ```bash
        vitest run
        ```

        This starts a sandbox, starts Chrome, and runs the example test.

      </Step>
    </Steps>
  </Tab>
  <Tab title="AI Setup" icon="robot">

    Connect TestDriver to your AI client. Then you can write, run, and debug real end-to-end tests from chat. There are three parts. `testdriverai init` installs all of them for you:

    - **The agent**. This is an expert test-creator. It controls a live sandbox, writes code after each step, and runs the test again until the test passes.
    - **Skills**. These are small instruction files. They teach the agent the correct syntax for each TestDriver capability (`find`, `click`, `type`, `assert`, and more).
    - **The MCP server**. This gives the computer-use tools of TestDriver through the [Model Context Protocol](https://modelcontextprotocol.io). Then an MCP client can use them.

    ### Quick install (recommended)

    `testdriverai init` connects the agent, skills, and MCP server for you. It writes the config of each client in the correct format and location:

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
    `init` finds the clients that are in your project. It selects them in the picker. To run `init` again is safe. It merges the TestDriver entry into the config that exists. It does not write over your other servers.
    </Info>

    You need a TestDriver API key. Create one at [console.testdriver.ai/settings](https://console.testdriver.ai/settings). Then `init` saves it to `.env` as `TD_API_KEY`.

    ### The agent

    The **TestDriver agent** is an expert test-creator. It runs in your AI client (Claude Code, Cursor, VS Code, and others). It writes, runs, and debugs real end-to-end tests. It controls your app the same as a person. It uses AI vision to find elements, click, type, and assert, through the TestDriver MCP server.

   Unlike a chat assistant only suggests code, the agent works **iteratively on a live sandbox**. It starts a session, does each action, writes the code to your test file, makes sure of the result with a screenshot, and runs the test again until the test passes.

    In init, the tool asks which AI clients to install into. The agent is written to the location that each client expects:

    | Client | Agent location |
    | --- | --- |
    | Claude Code | `.claude/agents/testdriver.md` |
    | VS Code (Copilot) | `.github/agents/testdriver.agent.md` |
    | Cursor | `.cursor/rules/testdriver.mdc` |
    | Windsurf | `.windsurf/rules/testdriver.md` |
    | Codex | `AGENTS.md` |
    | Zed | `.rules` |

    After you install it, start it from the chat of your client:

    ```text
    @testdriver write a test that logs in and verifies the dashboard loads
    ```

    The agent starts a sandbox, does the steps live, writes them into a test file in `tests/`, and runs it for you.

    ### Skills

    **Skills** are small instruction files. There is one skill for each TestDriver capability. They teach your AI client how to use each part of the TestDriver SDK and the MCP tools. They obey the [Anthropic `SKILL.md` format](https://code.claude.com/docs/en/skills): one folder for each skill. Each folder has a `SKILL.md` with YAML frontmatter and a markdown body.

    There are **106 skills**. TestDriver makes them from the documentation. They include each action and concept: `find`, `click`, `type`, `assert`, `check`, `scroll`, `press-keys`, `provision`, caching, secrets, CI/CD, and more. They are written to the directory that each client expects:

    | Client | Skills location |
    | --- | --- |
    | Claude Code | `.claude/skills/<name>/SKILL.md` |
    | Zed | `.agents/skills/<name>/SKILL.md` |
    | Codex | referenced from `AGENTS.md` |
    | VS Code · Cursor · Windsurf | folded into the agent rules/instructions |


    ### MCP server

    The **TestDriver MCP server** gives the computer-use tools of TestDriver — `session_start`, `find`, `click`, `type`, `assert`, `check`, `screenshot`, and more through the [Model Context Protocol](https://modelcontextprotocol.io). It runs as a local stdio process:

    ```bash
    npx -p testdriverai testdriverai-mcp
    ```

    It authenticates with your `TD_API_KEY`. `testdriverai init` configures it for you. But you can also configure it by hand:

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
    Each client uses a **different top-level key** for MCP servers. When you configure by hand, the most common error is to use `mcpServers` for VS Code (it needs `servers`), Codex (TOML `[mcp_servers]`), or Zed (`context_servers`).
    </Note>

    <Tabs>
      <Tab title="Claude Code">
        Add this to `.mcp.json` at your project root (or `~/.claude.json` for all projects):

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

        Start Claude Desktop again after you save.
      </Tab>

      <Tab title="Cursor">
        Add this to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

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
        Add this to `.vscode/mcp.json`. VS Code uses the `servers` key and an `inputs` prompt for secrets:

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
              "description": "TestDriver API Key From https://console.testdriver.ai/settings",
              "password": true
            }
          ]
        }
        ```
      </Tab>

      <Tab title="Windsurf">
        Windsurf reads the MCP config globally. Add this to `~/.codeium/windsurf/mcp_config.json`:

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
        Codex uses TOML. Add this to `~/.codex/config.toml`:

        ```toml
        [mcp_servers.testdriver]
        command = "npx"
        args = ["-p", "testdriverai", "testdriverai-mcp"]
        env = { TD_API_KEY = "${TD_API_KEY}" }
        ```
      </Tab>

      <Tab title="Zed">
        Zed calls them "context servers". Add this to `.zed/settings.json` (project) or `~/.config/zed/settings.json` (global):

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

    **Web-based clients** — Lovable, Replit, and v0 run in the browser. Thus you cannot start the MCP server as a local process. Configure them through the UI of each product:

    <AccordionGroup>
      <Accordion title="Lovable">
        1. Connect your GitHub repo. Then run `npx testdriverai init --client lovable`. This writes `AGENTS.md` and the skills into the repo. Then the Lovable agent uses them.
        2. In Lovable, open **Settings → MCP**. Then add the TestDriver server.
      </Accordion>

      <Accordion title="Replit">
        1. Run `npx testdriverai init --client replit` to write `replit.md` with the TestDriver agent guidance.
        2. In Replit, open **Tools → Integrations → MCP**. Then add a custom MCP server.
      </Accordion>

      <Accordion title="v0 (Vercel)">
        The v0 client uses only the UI. It does not read repo files.

        1. Open **[v0.app/chat/settings/mcp-connections](https://v0.app/chat/settings/mcp-connections)**. Then add the TestDriver MCP connection.
        2. Put the agent guidance into **Instructions** (the **+** in the prompt bar).
      </Accordion>
    </AccordionGroup>

    ### Verify the install

    Open the chat of your client. Then tell the agent to write a test:

    ```text
    @testdriver write a test that opens the homepage and asserts the title
    ```

    If the MCP server is correct, the agent starts a session. You see screenshots as it works. If the tools do not show, make sure that `TD_API_KEY` is set. Then start the client again.

  </Tab>
  <Tab title="Manual" icon="wrench">

    Install TestDriver. Then make the files by hand.

    <Steps>
      <Step title="Create a TestDriver Account">

        You need a TestDriver account to get an API key.

        <Card
          title="Get an API Key"
          icon="user-plus"
          href="https://console.testdriver.ai/settings"
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

        In your project root, make a `vitest.config.js` file with this content:

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

        Add your API key to the example test file below. Then save it as `test.mjs` in your project root.

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

        This starts a sandbox, starts Chrome, and runs the example test.

      </Step>
    </Steps>
  </Tab>
</Tabs>
