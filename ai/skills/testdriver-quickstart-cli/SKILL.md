---
name: testdriver:quickstart-cli
description: Scaffold a project, connect TestDriver to your AI client, and run your first test.
---
<!-- Generated from quickstart-cli.mdx. DO NOT EDIT. -->

Use the TestDriver CLI to scaffold a project, connect your AI client, and run the example test. `testdriverai init` installs three things so you can write, run, and debug real end-to-end tests from chat:

- **The agent**: an expert test-writer. It controls a live sandbox, writes code after each step, and re-runs the test until it passes.
- **Skills**: small instruction files that teach the agent the correct syntax for each TestDriver capability (`find`, `click`, `type`, `assert`, and more).
- **The MCP server**: exposes TestDriver's computer-use tools through the [Model Context Protocol](https://modelcontextprotocol.io) so any MCP client can call them.

<Info>
**Prerequisites**

- [Node.js](https://nodejs.org) 20.19 or later
- A TestDriver account. [Create one for free](https://console.testdriver.ai/settings). You get 60 device minutes, no credit card required.
</Info>

<Steps>
  <Step title="Scaffold a project">

    Make a new folder (or open an existing project) and run `init`:

    ```bash
    mkdir my-tests && cd my-tests
    npx testdriverai init
    ```

    `init` asks two questions:

    1. **How to authenticate.** Choose **Login with browser** to sign in and save your key automatically, or paste an API key from [console.testdriver.ai/settings](https://console.testdriver.ai/settings). Either way, it is saved to `.env` as `TD_API_KEY`.
    2. **Which AI clients to set up.** Pick VS Code, Cursor, Claude Code, and others, or press Enter to skip. `init` detects the clients already present in your project and pre-selects them. You can run `init` again later to add more; it merges the TestDriver entry into your existing config and does not overwrite your other servers.

    It then installs `vitest` and `testdriverai` and creates these files:

    | File | Purpose |
    | --- | --- |
    | `tests/example.test.js` | Example test: log in to a demo store and add an item to the cart |
    | `tests/login.js` | Reusable login snippet imported by the example test |
    | `vitest.config.js` | Vitest config with the TestDriver reporter and long timeouts |
    | `.env` | Your `TD_API_KEY` (git-ignored) |
    | `.github/workflows/testdriver.yml` | GitHub Actions workflow that runs your tests on every PR |
    | `.github/agents/`, `.github/skills/` | Agent and skills for the AI clients you selected |

    <Tip>
    Skip the prompts in CI or scripts with flags:

    ```bash
    npx testdriverai init --client claude-code               # one client
    npx testdriverai init --client claude-code,cursor,vscode # several
    npx testdriverai init --client all                       # everything
    npx testdriverai init --no-sample-test                   # no example files
    ```
    </Tip>

  </Step>

  <Step title="Connect your AI client">

    `init` writes the agent, skills, and MCP server config in the format and location each client expects. Here is what it installs and where.

    #### The agent

    The **TestDriver agent** runs inside your AI client (Claude Code, Cursor, VS Code, and others). Unlike a chat assistant that only suggests code, it works **iteratively on a live sandbox**: it starts a session, performs each action, writes the code to your test file, confirms the result with a screenshot, and re-runs the test until it passes.

    | Client | Agent location |
    | --- | --- |
    | Claude Code | `.claude/agents/testdriver.md` |
    | VS Code (Copilot) | `.github/agents/testdriver.agent.md` |
    | Cursor | `.cursor/rules/testdriver.mdc` |
    | Windsurf | `.windsurf/rules/testdriver.md` |
    | Codex | `AGENTS.md` |
    | Zed | `.rules` |

    #### Skills

    **Skills** are small instruction files, one per TestDriver capability, in the [Anthropic `SKILL.md` format](https://code.claude.com/docs/en/skills). There are over 100, generated from this documentation, covering every action and concept: `find`, `click`, `type`, `assert`, `check`, `scroll`, `press-keys`, `provision`, caching, secrets, CI/CD, and more.

    | Client | Skills location |
    | --- | --- |
    | Claude Code | `.claude/skills/<name>/SKILL.md` |
    | Zed | `.agents/skills/<name>/SKILL.md` |
    | Codex | referenced from `AGENTS.md` |
    | VS Code · Cursor · Windsurf | folded into the agent rules/instructions |

    #### MCP server

    The **TestDriver MCP server** exposes the computer-use tools (`session_start`, `find`, `click`, `type`, `assert`, `check`, `screenshot`, and more). It runs as a local stdio process and authenticates with your `TD_API_KEY`:

    ```bash
    npx -p testdriverai testdriverai-mcp
    ```

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

    <Accordion title="Configure the MCP server by hand">
      <Note>
      Each client uses a **different top-level key** for MCP servers. The most common manual-config mistake is using `mcpServers` for VS Code (which needs `servers`), Codex (TOML `[mcp_servers]`), or Zed (`context_servers`).
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
    </Accordion>

    <Accordion title="Web-based clients (Lovable, Replit, v0)">
      These run in the browser, so they cannot start the MCP server as a local process. Configure them through each product's UI.

      **Lovable**

      1. Connect your GitHub repo, then run `npx testdriverai init --client lovable`. This writes `AGENTS.md` and the skills into the repo so the Lovable agent can use them.
      2. In Lovable, open **Settings → MCP** and add the TestDriver server.

      **Replit**

      1. Run `npx testdriverai init --client replit` to write `replit.md` with the TestDriver agent guidance.
      2. In Replit, open **Tools → Integrations → MCP** and add a custom MCP server.

      **v0 (Vercel)**

      v0 is UI-only and does not read repo files.

      1. Open **[v0.app/chat/settings/mcp-connections](https://v0.app/chat/settings/mcp-connections)** and add the TestDriver MCP connection.
      2. Paste the agent guidance into **Instructions** (the **+** in the prompt bar).
    </Accordion>

    #### Verify the install

    Open your client's chat and ask the agent to write a test:

    ```text
    @testdriver write a test that opens the homepage and asserts the title
    ```

    If the MCP server is connected, the agent starts a sandbox session and you see screenshots as it works. It writes the steps into a test file in `tests/` and runs it for you. If the tools do not appear, confirm that `TD_API_KEY` is set and restart the client.

  </Step>

  <Step title="Run the example test">

    TestDriver tests are plain [Vitest](https://vitest.dev) tests. Run them with:

    ```bash
    npm test
    ```

    Here is what happens:

    1. A cloud sandbox starts and opens Chrome at the demo app.
    2. A live preview of the sandbox opens in your browser so you can watch.
    3. The test finds the login form, types credentials, adds an item to the cart, and asserts the cart has an item.
    4. The sandbox is torn down and results are uploaded.

    At the end of the output, look for the run link:

    ```text
    TESTDRIVER_RUN_URL=https://console.testdriver.ai/runs/...
    ```

    Open it to see the video recording, screenshots, and logs for each step.

    <Note>
    The first run takes a minute or two while the sandbox boots. Later runs are faster because element locations are [cached](/caching).
    </Note>

  </Step>

  <Step title="Read the example test">

    Open `tests/example.test.js`. Every TestDriver test follows the same shape: create an instance, provision an app, then find, act, and assert in natural language.

    ```js tests/example.test.js
    import { test, expect } from 'vitest';
    import { TestDriver } from 'testdriverai/vitest/hooks';
    import { login } from './login.js';

    test('should login and add item to cart', async (context) => {
      // Connects to a sandbox and records the session
      const testdriver = TestDriver(context);

      // Launch Chrome at the app under test
      await testdriver.provision.chrome({
        url: 'http://testdriver-sandbox.vercel.app/login',
      });

      // Reusable step from tests/login.js
      await login(testdriver);

      // Describe elements in plain English
      const addToCart = await testdriver.find('add to cart button under TestDriver Hat');
      await addToCart.click();

      const cart = await testdriver.find('cart button in the top right corner');
      await cart.click();

      // Assert with natural language, then use Vitest's expect
      const result = await testdriver.assert('There is an item in the cart');
      expect(result).toBeTruthy();
    });
    ```

    The pieces you will use most:

    - [`provision.chrome()`](/provision) starts a browser (or a desktop app) in the sandbox
    - [`find()`](/find) locates an element by description; then call `.click()`, `.hover()`, and so on
    - [`type()`](/type) and [`pressKeys()`](/press-keys) send keyboard input
    - [`assert()`](/assert) asks a yes/no question about the screen

  </Step>

  <Step title="Write your own test">

    The fastest way is to ask the agent:

    ```text
    @testdriver write a test that searches duckduckgo.com for "testdriver.ai" and verifies results appear
    ```

    Or write it by hand. Create `tests/search.test.js` and point it at a site you want to test:

    ```js tests/search.test.js
    import { test, expect } from 'vitest';
    import { TestDriver } from 'testdriverai/vitest/hooks';

    test('search shows results', async (context) => {
      const testdriver = TestDriver(context);

      await testdriver.provision.chrome({ url: 'https://duckduckgo.com' });

      const searchBox = await testdriver.find('search input field');
      await searchBox.click();
      await testdriver.type('testdriver.ai');
      await testdriver.pressKeys(['enter']);

      const result = await testdriver.assert('search results are displayed');
      expect(result).toBeTruthy();
    });
    ```

    Run just that file:

    ```bash
    npx vitest run tests/search.test.js
    ```

    <Tip>
    Not sure how to describe an element? Say what a person sees: `"blue Sign In button in the header"` works better than `"button"`. See [Locating elements](/locating-elements).
    </Tip>

  </Step>

  <Step title="Run in CI">

    `init` already created `.github/workflows/testdriver.yml`. Push your project to GitHub, then add `TD_API_KEY` as a repository secret (**Settings → Secrets and variables → Actions**). Your tests now run on every pull request.

    See [CI/CD](/ci-cd) for other providers and for keyless auth with the TestDriver GitHub App.

  </Step>
</Steps>

## Troubleshooting

<AccordionGroup>
  <Accordion title="TD_API_KEY is not configured">
    The SDK reads `TD_API_KEY` from `.env` in the folder where you run `vitest`. Make sure the file exists and has this line:

    ```bash .env
    TD_API_KEY=your_api_key
    ```

    You can also export it in your shell: `export TD_API_KEY=your_api_key`.
  </Accordion>

  <Accordion title="The agent or MCP tools do not appear in my client">
    Confirm `TD_API_KEY` is set, check that the MCP config uses the correct top-level key for your client (see the table above), and restart the client. Running `npx testdriverai init --client <name>` again rewrites the config in the correct format.
  </Accordion>

  <Accordion title="No test files found">
    Vitest only picks up files that match `*.test.js`, `*.test.mjs`, or `*.spec.*`. Check the file name and that the file is inside your project folder.
  </Accordion>

  <Accordion title="Test times out">
    Sandbox provisioning and teardown take time. `init` sets `testTimeout` and `hookTimeout` to 5 minutes in `vitest.config.js`. If you wrote the config by hand, add both values.
  </Accordion>
</AccordionGroup>

## Next steps

<CardGroup cols={2}>
  <Card title="Generating tests" icon="wand-magic-sparkles" href="/generating-tests" arrow horizontal>
    Prompting patterns that get the best tests out of the agent.
  </Card>
  <Card title="Walkthrough" icon="map" href="/provision" arrow horizontal>
    Provision apps, locate elements, perform actions, and make assertions.
  </Card>
  <Card title="Reusable code" icon="recycle" href="/reusable-code" arrow horizontal>
    Share login flows and other steps across tests.
  </Card>
  <Card title="Secrets" icon="key" href="/secrets" arrow horizontal>
    Keep passwords and tokens out of logs and recordings.
  </Card>
</CardGroup>
