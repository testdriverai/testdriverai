import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import WebSocket from 'ws';

// Store the active debugger panel
let debuggerPanel: vscode.WebviewPanel | undefined;
let fileWatcher: fs.FSWatcher | undefined;
let websocketConnection: WebSocket | undefined;

// Path to the TestDriver session file (used for IPC between SDK and extension)
const SESSION_DIR = path.join(os.homedir(), '.testdriver');
const SESSION_FILE = path.join(SESSION_DIR, 'ide-session.json');

interface SessionData {
  debuggerUrl: string;
  resolution: [number, number];
  testFile?: string;
  os?: string;
  timestamp: number;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('TestDriver.ai extension is now active');

  // Ensure session directory exists
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  // Register commands
  const openDebuggerCommand = vscode.commands.registerCommand(
    'testdriverai.openDebugger',
    () => openDebuggerPanel(context)
  );

  const closeDebuggerCommand = vscode.commands.registerCommand(
    'testdriverai.closeDebugger',
    () => closeDebuggerPanel()
  );

  const installMcpCommand = vscode.commands.registerCommand(
    'testdriverai.installMcp',
    () => installMcpServer()
  );

  context.subscriptions.push(openDebuggerCommand, closeDebuggerCommand, installMcpCommand);

  // Start watching for session file changes
  startSessionWatcher(context);

  // Auto-install MCP on first activation
  autoInstallMcp();

  // Check if there's an existing session file
  checkExistingSession(context);
}

function startSessionWatcher(context: vscode.ExtensionContext) {
  // Clean up existing watcher
  if (fileWatcher) {
    fileWatcher.close();
  }

  // Watch the session directory for changes
  try {
    fileWatcher = fs.watch(SESSION_DIR, (eventType, filename) => {
      if (filename === 'ide-session.json' && eventType === 'change') {
        checkExistingSession(context);
      }
    });
  } catch (error) {
    // Directory might not exist yet, create it and try again
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      startSessionWatcher(context);
    }
  }
}

function checkExistingSession(context: vscode.ExtensionContext) {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const content = fs.readFileSync(SESSION_FILE, 'utf-8');
      const sessionData: SessionData = JSON.parse(content);

      // Check if session is recent (within last 30 seconds)
      const isRecent = Date.now() - sessionData.timestamp < 30000;

      if (isRecent && sessionData.debuggerUrl) {
        const config = vscode.workspace.getConfiguration('testdriverai');
        const autoOpen = config.get<boolean>('autoOpenPreview', true);

        if (autoOpen) {
          openDebuggerPanel(context, sessionData);
        }
      }
    }
  } catch (error) {
    console.error('Error reading session file:', error);
  }
}

function openDebuggerPanel(context: vscode.ExtensionContext, sessionData?: SessionData) {
  // If panel already exists, reveal it
  if (debuggerPanel) {
    debuggerPanel.reveal(vscode.ViewColumn.Beside);

    // Update content if we have new session data
    if (sessionData) {
      updateDebuggerContent(debuggerPanel, sessionData, context);
    }
    return;
  }

  // Create a new webview panel
  debuggerPanel = vscode.window.createWebviewPanel(
    'testdriverDebugger',
    'TestDriver Live Preview',
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'media')),
        vscode.Uri.file(path.join(__dirname, '..', '..', 'debugger'))
      ]
    }
  );

  // Set the webview icon
  debuggerPanel.iconPath = {
    light: vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.png')),
    dark: vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.png'))
  };

  // Handle panel disposal
  debuggerPanel.onDidDispose(() => {
    debuggerPanel = undefined;
    disconnectWebSocket();
  }, null, context.subscriptions);

  // Update content
  if (sessionData) {
    updateDebuggerContent(debuggerPanel, sessionData, context);
  } else {
    // Show waiting state
    debuggerPanel.webview.html = getWaitingHtml();
  }
}

function updateDebuggerContent(panel: vscode.WebviewPanel, sessionData: SessionData, context: vscode.ExtensionContext) {
  // Connect to the WebSocket server for live updates
  connectToWebSocket(sessionData.debuggerUrl, panel);

  // Build the data parameter for the debugger
  const data = {
    resolution: sessionData.resolution,
    url: extractVncUrl(sessionData.debuggerUrl),
    token: 'V3b8wG9',
    testFile: sessionData.testFile || null,
    os: sessionData.os || 'linux'
  };

  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64');
  
  // Update the webview content with the debugger
  panel.webview.html = getDebuggerHtml(sessionData.debuggerUrl, encodedData, panel.webview, context);
}

function extractVncUrl(debuggerUrl: string): string {
  try {
    const url = new URL(debuggerUrl);
    const dataParam = url.searchParams.get('data');
    if (dataParam) {
      const data = JSON.parse(Buffer.from(dataParam, 'base64').toString());
      return data.url || '';
    }
  } catch (error) {
    console.error('Error extracting VNC URL:', error);
  }
  return '';
}

function connectToWebSocket(debuggerUrl: string, panel: vscode.WebviewPanel) {
  // Disconnect existing connection
  disconnectWebSocket();

  try {
    const url = new URL(debuggerUrl);
    const wsUrl = `ws://${url.host}`;

    websocketConnection = new WebSocket(wsUrl);

    websocketConnection.on('open', () => {
      console.log('Connected to TestDriver debugger WebSocket');
    });

    websocketConnection.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        // Forward events to the webview
        panel.webview.postMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    websocketConnection.on('close', () => {
      console.log('WebSocket connection closed');
    });

    websocketConnection.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
    });
  } catch (error) {
    console.error('Error connecting to WebSocket:', error);
  }
}

function disconnectWebSocket() {
  if (websocketConnection) {
    websocketConnection.close();
    websocketConnection = undefined;
  }
}

function closeDebuggerPanel() {
  if (debuggerPanel) {
    debuggerPanel.dispose();
    debuggerPanel = undefined;
  }
  disconnectWebSocket();
}

function getWaitingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestDriver Live Preview</title>
  <style>
    body {
      background-color: #1e1e1e;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
    .logo {
      width: 120px;
      height: 120px;
      margin-bottom: 24px;
      animation: pulse 2s ease-in-out infinite;
    }
    h1 {
      font-size: 24px;
      font-weight: 500;
      margin-bottom: 16px;
    }
    p {
      font-size: 14px;
      color: #888;
      max-width: 400px;
      line-height: 1.6;
    }
    code {
      background: #2d2d2d;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.5; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.05); }
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #b0cf34;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 24px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <h1>Waiting for TestDriver...</h1>
  <p>
    Run a test with <code>preview: "ide"</code> to see the live execution here.
  </p>
  <p style="margin-top: 16px;">
    <code>const testdriver = TestDriver(context, { preview: "ide" });</code>
  </p>
</body>
</html>`;
}

function getDebuggerHtml(debuggerUrl: string, encodedData: string, webview: vscode.Webview, context: vscode.ExtensionContext): string {
  // We'll embed the debugger in an iframe pointing to the local server
  // The debugger server must be running for this to work
  const fullUrl = `${debuggerUrl}?data=${encodedData}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* https://localhost:*; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>TestDriver Live Preview</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #1e1e1e;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
    }
    .error {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #cccccc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
      padding: 20px;
    }
    .error.visible {
      display: flex;
    }
    .error h2 {
      color: #f44336;
      margin-bottom: 16px;
    }
    .error p {
      color: #888;
      max-width: 400px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <iframe 
    id="debugger-frame" 
    src="${fullUrl}"
    sandbox="allow-scripts allow-same-origin"
  ></iframe>
  <div class="error" id="error-message">
    <h2>Connection Lost</h2>
    <p>The TestDriver debugger server is no longer running. Start a new test to reconnect.</p>
  </div>
  <script>
    const iframe = document.getElementById('debugger-frame');
    const errorDiv = document.getElementById('error-message');
    
    iframe.onerror = function() {
      iframe.style.display = 'none';
      errorDiv.classList.add('visible');
    };

    // Listen for messages from the extension
    window.addEventListener('message', event => {
      const message = event.data;
      // Forward WebSocket events to the iframe if needed
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(message, '*');
      }
    });
  </script>
</body>
</html>`;
}

async function installMcpServer() {
  // Get the workspace folder
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    vscode.window.showWarningMessage('Please open a folder before installing TestDriver MCP.');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // Check for various MCP config locations
  const mcpConfigPaths = [
    path.join(workspaceRoot, '.vscode', 'mcp.json'),
    path.join(workspaceRoot, '.cursor', 'mcp.json'),
    path.join(os.homedir(), '.vscode', 'mcp.json'),
    path.join(os.homedir(), '.cursor', 'mcp.json')
  ];

  // Try to find existing config or create in workspace
  let configPath = mcpConfigPaths.find(p => fs.existsSync(p));

  if (!configPath) {
    // Ask user where to install
    const choice = await vscode.window.showQuickPick(
      [
        { label: 'Workspace (.vscode/mcp.json)', value: mcpConfigPaths[0] },
        { label: 'Workspace (.cursor/mcp.json)', value: mcpConfigPaths[1] },
        { label: 'Global (~/.vscode/mcp.json)', value: mcpConfigPaths[2] },
        { label: 'Global (~/.cursor/mcp.json)', value: mcpConfigPaths[3] }
      ],
      { placeHolder: 'Where would you like to install the TestDriver MCP server?' }
    );

    if (!choice) {
      return;
    }

    configPath = choice.value;
  }

  // Ensure directory exists
  const configDir = path.dirname(configPath);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Read existing config or create new
  let config: { mcpServers?: Record<string, unknown> } = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
      vscode.window.showErrorMessage(`Error reading MCP config: ${error}`);
      return;
    }
  }

  // Initialize mcpServers if not present
  if (!config.mcpServers) {
    config.mcpServers = {};
  }

  // Check if TestDriver MCP is already configured
  if (config.mcpServers['testdriver']) {
    const overwrite = await vscode.window.showWarningMessage(
      'TestDriver MCP is already configured. Overwrite?',
      'Yes',
      'No'
    );
    if (overwrite !== 'Yes') {
      return;
    }
  }

  // Add TestDriver MCP configuration
  // Set TD_PREVIEW=ide so the live preview opens in IDE panel (VSCode, Cursor, etc.)
  config.mcpServers['testdriver'] = {
    command: 'npx',
    args: ['-y', 'testdriverai', 'mcp'],
    env: {
      TD_API_KEY: '${env:TD_API_KEY}',
      TD_PREVIEW: 'ide'
    }
  };

  // Write config
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    vscode.window.showInformationMessage(
      `TestDriver MCP installed successfully at ${configPath}. Don't forget to set your TD_API_KEY environment variable.`
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Error writing MCP config: ${error}`);
  }
}

async function autoInstallMcp() {
  // Check if MCP is already configured in common locations
  const mcpConfigPaths = [
    path.join(os.homedir(), '.vscode', 'mcp.json'),
    path.join(os.homedir(), '.cursor', 'mcp.json')
  ];

  // Check workspace configs if available
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    mcpConfigPaths.unshift(
      path.join(workspaceFolders[0].uri.fsPath, '.vscode', 'mcp.json'),
      path.join(workspaceFolders[0].uri.fsPath, '.cursor', 'mcp.json')
    );
  }

  // Check if TestDriver MCP is already configured
  for (const configPath of mcpConfigPaths) {
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (config.mcpServers?.['testdriver']) {
          // Already configured
          return;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  // Prompt user to install MCP
  const install = await vscode.window.showInformationMessage(
    'Would you like to install the TestDriver MCP server for AI-assisted test creation?',
    'Install',
    'Not Now',
    'Never'
  );

  if (install === 'Install') {
    await installMcpServer();
  } else if (install === 'Never') {
    // Store preference to not ask again
    const config = vscode.workspace.getConfiguration('testdriverai');
    await config.update('mcpPromptDismissed', true, vscode.ConfigurationTarget.Global);
  }
}

export function deactivate() {
  closeDebuggerPanel();
  if (fileWatcher) {
    fileWatcher.close();
  }
  
  // Clean up session file
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch {
    // Ignore cleanup errors
  }
}
