# TestDriver — E2B Sandbox Setup

Run TestDriver tests on E2B cloud sandboxes. This guide walks you through building a custom E2B template and launching sandboxes programmatically.

## Prerequisites

- [E2B account](https://e2b.dev) and API key
- [TestDriver API key](https://console.testdriver.ai/team)
- Node.js 18+
- E2B CLI: `npm install -g @e2b/cli`

## Quick Start

### 1. Set environment variables

```bash
export E2B_API_KEY=your-e2b-api-key
export TD_API_KEY=your-testdriver-api-key
```

### 2. Build the E2B template

```bash
cd setup/e2b
./build-template.sh
```

This builds a Linux desktop sandbox with:
- Ubuntu 22.04 + XFCE desktop
- Chrome / Chrome for Testing / Firefox
- noVNC (web-based VNC viewer on port 6080)
- `@testdriverai/runner` installed globally from local source (includes dashcam + dashcam-chrome)
- Auto-starts the runner via entrypoint

### 3. Launch a sandbox

```bash
./spawn-sandbox.sh
```

Or programmatically with the E2B SDK:

```javascript
import { Sandbox } from '@e2b/desktop';

const sandbox = await Sandbox.create('testdriver-v7', {
  timeoutMs: 300_000,
  resolution: [1366, 768],
});

console.log('Sandbox ID:', sandbox.sandboxId);
console.log('VNC URL:', `https://${sandbox.getHost(6080)}`);

// ... run tests via TestDriver SDK ...

await sandbox.kill();
```

## Template Structure

```
e2b/
├── README.md           ← You are here
├── Dockerfile          ← Linux desktop image (Ubuntu 22.04 + XFCE + Chrome + Node)
├── e2b.toml            ← E2B template config (CPU, RAM, team)
├── entrypoint.sh       ← Starts Xvfb + XFCE + VNC + noVNC + testdriver-runner
├── build-template.sh   ← Build the E2B template from Dockerfile
└── spawn-sandbox.sh    ← Launch a sandbox from the template
```

## How It Works

1. **Dockerfile** creates a Linux desktop environment with all the dependencies needed for visual testing (Xvfb, XFCE, Chrome, etc.)
2. `@testdriverai/runner` is copied into the image and installed globally via `npm install -g .` — this pulls in `dashcam` and `dashcam-chrome` automatically as dependencies
3. **entrypoint.sh** starts the X server, desktop, VNC, and the TestDriver runner
4. The runner registers with the TestDriver API using `TD_API_KEY` and enters Ably presence, waiting to be claimed by an SDK session
5. When a test runs via the SDK, the runner executes automation commands (click, type, screenshot, etc.) on the desktop

## Versioning

Since `@testdriverai/runner` is installed from the local `runner/` directory at build time, the version is whatever is in that directory. To update:

```bash
# Copy the latest runner source into runner/ and rebuild
./build-template.sh
```

## Customization

### Change resolution

Edit `spawn-sandbox.sh` or pass to the SDK:

```javascript
const sandbox = await Sandbox.create('testdriver-v7', {
  resolution: [1920, 1080],
});
```

### Change CPU / RAM

Edit `e2b.toml`:

```toml
memory_mb = 16384
cpu_count = 4
```

Then rebuild: `./build-template.sh`

### Use a custom runner version

Replace the contents of the `runner/` directory with your desired version, then rebuild:

```bash
./build-template.sh
```

### Self-hosted E2B

If you're running E2B self-hosted, set `E2B_API_URL` in addition to `E2B_API_KEY`:

```bash
export E2B_API_URL=https://your-e2b-instance.example.com
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `E2B_API_KEY` | Yes | Your E2B API key |
| `TD_API_KEY` | Yes | Your TestDriver API key (passed to sandbox) |
| `E2B_TEMPLATE_ID` | No | Template ID (default: auto-detected from `e2b.toml`) |
| `E2B_API_URL` | No | Custom E2B API URL (for self-hosted) |

## Related

- [AWS Setup](../aws/) — Run TestDriver on EC2 (Windows)
- [TestDriver Docs](https://docs.testdriver.ai)
- [E2B Docs](https://e2b.dev/docs)
