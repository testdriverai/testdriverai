# Contributing

## Setup `testdriverai` repo

1. `gh repo clone testdriverai/testdriverai`
1. `npm install` project dependencies
1. `npm link`

## Setting up a Test Project

1. `cd $(mktemp -d)` to create a blank project
1. `npm link testdriverai`
1. `npx testdriverai init`

   > Spawning GUI...
   > Howdy! I'm TestDriver v4.2.29
   > Working on **/private/var/folders/4w/\_l20wtfj41n2dx0xyhb8xd740000gn/T/tmp.PDxTlOLJBS/testdriver/testdriver.yml**
   > ...

1. `npx testdriverai testdriver/test.yml`

## Architecture Diagram

```mermaid
graph TD
    A[CLI Entry: npx testdriverai run test.yaml --heal --write] --> B[index.js]
    B --> C{Check Args}
    C -->|--renderer| D[Overlay Mode]
    C -->|Other| E[agent.js]

    E --> F[Parse Arguments]
    F --> G[Load Configuration]
    G --> H[Initialize SDK]
    H --> I[Load YAML File]

    I --> J{Command Type}
    J -->|run| K[Execute Commands]
    J -->|edit| L[Interactive Mode]
    J -->|init| M[Setup Project]

    K --> N[Parse YAML Commands]
    N --> O[Execute Each Command]
    O --> P[commands.js]

    P --> Q{Command Type}
    Q -->|hover-text| R[AI Vision API]
    Q -->|type| S[Keyboard Input]
    Q -->|click| T[Mouse Control]
    Q -->|assert| U[Validation]
    Q -->|exec| V[System Commands]

    R --> W[Capture Screen]
    W --> X[Send to Backend]
    X --> Y[Get Coordinates]
    Y --> Z[Execute Action]

    L --> AA[Read User Input]
    AA --> BB[Generate AI Response]
    BB --> CC[Parse Markdown]
    CC --> DD[Extract YAML]
    DD --> EE[Add to File]

    M --> FF[Create .env]
    FF --> GG[Setup GitHub Actions]
    GG --> HH[Download Workflows]

    subgraph "Key Files"
        II[index.js - Entry Point]
        JJ[agent.js - Main Logic]
        KK[lib/commands.js - Command Execution]
        LL[lib/parser.js - YAML Parsing]
        MM[lib/sdk.js - API Communication]
        NN[lib/config.js - Configuration]
        OO[lib/generator.js - YAML Generation]
    end
```

## Network Diagram

```mermaid
sequenceDiagram
    participant CLI as testdriverai CLI
    participant Config as Config Manager
    participant SDK as SDK Module
    participant API as TestDriver API
    participant Sandbox as VM Sandbox
    participant YAML as YAML File

    Note over CLI, YAML: Authentication Flow
    CLI->>Config: Load TD_API_KEY from .env
    Config->>SDK: Initialize with API key
    SDK->>API: POST /auth/exchange-api-key
    API->>SDK: Return Bearer Token
    SDK->>SDK: Store token for future requests

    Note over CLI, YAML: Session Management
    CLI->>SDK: Start new session
    SDK->>API: POST /api/v5/testdriver/session/start
    API->>SDK: Return session ID
    SDK->>YAML: Update session ID in file

    Note over CLI, YAML: Command Execution Flow
    CLI->>YAML: Load test commands
    YAML->>CLI: Return parsed YAML

    loop For each command
        CLI->>SDK: Execute command (e.g., hover-text)
        SDK->>CLI: Capture screen
        CLI->>SDK: Send screenshot + prompt
        SDK->>API: POST /api/v5/testdriver/hover/text
        API->>SDK: Return coordinates + confidence
        SDK->>CLI: Execute action (click, type, etc.)
    end

    Note over CLI, YAML: AI-Powered Command Generation
    CLI->>CLI: User enters natural language prompt
    CLI->>SDK: Send prompt + screenshot
    SDK->>API: POST /api/v5/testdriver/generate
    API->>SDK: Return markdown with YAML codeblocks
    SDK->>CLI: Parse markdown response
    CLI->>YAML: Extract and add new commands

    Note over CLI, YAML: Sandbox Mode (Optional)
    CLI->>Config: Check TD_VM setting
    Config->>Sandbox: Initialize WebSocket connection
    Sandbox->>API: WSS connection to api.testdriver.ai
    API->>Sandbox: Authenticate with API key
    Sandbox->>API: Create VM instance
    API->>Sandbox: Return VM URL
    Sandbox->>CLI: Stream VM display

    Note over CLI, YAML: File Operations
    CLI->>YAML: Save updated commands
    YAML->>CLI: Write to testdriver/test.yaml
    CLI->>CLI: Update version and session info

    Note over CLI, YAML: Error Handling & Healing
    CLI->>CLI: Command fails
    CLI->>SDK: Send error + context
    SDK->>API: POST error details
    API->>SDK: Return suggested fix
    SDK->>CLI: Apply auto-healing
    CLI->>YAML: Update commands if needed
```

## Testing against local `api`

When running [replayableio/api](https://github.com/replayableio/api/) locally, specify `TD_API_ROOT` in your `.env` file or shell:

```sh
TD_API_ROOT=http://localhost:1337 npx testdriverai
```

## Logging

- `DEV` to log the config
- `VERBOSE` to log `logger.debug` (Default: `logger.info` and above)

```sh
DEV=true VERBOSE=true npx testdriverai
```

## Debugging with Chrome Node Inspector

> https://nodejs.org/en/learn/getting-started/debugging

```sh
npx --node-options=--inspect testdriverai init
```

## Event Principles

- Events represent changes to the state of the system
- Execution is functional and should not be mutated by events
