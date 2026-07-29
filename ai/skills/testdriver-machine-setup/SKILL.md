---
name: testdriver:machine-setup
description: Configure Linux and Windows sandboxes, persist machines between runs, and install custom software
---
<!-- Generated from machine-setup.mdx. DO NOT EDIT. -->

TestDriver provisions a fresh cloud VM for every test by default. This guide covers how to configure Linux and Windows machines, reduce startup time by keeping machines alive between runs, use provision scripts for repeatable setup, and install custom software on the fly.

---

## Linux Machines

Linux is the default operating system. No extra configuration is required.

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

describe("My Test", () => {
  it("runs on Linux", async (context) => {
    const testdriver = TestDriver(context);

    await testdriver.provision.chrome({ url: "https://example.com" });

    const result = await testdriver.assert("the page loaded successfully");
    expect(result).toBeTruthy();
  });
});
```

### Common Linux Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `os` | string | `"linux"` | Operating system |
| `resolution` | string | `"1366x768"` | Screen resolution (Enterprise only) |
| `e2bTemplateId` | string | — | Custom E2B template ID (see [Self-Hosted](/v7/self-hosted)) |
| `keepAlive` | number | `60000` | Ms to keep VM alive after disconnect |
| `reconnect` | boolean | `false` | Reconnect to last used sandbox |

```javascript
const testdriver = TestDriver(context, {
  os: "linux",
  resolution: "1920x1080",
  keepAlive: 5 * 60 * 1000, // keep alive 5 minutes
});
```

---

## Windows Machines

Set `os: "windows"` to provision a Windows VM instead. Everything else works the same way.

```javascript
const testdriver = TestDriver(context, {
  os: "windows",
});

await testdriver.provision.chrome({ url: "https://example.com" });
```

Windows sandboxes use EC2 instances and take longer to boot than Linux (E2B) sandboxes — typically 1–3 minutes for a cold start. See [Keeping Machines Alive](#keeping-machines-alive-between-runs) below to avoid this cost on repeated runs.

### Common Windows Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `os` | string | — | Set to `"windows"` |
| `resolution` | string | `"1366x768"` | Screen resolution (Enterprise only) |
| `sandboxAmi` | string | — | Custom AMI ID (self-hosted) |
| `sandboxInstance` | string | — | EC2 instance type (self-hosted) |
| `keepAlive` | number | `60000` | Ms to keep VM alive after disconnect |
| `reconnect` | boolean | `false` | Reconnect to last used sandbox |

```javascript
const testdriver = TestDriver(context, {
  os: "windows",
  resolution: "1920x1080",
  keepAlive: 10 * 60 * 1000, // keep alive 10 minutes
});
```

---

## Keeping Machines Alive Between Runs

Windows (and Linux) cold starts can be expensive if you're iterating quickly. Use `keepAlive` + `reconnect` to reuse the same VM across multiple test runs.

### How it works

Every time the SDK successfully connects to a sandbox, it records the sandbox id in `.testdriver/last-sandbox` inside your project directory. The next test that opts in with `reconnect: true` reads that file and reattaches automatically — no manual id tracking required.

Provision calls (`testdriver.provision.chrome(...)`, `vscode(...)`, etc.) are **skipped** when reconnecting, because the application is already running inside the sandbox from the previous run.

<Note>
  `.testdriver/last-sandbox` is already covered by the default TestDriver `.gitignore`. Don't commit it.
</Note>

### Step 1 — Start the machine with a long `keepAlive`

```javascript
// first.test.mjs
const testdriver = TestDriver(context, {
  os: "windows",
  keepAlive: 30 * 60 * 1000, // keep alive 30 minutes after this test ends
});

await testdriver.provision.chrome({ url: "https://example.com" });
// ... your test steps
```

When this test finishes, the sandbox stays running for 30 minutes instead of being terminated immediately.

### Step 2 — Reattach automatically with `reconnect: true`

```javascript
// second.test.mjs
const testdriver = TestDriver(context, {
  os: "windows",
  reconnect: true,            // ← reads .testdriver/last-sandbox
  keepAlive: 30 * 60 * 1000,
});

// No provision call — Chrome is already open from the previous run.
await testdriver.find("Sign In button").click();
```

### Step 2 (alternative) — Reattach to an explicit id

If you need to pin to a specific sandbox (CI matrix, multiple chains in parallel, etc.) pass the id directly:

```javascript
await testdriver.connect({ sandboxId: "sandbox-abc123" });
```

When reattaching to a sandbox:
- You reuse a specific running machine directly
- You continue from the app state created in the earlier run
- You must run within the previous test's `keepAlive` window

<Tip>
  Use `testdriver.getLastSandboxId()` to read the recorded sandbox id (and optional metadata) for scripting purposes.
</Tip>

### Chaining describe blocks within one test file

A common pattern is to break a long flow into focused `describe` blocks that share one sandbox — the first block provisions and signs in, later blocks reconnect and continue:

```javascript
import { describe, expect, it } from "vitest";
import { TestDriver } from "testdriverai/vitest/hooks";

const KEEP_ALIVE_MS = 5 * 60 * 1000;

describe("step 1 — log in", () => {
  it("signs in and lands on the dashboard", async (context) => {
    const testdriver = TestDriver(context, { keepAlive: KEEP_ALIVE_MS });
    await testdriver.provision.chrome({ url: "https://example.com/login" });
    await testdriver.find("username input").click();
    await testdriver.type("standard_user");
    await testdriver.pressKeys(["tab"]);
    await testdriver.type("secret_sauce", { secret: true });
    await testdriver.pressKeys(["enter"]);
    expect(await testdriver.assert("the dashboard is visible")).toBeTruthy();
  });
});

describe("step 2 — add to cart", () => {
  it("reuses the logged-in sandbox", async (context) => {
    const testdriver = TestDriver(context, {
      reconnect: true,           // ← skip provisioning, reattach
      keepAlive: KEEP_ALIVE_MS,
    });
    await testdriver.find("Add to cart").click();
    await testdriver.find("cart icon").click();
    expect(await testdriver.assert("the cart has an item")).toBeTruthy();
  });
});

describe("step 3 — check out", () => {
  it("continues from the cart state", async (context) => {
    const testdriver = TestDriver(context, { reconnect: true, keepAlive: 30_000 });
    await testdriver.find("Checkout").click();
    expect(await testdriver.assert("the checkout form is visible")).toBeTruthy();
  });
});
```

A runnable copy of this pattern lives at [`examples/reconnect-sequential.test.mjs`](https://github.com/testdriverai/mono/blob/main/sdk/examples/reconnect-sequential.test.mjs).

<Warning>
  Vitest runs **test files** in parallel by default. Within a single file, `describe`/`it` blocks run in source order, so reconnect chaining works as written. To chain across multiple files, run them sequentially (e.g. `vitest run --sequence.concurrent=false` or place them in a single project pool with workers set to 1).
</Warning>

### How `keepAlive` works

`keepAlive` is a duration in milliseconds. After the SDK disconnects, the server keeps the VM running for that long before terminating it. The default is `60000` (1 minute). Note: `keepAlive: 0` currently falls back to the default disconnect grace period rather than terminating immediately, so use a positive duration when you want to control the grace window explicitly.

```javascript
const testdriver = TestDriver(context, {
  keepAlive: 0,           // currently uses the default 1 minute grace period
  // keepAlive: 60000,    // default — 1 minute
  // keepAlive: 600000,   // 10 minutes
  // keepAlive: 3600000,  // 1 hour
});
```

<Warning>
  Machines kept alive beyond your test session continue to consume credits. Always set a `keepAlive` value appropriate for your workflow.
</Warning>

---

## Using Provision Scripts

Provision scripts let you run arbitrary setup steps before your test starts — downloading fixtures, seeding a database, configuring environment variables, and more. Use `testdriver.exec()` to run shell or PowerShell commands directly in the sandbox.

<Card
  title="exec() Reference"
  icon="terminal"
  href="/v7/exec"
>
  Full reference for running shell and PowerShell commands in the sandbox.
</Card>

### Linux setup script

```javascript
await testdriver.provision.chrome({ url: "https://myapp.com" });

// Run a setup script from your repo
await testdriver.exec("sh", `
  curl -s https://myapp.com/api/reset-test-db -X POST
  echo "Test DB reset"
`, 30000);
```

### Windows setup script (PowerShell)

```javascript
await testdriver.provision.chrome({ url: "https://myapp.com" });

await testdriver.exec("pwsh", `
  $env:API_URL = "https://staging.myapp.com"
  Write-Host "Environment configured"
`, 15000);
```

### Clone a repo and run a script

```javascript
await testdriver.exec("sh", `
  git clone https://github.com/myorg/test-fixtures.git /tmp/fixtures
  bash /tmp/fixtures/seed.sh
`, 120000);
```

---

## Installing Custom Software

You can install software at the start of a test using `exec()`. This works for any package available via `apt`, `brew`, `choco`, `winget`, npm, pip, or direct download.

### Linux — apt packages

```javascript
await testdriver.exec("sh", `
  sudo apt-get update -qq
  sudo apt-get install -y ffmpeg imagemagick
`, 120000);
```

### Linux — Node.js tools

```javascript
await testdriver.exec("sh", "npm install -g @playwright/test", 60000);
```

### Windows — winget

```javascript
await testdriver.exec("pwsh", `
  winget install --id=7zip.7zip -e --silent
`, 120000);
```

### Windows — Chocolatey

```javascript
await testdriver.exec("pwsh", `
  choco install googlechrome --yes --no-progress
`, 180000);
```

### Download and run an installer

```javascript
// Linux
await testdriver.exec("sh", `
  curl -L https://example.com/installer.sh -o /tmp/installer.sh
  chmod +x /tmp/installer.sh
  /tmp/installer.sh --silent
`, 300000);

// Windows
await testdriver.exec("pwsh", `
  Invoke-WebRequest -Uri "https://example.com/installer.exe" -OutFile "$env:TEMP\\installer.exe"
  Start-Process "$env:TEMP\\installer.exe" -ArgumentList "/S" -Wait
`, 300000);
```

<Note>
  Installing software at test start adds to your test duration. For software you use in every test, consider preloading it into a custom VM image via the Enterprise self-hosted plan.
</Note>

---

## Want Software Pre-Installed on Every Machine?

Installing packages at runtime works well for occasional or lightweight dependencies. But if you're installing the same 5-minute setup on every test run, you're wasting time and credits.

With the **Self-Hosted Enterprise plan** you get access to our golden VM base image and Packer scripts, so you can bake your applications, dependencies, and configuration directly into a custom AMI. Tests spin up with everything already installed — zero setup time.

<Card
  title="Self-Hosted Enterprise"
  icon="server"
  href="/v7/self-hosted"
>
  Preload software, configure custom hardware, and run unlimited tests with a flat license fee. Our team assists with deployment and setup.
</Card>
