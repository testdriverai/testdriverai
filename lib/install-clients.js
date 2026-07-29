/**
 * Cross-client installer for TestDriver.
 *
 * Wires the TestDriver MCP server, the test-creator agent, and the skills into
 * the supported AI coding clients, each of which stores its configuration in a
 * different place and format.
 *
 * The CLIENTS registry below is the single source of truth. Each entry knows:
 *   - where that client reads its MCP server config (path + JSON/TOML key),
 *   - where it reads project instructions / custom agents,
 *   - whether it has a native "skills" concept (a folder of SKILL.md files).
 *
 * Web-based clients (Lovable, Replit, v0) cannot be configured by writing local
 * files, so they are marked `type: "web"` and `installClient` returns guidance
 * instead of writing anything.
 *
 * All writers are MERGE-SAFE and IDEMPOTENT: existing config is preserved and
 * re-running install does not duplicate the TestDriver entry.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const SERVER_NAME = "testdriver";

// Canonical stdio launch for the MCP server. `npx -p testdriverai testdriverai-mcp`
// matches the bin defined in package.json and the existing .vscode/mcp.json.
const MCP_COMMAND = "npx";
const MCP_ARGS = ["-p", "testdriverai", "testdriverai-mcp"];

/**
 * Build the per-client MCP server object. VS Code wants an explicit `type`,
 * and uses an `${input:...}` reference for the key so it prompts; everyone else
 * takes the API key from the environment via .env.
 */
function mcpServerEntry({ apiKeyRef } = {}) {
  return {
    command: MCP_COMMAND,
    args: [...MCP_ARGS],
    env: {
      TD_API_KEY: apiKeyRef || "${TD_API_KEY}",
    },
  };
}

// --- merge-safe JSON helpers -------------------------------------------------

function readJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = fs.readFileSync(file, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return undefined; // signals "exists but unparseable"
  }
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

/**
 * Merge the TestDriver server into a JSON MCP config under the given top-level
 * key (e.g. "mcpServers", "servers", "context_servers"). Returns a status
 * string. Does not clobber sibling servers or unrelated keys.
 */
function mergeJsonMcp(file, key, serverEntry, { inputs } = {}) {
  const existing = readJson(file);
  if (existing === undefined) {
    return { status: "error", message: `Existing ${path.basename(file)} is not valid JSON; left untouched` };
  }
  const config = existing || {};
  config[key] = config[key] || {};

  const already = !!config[key][SERVER_NAME];
  config[key][SERVER_NAME] = serverEntry;

  // VS Code: register the secret prompt input once.
  if (inputs) {
    config.inputs = config.inputs || [];
    for (const input of inputs) {
      if (!config.inputs.some((i) => i.id === input.id)) {
        config.inputs.push(input);
      }
    }
  }

  writeJson(file, config);
  return { status: already ? "updated" : "created", file };
}

// --- TOML (Codex) ------------------------------------------------------------

/**
 * Append a `[mcp_servers.testdriver]` table to a Codex config.toml if one is not
 * already present. We avoid a TOML parser (none is bundled) and instead do a
 * presence check + append, which is safe because we never edit existing tables.
 */
function mergeTomlMcp(file) {
  let content = "";
  if (fs.existsSync(file)) {
    content = fs.readFileSync(file, "utf8");
    if (content.includes(`[mcp_servers.${SERVER_NAME}]`)) {
      return { status: "skipped", file, message: "already present" };
    }
  }
  const argsToml = MCP_ARGS.map((a) => `"${a}"`).join(", ");
  const block =
    `\n[mcp_servers.${SERVER_NAME}]\n` +
    `command = "${MCP_COMMAND}"\n` +
    `args = [${argsToml}]\n` +
    `env = { TD_API_KEY = "\${TD_API_KEY}" }\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, (content.trimEnd() + "\n" + block).replace(/^\n+/, ""));
  return { status: "created", file };
}

// --- instructions + skills file helpers --------------------------------------

const AGENT_REF_BLOCK =
  "## TestDriver\n\n" +
  "This project uses [TestDriver](https://testdriver.ai) for AI-driven end-to-end testing.\n" +
  "When asked to write, debug, or run UI tests, act as the TestDriver test-creator agent:\n" +
  "drive the app through the TestDriver MCP tools (`session_start`, `find`, `click`, `type`,\n" +
  "`assert`, `check`, ...), write the generated code to the test file after each step, and run\n" +
  "the test with `vitest run` until it passes. The full agent definition lives in\n" +
  "`.github/agents/testdriver.agent.md` and the skills in `.github/skills/`.\n";

const AGENT_MARKER = "<!-- testdriver:agent -->";

/**
 * Append a TestDriver reference block to a portable instructions file
 * (AGENTS.md / CLAUDE.md / replit.md / .windsurfrules). Idempotent via marker.
 */
function appendInstructions(file) {
  let content = "";
  if (fs.existsSync(file)) {
    content = fs.readFileSync(file, "utf8");
    if (content.includes(AGENT_MARKER)) {
      return { status: "skipped", file, message: "already present" };
    }
  }
  const block = `${AGENT_MARKER}\n${AGENT_REF_BLOCK}${AGENT_MARKER}\n`;
  const sep = content && !content.endsWith("\n\n") ? "\n\n" : "";
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content + sep + block);
  return { status: content ? "updated" : "created", file };
}

/**
 * Copy SKILL.md folders from the source skills dir into a client's native
 * skills directory. Returns the count copied.
 */
function copySkills(skillsSource, destDir) {
  if (!skillsSource || !fs.existsSync(skillsSource)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(skillsSource)) {
    const src = path.join(skillsSource, entry);
    if (!fs.statSync(src).isDirectory()) continue;
    const skillFile = path.join(src, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    const destSkillDir = path.join(destDir, entry);
    fs.mkdirSync(destSkillDir, { recursive: true });
    fs.copyFileSync(skillFile, path.join(destSkillDir, "SKILL.md"));
    count++;
  }
  return count;
}

/**
 * Copy the agent markdown into a client's agents directory, renaming to the
 * client's expected suffix.
 */
function copyAgent(agentSource, destDir, suffix) {
  if (!agentSource || !fs.existsSync(agentSource)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const file of fs.readdirSync(agentSource).filter((f) => f.endsWith(".md"))) {
    const name = file.replace(/\.md$/, "");
    fs.copyFileSync(
      path.join(agentSource, file),
      path.join(destDir, `${name}${suffix}`),
    );
    count++;
  }
  return count;
}

// --- client registry ---------------------------------------------------------

const HOME = os.homedir();

/**
 * Each client exposes an `install({ targetDir, apiKey, agentSource, skillsSource })`
 * that performs the native wiring and returns an array of step results.
 */
const CLIENTS = {
  "claude-code": {
    label: "Claude Code (CLI)",
    type: "local",
    install({ targetDir, agentSource, skillsSource }) {
      const steps = [];
      steps.push(
        mergeJsonMcp(path.join(targetDir, ".mcp.json"), "mcpServers", {
          type: "stdio",
          ...mcpServerEntry(),
        }),
      );
      const skills = copySkills(skillsSource, path.join(targetDir, ".claude", "skills"));
      if (skills) steps.push({ status: "created", message: `${skills} skills → .claude/skills/` });
      const agents = copyAgent(agentSource, path.join(targetDir, ".claude", "agents"), ".md");
      if (agents) steps.push({ status: "created", message: `agent → .claude/agents/` });
      return steps;
    },
  },

  "claude-desktop": {
    label: "Claude Desktop",
    type: "local",
    install() {
      // Claude Desktop has a single, OS-specific, non-project config file.
      const file =
        process.platform === "darwin"
          ? path.join(HOME, "Library", "Application Support", "Claude", "claude_desktop_config.json")
          : process.platform === "win32"
            ? path.join(process.env.APPDATA || path.join(HOME, "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
            : path.join(HOME, ".config", "Claude", "claude_desktop_config.json");
      return [mergeJsonMcp(file, "mcpServers", mcpServerEntry())];
    },
  },

  cursor: {
    label: "Cursor",
    type: "local",
    install({ targetDir }) {
      const steps = [];
      steps.push(
        mergeJsonMcp(path.join(targetDir, ".cursor", "mcp.json"), "mcpServers", {
          type: "stdio",
          ...mcpServerEntry(),
        }),
      );
      // Cursor has no native skills; fold the agent reference into a rule.
      // Rules MUST use the .mdc extension.
      const ruleFile = path.join(targetDir, ".cursor", "rules", "testdriver.mdc");
      if (!fs.existsSync(ruleFile)) {
        fs.mkdirSync(path.dirname(ruleFile), { recursive: true });
        const rule =
          "---\n" +
          "description: TestDriver AI end-to-end testing agent\n" +
          "alwaysApply: false\n" +
          "---\n\n" +
          AGENT_REF_BLOCK;
        fs.writeFileSync(ruleFile, rule);
        steps.push({ status: "created", file: ruleFile });
      } else {
        steps.push({ status: "skipped", file: ruleFile, message: "already present" });
      }
      return steps;
    },
  },

  vscode: {
    label: "VS Code (GitHub Copilot)",
    type: "local",
    install({ targetDir, agentSource }) {
      const steps = [];
      // VS Code uses `servers` (not mcpServers) and an `inputs` prompt for secrets.
      steps.push(
        mergeJsonMcp(
          path.join(targetDir, ".vscode", "mcp.json"),
          "servers",
          { type: "stdio", ...mcpServerEntry({ apiKeyRef: "${input:testdriver-api-key}" }) },
          {
            inputs: [
              {
                type: "promptString",
                id: "testdriver-api-key",
                description: "TestDriver API Key From https://console.testdriver.ai/team",
                password: true,
              },
            ],
          },
        ),
      );
      const agents = copyAgent(agentSource, path.join(targetDir, ".github", "agents"), ".agent.md");
      if (agents) steps.push({ status: "created", message: "agent → .github/agents/" });
      return steps;
    },
  },

  windsurf: {
    label: "Windsurf",
    type: "local",
    install({ targetDir }) {
      const steps = [];
      // Windsurf MCP config is global-only.
      steps.push(
        mergeJsonMcp(
          path.join(HOME, ".codeium", "windsurf", "mcp_config.json"),
          "mcpServers",
          mcpServerEntry(),
        ),
      );
      // Project rules: per-topic markdown under .windsurf/rules/.
      const ruleFile = path.join(targetDir, ".windsurf", "rules", "testdriver.md");
      if (!fs.existsSync(ruleFile)) {
        fs.mkdirSync(path.dirname(ruleFile), { recursive: true });
        fs.writeFileSync(ruleFile, AGENT_REF_BLOCK);
        steps.push({ status: "created", file: ruleFile });
      } else {
        steps.push({ status: "skipped", file: ruleFile, message: "already present" });
      }
      return steps;
    },
  },

  codex: {
    label: "Codex (OpenAI CLI)",
    type: "local",
    install({ targetDir }) {
      const steps = [];
      // Codex uses TOML and a global config file.
      steps.push(mergeTomlMcp(path.join(HOME, ".codex", "config.toml")));
      // Instructions via portable AGENTS.md.
      steps.push(appendInstructions(path.join(targetDir, "AGENTS.md")));
      return steps;
    },
  },

  zed: {
    label: "Zed",
    type: "local",
    install({ targetDir, skillsSource }) {
      const steps = [];
      // Zed: project settings, `context_servers` key.
      steps.push(
        mergeJsonMcp(path.join(targetDir, ".zed", "settings.json"), "context_servers", mcpServerEntry()),
      );
      // Zed has native skills under <worktree>/.agents/skills/.
      const skills = copySkills(skillsSource, path.join(targetDir, ".agents", "skills"));
      if (skills) steps.push({ status: "created", message: `${skills} skills → .agents/skills/` });
      steps.push(appendInstructions(path.join(targetDir, ".rules")));
      return steps;
    },
  },

  // --- web clients: documented, not auto-installable -------------------------

  lovable: {
    label: "Lovable",
    type: "web",
    install({ targetDir, skillsSource }) {
      // Lovable reads AGENTS.md/SKILL.md from the connected GitHub repo, and the
      // MCP server must be added via the Lovable web UI.
      const steps = [];
      steps.push(appendInstructions(path.join(targetDir, "AGENTS.md")));
      const skills = copySkills(skillsSource, path.join(targetDir, ".lovable", "skills"));
      if (skills) steps.push({ status: "created", message: `${skills} skills → .lovable/skills/` });
      steps.push({
        status: "manual",
        message: "Add the TestDriver MCP server in Lovable: Settings → MCP → add remote/stdio server",
      });
      return steps;
    },
  },

  replit: {
    label: "Replit",
    type: "web",
    install({ targetDir }) {
      const steps = [];
      // Replit reads replit.md at the project root.
      steps.push(appendInstructions(path.join(targetDir, "replit.md")));
      steps.push({
        status: "manual",
        message: "Add the TestDriver MCP server in Replit: Tools → Integrations → MCP",
      });
      return steps;
    },
  },

  v0: {
    label: "v0 (Vercel)",
    type: "web",
    install() {
      // v0 has no repo-file ingestion; everything is UI-driven.
      return [
        {
          status: "manual",
          message:
            "Configure v0 in the web UI: add MCP at v0.app/chat/settings/mcp-connections, " +
            "and paste the agent guidance into Instructions (the + in the prompt bar).",
        },
      ];
    },
  },
};

/**
 * Resolve a list of client ids, accepting "all" and ignoring unknown ids.
 * @returns {{ valid: string[], unknown: string[] }}
 */
function resolveClientIds(input) {
  const ids = Array.isArray(input)
    ? input
    : String(input || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
  if (ids.includes("all")) return { valid: Object.keys(CLIENTS), unknown: [] };
  const valid = [];
  const unknown = [];
  for (const id of ids) {
    if (CLIENTS[id]) valid.push(id);
    else unknown.push(id);
  }
  return { valid, unknown };
}

/**
 * Install TestDriver into a single client.
 * @returns {{ id, label, type, steps: Array }}
 */
function installClient(clientId, options) {
  const client = CLIENTS[clientId];
  if (!client) throw new Error(`Unknown client: ${clientId}`);
  const steps = client.install(options) || [];
  return { id: clientId, label: client.label, type: client.type, steps };
}

/**
 * Best-effort detection of which clients already have config in/around the
 * target directory, used to pre-select the interactive picker.
 */
function detectClients(targetDir) {
  const present = [];
  const checks = {
    "claude-code": [path.join(targetDir, ".mcp.json"), path.join(targetDir, ".claude")],
    cursor: [path.join(targetDir, ".cursor")],
    vscode: [path.join(targetDir, ".vscode")],
    zed: [path.join(targetDir, ".zed")],
    windsurf: [path.join(targetDir, ".windsurf"), path.join(HOME, ".codeium", "windsurf")],
    codex: [path.join(HOME, ".codex")],
    "claude-desktop": [
      path.join(HOME, "Library", "Application Support", "Claude"),
      path.join(HOME, ".config", "Claude"),
    ],
  };
  for (const [id, paths] of Object.entries(checks)) {
    if (paths.some((p) => fs.existsSync(p))) present.push(id);
  }
  return present;
}

module.exports = {
  CLIENTS,
  SERVER_NAME,
  installClient,
  resolveClientIds,
  detectClients,
  // exported for testing
  mergeJsonMcp,
  mergeTomlMcp,
  appendInstructions,
};
