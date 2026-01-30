/**
 * Code generation for TestDriver test files
 * Generates code snippets for inline responses
 */

/**
 * Escape string for JavaScript
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Generate code for a single action (for inline responses)
 * Returns the code snippet that the agent should append to their test file
 */
export function generateActionCode(
  action: string,
  args: Record<string, unknown>,
  result?: Record<string, unknown>
): string {
  switch (action) {
    case "provision.chrome": {
      const url = (args.url as string) || "https://example.com";
      const maximized = args.maximized as boolean | undefined;
      const guest = args.guest as boolean | undefined;
      
      const opts: string[] = [`url: "${escapeString(url)}"`];
      if (maximized !== undefined) opts.push(`maximized: ${maximized}`);
      if (guest !== undefined) opts.push(`guest: ${guest}`);
      
      return `await testdriver.provision.chrome({ ${opts.join(", ")} });`;
    }

    case "provision.chromeExtension": {
      const extensionPath = args.extensionPath as string | undefined;
      const extensionId = args.extensionId as string | undefined;
      const maximized = args.maximized as boolean | undefined;
      
      const opts: string[] = [];
      if (extensionPath) opts.push(`extensionPath: "${escapeString(extensionPath)}"`);
      if (extensionId) opts.push(`extensionId: "${escapeString(extensionId)}"`);
      if (maximized !== undefined) opts.push(`maximized: ${maximized}`);
      
      return `await testdriver.provision.chromeExtension({ ${opts.join(", ")} });`;
    }

    case "provision.vscode": {
      const workspace = args.workspace as string | undefined;
      const extensions = args.extensions as string[] | undefined;
      
      const opts: string[] = [];
      if (workspace) opts.push(`workspace: "${escapeString(workspace)}"`);
      if (extensions && extensions.length > 0) {
        opts.push(`extensions: [${extensions.map(e => `"${escapeString(e)}"`).join(", ")}]`);
      }
      
      return `await testdriver.provision.vscode({ ${opts.join(", ")} });`;
    }

    case "provision.installer": {
      const url = args.url as string;
      const filename = args.filename as string | undefined;
      const appName = args.appName as string | undefined;
      const launch = args.launch as boolean | undefined;
      
      const opts: string[] = [`url: "${escapeString(url)}"`];
      if (filename) opts.push(`filename: "${escapeString(filename)}"`);
      if (appName) opts.push(`appName: "${escapeString(appName)}"`);
      if (launch !== undefined) opts.push(`launch: ${launch}`);
      
      return `await testdriver.provision.installer({ ${opts.join(", ")} });`;
    }

    case "provision.electron": {
      const appPath = args.appPath as string;
      const electronArgs = args.args as string[] | undefined;
      
      const opts: string[] = [`appPath: "${escapeString(appPath)}"`];
      if (electronArgs && electronArgs.length > 0) {
        opts.push(`args: [${electronArgs.map(a => `"${escapeString(a)}"`).join(", ")}]`);
      }
      
      return `await testdriver.provision.electron({ ${opts.join(", ")} });`;
    }

    case "find": {
      const description = args.description as string;
      return `const element = await testdriver.find("${escapeString(description)}");`;
    }

    case "click": {
      // When used after find, reference the element
      const clickAction = args.action as string || "click";
      if (clickAction === "click") {
        return `await element.click();`;
      } else if (clickAction === "double-click") {
        return `await element.doubleClick();`;
      } else if (clickAction === "right-click") {
        return `await element.rightClick();`;
      }
      return `await element.click();`;
    }

    case "hover": {
      return `await element.hover();`;
    }

    case "find_and_click": {
      const description = args.description as string;
      const clickAction = args.action as string || "click";
      
      if (clickAction === "click") {
        return `await testdriver.find("${escapeString(description)}").click();`;
      } else if (clickAction === "double-click") {
        return `await testdriver.find("${escapeString(description)}").doubleClick();`;
      } else if (clickAction === "right-click") {
        return `await testdriver.find("${escapeString(description)}").rightClick();`;
      }
      return `await testdriver.find("${escapeString(description)}").click();`;
    }

    case "type": {
      const text = String(args.text);
      const secret = args.secret as boolean;
      
      if (secret) {
        return `await testdriver.type(process.env.TD_SECRET || "", { secret: true });`;
      }
      return `await testdriver.type("${escapeString(text)}");`;
    }

    case "press_keys": {
      const keys = args.keys as string[];
      return `await testdriver.pressKeys([${keys.map(k => `"${k}"`).join(", ")}]);`;
    }

    case "scroll": {
      const direction = (args.direction as string) || "down";
      const amount = args.amount as number | undefined;
      
      if (amount) {
        return `await testdriver.scroll("${direction}", { amount: ${amount} });`;
      }
      return `await testdriver.scroll("${direction}");`;
    }

    case "assert": {
      const assertion = args.assertion as string;
      return `const assertResult = await testdriver.assert("${escapeString(assertion)}");\nexpect(assertResult).toBeTruthy();`;
    }

    case "exec": {
      const language = (args.language as string) || "js";
      const code = args.code as string;
      const timeout = args.timeout as number | undefined;
      
      if (code.includes("\n")) {
        return `await testdriver.exec("${language}", \`${code.replace(/`/g, "\\`")}\`${timeout ? `, ${timeout}` : ""});`;
      }
      return `await testdriver.exec("${language}", "${escapeString(code)}"${timeout ? `, ${timeout}` : ""});`;
    }

    case "wait": {
      const timeout = args.timeout as number;
      return `await testdriver.wait(${timeout});`;
    }

    case "focus_application": {
      const name = args.name as string;
      return `await testdriver.focusApplication("${escapeString(name)}");`;
    }

    default:
      return `// Unknown action: ${action}`;
  }
}
