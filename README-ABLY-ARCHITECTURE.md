# TestDriver Ably Architecture

> This document covers the new Ably-based communication architecture that replaces the previous WebSocket-based system. It spans the **API**, **Runner**, and **SDK** repos.

## Table of Contents

- [Overview](#overview)
- [Architecture Diagram](#architecture-diagram)
- [Components](#components)
  - [API (testdriverai/api)](#api-testdriveraiapi)
  - [Runner (testdriverai/runner)](#runner-testdriverairunner)
  - [SDK (testdriverai/testdriverai)](#sdk-testdriveraitestdriverai)
- [Channel Model](#channel-model)
- [Flows](#flows)
  - [Cloud Sandbox (Linux / E2B)](#cloud-sandbox-linux--e2b)
  - [Cloud Sandbox (Windows / EC2)](#cloud-sandbox-windows--ec2)
  - [Presence Runner (Self-Hosted)](#presence-runner-self-hosted)
  - [Direct IP Connection](#direct-ip-connection)
- [Runner Claiming (Atomic with Redis)](#runner-claiming-atomic-with-redis)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Deployment (Render)](#deployment-render)
- [Key Differences from WebSocket Architecture](#key-differences-from-websocket-architecture)

---

## Overview

The previous architecture used raw WebSocket connections between the SDK, API, and sandbox agents. This created several problems:

- **Fragile connections** — WebSocket reconnection was unreliable, especially through proxies and load balancers.
- **No presence** — No way to discover available runners or detect runner failures.
- **Race conditions** — Multiple parallel tests could try to claim the same runner simultaneously.
- **Message size limits** — Large screenshots were sent inline over WebSockets.

The new architecture replaces WebSockets with **Ably** (a managed real-time messaging service) and adds:

- **Ably Realtime** for all SDK ↔ Runner communication (pub/sub with automatic reconnection).
- **Ably Presence** for runner discovery and availability tracking.
- **Redis SETNX** for atomic runner claiming (prevents race conditions in parallel tests).
- **S3 presigned URLs** for screenshot upload (bypasses Ably's 64KB message limit).
- **HTTP-only API** — the SDK authenticates via a single `POST /api/v7/sandbox/authenticate` call and gets back Ably tokens. No persistent WebSocket to the API.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        Ably Cloud                            │
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────────┐ │
│  │ Runner Channel    │    │ Session Channels (per sandbox)  │ │
│  │ testdriver:{team} │    │ testdriver:{team}:{sandbox}:    │ │
│  │   :runners        │    │   :commands                     │ │
│  │                   │    │   :responses                    │ │
│  │ (presence + claim │    │   :control                      │ │
│  │  messages)        │    │   :files                        │ │
│  └──────────────────┘    └─────────────────────────────────┘ │
└────────┬───────────────────────────┬────────────────────────┘
         │                           │
    ┌────┴────┐              ┌───────┴──────┐
    │ Runners │              │  SDK Client  │
    │ (enter  │              │  (publish    │
    │ presence│              │   commands,  │
    │ & listen│              │   subscribe  │
    │ for     │              │   responses) │
    │ claims) │              └───────┬──────┘
    └────┬────┘                      │
         │                           │
         │    ┌───────────┐          │
         └────│ API       │──────────┘
              │ (HTTP     │
              │  auth,    │
              │  token    │
              │  issuer,  │  ┌─────────┐
              │  runner   ├──│ Redis   │  (atomic claims)
              │  claim)   │  └─────────┘
              └───────────┘
```

---

## Components

### API (`testdriverai/api`)

**Branch:** `ian/ably`

The API is a Sails.js application. Key new files:

| File | Purpose |
|------|---------|
| `api/services/ably/index.js` | Core Ably service — token provisioning, channel naming, session management, runner presence queries |
| `api/services/runner-claim.js` | Atomic runner claiming via Redis `SETNX` |
| `api/services/sandboxes/lib/ably-service.js` | `AblySession` class for per-sandbox Ably connections (used by E2B Linux handler) |
| `api/controllers/testdriver-agent/sandbox-authenticate.js` | **Main endpoint** — authenticates, creates sandboxes, claims presence runners, returns Ably tokens |
| `api/controllers/testdriver-agent/runner-register.js` | Runner registration — issues Ably presence tokens |
| `api/controllers/testdriver-agent/runner-claim.js` | Explicit runner claiming endpoint |
| `api/controllers/testdriver-agent/runner-release.js` | Release a runner claim |
| `api/controllers/testdriver-agent/runner-keepalive.js` | Extend claim TTL |
| `api/controllers/testdriver-agent/runner-upload-url.js` | Generate S3 presigned URLs for screenshot uploads |
| `api/controllers/testdriver-agent/runner-list.js` | List runners with claim status |
| `render.yaml` | Render Blueprint for deployment (API, Redis, web console, image worker) |

**What the API does now:**

1. **Authenticates** SDK requests via API key.
2. **Issues scoped Ably tokens** — SDK tokens can only publish to `commands` and subscribe to `responses`; agent tokens have the inverse permissions.
3. **Manages runner lifecycle** — for Linux (E2B), the API subscribes to the commands channel and forwards commands to the E2B Desktop SDK. For Windows/presence runners, the agents handle commands directly.
4. **Atomic claiming** — uses Redis `SETNX` with TTL to prevent race conditions when multiple tests request runners simultaneously.
5. **S3 upload URLs** — provides presigned URLs so runners can upload screenshots to S3 instead of sending large base64 payloads over Ably.

### Runner (`testdriverai/runner`)

**Branch:** `main` (changes in diff)

The runner replaces the old PyAutoGUI/WebSocket-based agent. Key new files:

| File | Purpose |
|------|---------|
| `presence-runner.js` | **Main entry point for self-hosted runners** — registers with API, enters Ably presence, waits for claims, handles sessions |
| `sandbox-agent.js` | **Sandbox agent** — runs on provisioned EC2/sandbox instances, reads Ably credentials from config file |
| `lib/automation.js` | Cross-platform desktop automation — replaces `pyautogui-cli.py` with `@nut-tree-fork/nut-js` |
| `lib/automation-bridge.js` | In-process bridge between Ably service and Automation module |
| `lib/ably-service.js` | Ably-based command listener — subscribes to commands channel, dispatches to Automation, publishes responses |

**Key changes from the old runner:**

- **No more Python** — automation is now pure Node.js using `@nut-tree-fork/nut-js` for mouse/keyboard/screenshot operations.
- **No more WebSocket server** — the runner connects to Ably as a client (subscriber).
- **S3 screenshot upload** — screenshots that exceed Ably's 64KB limit are uploaded to S3 via presigned URLs, and only the S3 key is sent over Ably.
- **Two modes of operation:**
  - **Presence Runner** (`presence-runner.js`) — long-running process that registers availability and can be claimed/released by multiple sessions.
  - **Sandbox Agent** (`sandbox-agent.js`) — ephemeral process provisioned on cloud instances (EC2/E2B), reads credentials from a JSON config file.

### SDK (`testdriverai/testdriverai`)

**Branch:** `main` (changes in diff)

Key changes in the SDK:

| File | Change |
|------|--------|
| `agent/lib/sandbox.js` | Replaced WebSocket connections with Ably Realtime. SDK now connects to 4 Ably channels (commands, responses, control, files). Added `end-session` control message on close. Unwraps result from Ably response envelope. |
| `agent/index.js` | Simplified sandbox creation flow — no longer makes a second API call after `create`. Uses sandbox data directly from the authenticate response. |
| `sdk.js` | Made `sandbox.close()` async to properly send end-session message before disconnecting. |

---

## Channel Model

Every session uses 4 Ably channels scoped to the team and sandbox:

```
testdriver:{teamId}:{sandboxId}:commands    — SDK → Agent (commands)
testdriver:{teamId}:{sandboxId}:responses   — Agent → SDK (command results)
testdriver:{teamId}:{sandboxId}:control     — Bidirectional (keepalive, disconnect, status)
testdriver:{teamId}:{sandboxId}:files       — Agent → SDK (screenshot/file references)
```

Additionally, each team has a runner presence channel:

```
testdriver:{teamId}:runners                 — Runner presence + claim messages
```

### Token Scoping

Tokens are scoped to specific channels with specific permissions:

| Token Type | `commands` | `responses` | `control` | `files` |
|------------|-----------|-------------|-----------|---------|
| SDK Token  | publish   | subscribe   | pub + sub | subscribe |
| Agent Token| subscribe | publish     | pub + sub | publish   |
| Runner Token| — | — | — | — |

Runner tokens have wildcard access to `testdriver:{teamId}:*` plus presence on the runners channel.

---

## Flows

### Cloud Sandbox (Linux / E2B)

```
SDK                          API                           E2B Desktop
 │                            │                               │
 │ POST /sandbox/authenticate │                               │
 │ { apiKey, os: "linux" }    │                               │
 │──────────────────────────>│                               │
 │                            │── Check presence runners ──>│  (none available)
 │                            │── Create E2B Sandbox ──────>│
 │                            │<── Sandbox ready ───────────│
 │                            │── Subscribe to commands ────│
 │                            │                               │
 │<── { ablyToken, channels } │                               │
 │                            │                               │
 │── Ably: publish command ──>│── Forward to E2B ──────────>│
 │                            │<── Result ──────────────────│
 │<── Ably: response ─────────│                               │
```

For Linux sandboxes, the **API acts as the command processor** — it subscribes to the Ably commands channel and translates SDK commands into E2B Desktop SDK calls.

### Cloud Sandbox (Windows / EC2)

```
SDK                     API                    EC2 Instance
 │                       │                         │
 │ POST /sandbox/auth    │                         │
 │ { apiKey, os: "win" } │                         │
 │─────────────────────>│                         │
 │                       │── Create/claim EC2 ───>│
 │                       │── SSM: write config ──>│
 │                       │    (Ably credentials)   │
 │                       │                         │── sandbox-agent.js starts
 │                       │                         │── Connects to Ably
 │<── { ablyToken }      │                         │
 │                       │                         │
 │── Ably: command ──────────────────────────────>│  (direct, API not in path)
 │<── Ably: response ────────────────────────────│
```

For Windows, the **sandbox agent handles commands directly** — the API only provisions credentials and monitors control messages.

### Presence Runner (Self-Hosted)

```
Runner                       API                           SDK
 │                            │                              │
 │ POST /runner/register      │                              │
 │ { apiKey }                 │                              │
 │──────────────────────────>│                              │
 │<── { ablyToken, channel }  │                              │
 │                            │                              │
 │── Ably: enter presence ───│                              │
 │   { status: "available" } │                              │
 │                            │                              │
 │                            │ POST /sandbox/authenticate   │
 │                            │<─────────────────────────────│
 │                            │                              │
 │                            │── Query presence ──────────>│
 │                            │── Redis SETNX (claim) ──── │
 │                            │── Ably: publish "claim" ──>│
 │                            │                              │
 │<── Ably: "claim" message   │<── { ablyToken, runner } ───│
 │                            │                              │
 │── Update presence: "busy"  │                              │
 │── Connect to session ──────────────────────────────────>│
 │                            │                              │
 │── Ably: (commands/responses direct between runner & SDK) │
 │                            │                              │
 │ (session ends)             │                              │
 │── Update presence: "avail" │                              │
```

The presence runner is the **preferred flow for self-hosted deployments**. When the SDK authenticates, the API first checks for available presence runners before falling back to cloud sandbox creation.

### Direct IP Connection

```
SDK                          API
 │                            │
 │ POST /sandbox/authenticate │
 │ { apiKey, ip: "1.2.3.4" } │
 │──────────────────────────>│
 │<── { ablyToken, agentToken, channels }
 │
 │ (user must start sandbox-agent.js on 1.2.3.4 with agentToken)
 │
 │── Ably: commands ───────────────> sandbox-agent on remote host
 │<── Ably: responses ──────────────
```

---

## Runner Claiming (Atomic with Redis)

When multiple parallel tests request a runner simultaneously, Redis prevents race conditions:

```
Test A                Redis                 Test B
  │                     │                     │
  │── SETNX runner:r1 ─>│                     │
  │<── OK (claimed!) ───│                     │
  │                     │<── SETNX runner:r1 ──│
  │                     │── nil (already set) ─>│
  │                     │                     │── Try next runner
```

**Key structure:** `runner:claim:{teamId}:{runnerId}` → `sandboxId`

- **TTL:** 300 seconds (5 minutes) — auto-releases if the session doesn't start.
- **Keepalive:** SDK calls `POST /runner/keepalive` periodically to extend the TTL.
- **Release:** SDK calls `POST /runner/release` when the session ends. Uses a Lua script for atomic check-and-delete (only the owning session can release).

If Redis is unavailable (local dev), claiming falls through without atomic guarantees.

---

## API Endpoints

### Authentication & Sandbox Creation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v7/sandbox/authenticate` | **Main endpoint.** Authenticates, creates/connects sandbox, returns Ably tokens. Automatically tries presence runners before cloud fallback. |

**Request body:**
```json
{
  "apiKey": "your-api-key",
  "os": "linux",
  "resolution": [1366, 768],
  "ip": "1.2.3.4",
  "sandboxId": "existing-sandbox-id",
  "keepAlive": 30000
}
```

**Response (cloud with presence runner):**
```json
{
  "success": true,
  "sandboxId": "sb-abc123",
  "teamId": "team-id",
  "traceId": "trace-hash",
  "ably": {
    "token": { "...ably token details..." },
    "channels": {
      "commands": "testdriver:team:sb-abc123:commands",
      "responses": "testdriver:team:sb-abc123:responses",
      "control": "testdriver:team:sb-abc123:control",
      "files": "testdriver:team:sb-abc123:files"
    }
  },
  "runner": {
    "runnerId": "r-xyz",
    "ip": "10.0.0.5",
    "os": "linux",
    "type": "presence"
  }
}
```

### Runner Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v7/runner/register` | Register a runner and get Ably presence token |
| `POST` | `/api/v7/runner/claim` | Atomically claim an available runner |
| `POST` | `/api/v7/runner/release` | Release a runner claim |
| `POST` | `/api/v7/runner/keepalive` | Extend a claim's TTL |
| `POST` | `/api/v7/runner/upload-url` | Get S3 presigned URL for screenshot upload |
| `GET`  | `/api/v7/runners` | List runners with claim status |

---

## Environment Variables

### API

| Variable | Required | Description |
|----------|----------|-------------|
| `ABLY_API_KEY` | Yes | Ably root API key (`appId.keyId:keySecret`) |
| `REDIS_URL` | No* | Redis connection string for atomic claiming (*graceful fallback without it) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `E2B_API_KEY` | No | E2B API key for Linux sandboxes |
| `AWS_REGION` | No | AWS region for EC2/S3 operations |
| `AWS_BUCKET_IMAGE_TRANSFER` | No | S3 bucket for screenshot uploads (default: `v7-transfer`) |

### Runner (presence-runner.js)

| Variable | Required | Description |
|----------|----------|-------------|
| `TD_API_KEY` | Yes | Team API key |
| `TD_API_ROOT` | No | API URL (default: `https://api.testdriver.ai`) |
| `TD_RUNNER_ID` | No | Custom runner ID (auto-generated if not set) |
| `TD_RUNNER_OS` | No | OS capability override (default: auto-detected) |
| `TD_RUNNER_SINGLE` | No | Exit after one session (`true`/`false`) |

### Runner (sandbox-agent.js)

| Variable | Required | Description |
|----------|----------|-------------|
| `SANDBOX_ID` | No | Sandbox ID (can come from config file) |
| `ABLY_TOKEN` | No | JSON-stringified Ably token (can come from config file) |
| `ABLY_CHANNELS` | No | JSON-stringified channel names (can come from config file) |
| `CONFIG_PATH` | No | Path to config file (default: `/tmp/testdriver-agent.json` or `C:\Windows\Temp\testdriver-agent.json`) |

### SDK

| Variable | Required | Description |
|----------|----------|-------------|
| `TD_API_KEY` | Yes | Team API key |
| `TD_API_ROOT` | No | API URL (default: `https://api.testdriver.ai`) |
| `TD_OS` | No | Target OS (`linux`/`windows`) |
| `TD_IP` | No | Direct IP connection |

---

## Local Development

### Prerequisites

- Node.js 18+
- Redis (for atomic claiming; optional for basic dev)
- MongoDB
- An Ably account with an API key

### 1. Start the API

```bash
cd api

# Set up .env
echo 'ABLY_API_KEY=your-ably-key' >> .env
echo 'REDIS_URL=redis://localhost:6379' >> .env
# ... other env vars (MongoDB, etc.)

sh dev.sh
# API starts on http://localhost:1337
```

### 2. Start a Presence Runner

```bash
cd testdriver-runner

# Set up .env
echo 'TD_API_KEY=your-team-api-key' >> .env
echo 'TD_API_ROOT=http://localhost:1337' >> .env

node presence-runner.js
# Runner registers and enters presence
```

### 3. Run a Test

```bash
cd testdriverai

TD_API_KEY=your-team-api-key \
TD_API_ROOT=http://localhost:1337 \
npx vitest run examples/hover-image.test.mjs --reporter=dot
```

### Local Test Scripts

The runner repo includes test scripts for verifying the Ably flow:

```bash
# Test the sandbox-agent flow (API provisions credentials, agent connects)
TD_API_KEY=your-key API_ROOT=http://localhost:1337 \
  node test/local-test.mjs

# Test the presence-runner flow (register → claim → command → release)
TD_API_KEY=your-key API_ROOT=http://localhost:1337 \
  node test/local-presence-test.mjs
```

---

## Deployment (Render)

The `render.yaml` Blueprint defines the full production stack:

| Service | Type | Description |
|---------|------|-------------|
| `testdriver-api` | Web | Sails.js API server |
| `testdriver-image-worker` | Worker | Background image processing |
| `testdriver-web` | Static | Vue/Vite web console |
| `testdriver-redis` | Redis | Atomic runner claiming + caching |

Deploy with:

```
https://dashboard.render.com/select-repo?type=blueprint
```

Key environment variables that must be set manually (marked `sync: false` in the Blueprint): `MONGODB_URI`, `ABLY_API_KEY`, `AUTH0_*`, `AWS_*`, `STRIPE_*`, `E2B_API_KEY`.

---

## Key Differences from WebSocket Architecture

| Aspect | Old (WebSocket) | New (Ably) |
|--------|-----------------|------------|
| **Transport** | Raw WebSocket (SDK → API → Agent) | Ably pub/sub (SDK ↔ Agent via Ably cloud) |
| **API role** | Persistent WebSocket proxy | HTTP-only auth + token issuer (except Linux/E2B where it proxies commands) |
| **Runner discovery** | None (direct IP required) | Ably presence channel per team |
| **Runner claiming** | First-come-first-served | Atomic with Redis `SETNX` |
| **Reconnection** | Manual, unreliable | Automatic (Ably handles it) |
| **Screenshots** | Base64 over WebSocket | Small: base64 over Ably. Large: S3 presigned URL upload |
| **Automation engine** | Python (PyAutoGUI) | Node.js (`@nut-tree-fork/nut-js`) |
| **Message size limit** | ~Unlimited | 64KB per Ably message (mitigated by S3 upload) |
| **Session lifecycle** | WebSocket open/close | Control channel messages (`keepalive`, `end-session`) |
| **Concurrency safety** | Race conditions possible | Redis-backed atomic claiming |
