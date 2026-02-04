import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import WebSocket from 'ws';

// Store active debugger panels by session ID
const debuggerPanels: Map<string, vscode.WebviewPanel> = new Map();
const websocketConnections: Map<string, WebSocket> = new Map();
let fileWatcher: fs.FSWatcher | undefined;
let processedSessions: Set<string> = new Set(); // Track sessions we've already opened

// Path to the TestDriver sessions directory (used for IPC between SDK and extension)
const SESSION_DIR = path.join(os.homedir(), '.testdriver');
const SESSIONS_DIR = path.join(SESSION_DIR, 'ide-sessions');
// Legacy single session file for backward compatibility
const SESSION_FILE = path.join(SESSION_DIR, 'ide-session.json');

interface SessionData {
  sessionId?: string;  // Unique identifier for this test session
  debuggerUrl: string;
  resolution: [number, number];
  testFile?: string;
  os?: string;
  timestamp: number;
}

export function activate(context: vscode.ExtensionContext) {
  console.log('TestDriver.ai extension is now active');

  // Ensure session directories exist
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }

  // Register commands
  const openDebuggerCommand = vscode.commands.registerCommand(
    'testdriverai.openDebugger',
    () => openDebuggerPanel(context)
  );

  const closeDebuggerCommand = vscode.commands.registerCommand(
    'testdriverai.closeDebugger',
    () => closeAllDebuggerPanels()
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

  // Check for existing sessions
  checkExistingSessions(context);
}

let sessionsWatcher: fs.FSWatcher | undefined;

function startSessionWatcher(context: vscode.ExtensionContext) {
  // Clean up existing watchers
  if (fileWatcher) {
    fileWatcher.close();
  }
  if (sessionsWatcher) {
    sessionsWatcher.close();
  }

  // Watch the legacy session file for backward compatibility
  try {
    fileWatcher = fs.watch(SESSION_DIR, (eventType, filename) => {
      if (filename === 'ide-session.json' && eventType === 'change') {
        checkLegacySession(context);
      }
    });
  } catch (error) {
    // Directory might not exist yet, create it and try again
    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
      startSessionWatcher(context);
      return;
    }
  }

  // Watch the sessions directory for new session files (one per parallel test)
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    sessionsWatcher = fs.watch(SESSIONS_DIR, (eventType, filename) => {
      if (filename && filename.endsWith('.json')) {
        checkSessionFile(context, path.join(SESSIONS_DIR, filename));
      }
    });
  } catch (error) {
    console.error('Error watching sessions directory:', error);
  }
}

function checkExistingSessions(context: vscode.ExtensionContext) {
  // Check legacy session file
  checkLegacySession(context);
  
  // Check all session files in the sessions directory
  try {
    if (fs.existsSync(SESSIONS_DIR)) {
      const files = fs.readdirSync(SESSIONS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          checkSessionFile(context, path.join(SESSIONS_DIR, file));
        }
      }
    }
  } catch (error) {
    console.error('Error reading sessions directory:', error);
  }
}

function checkLegacySession(context: vscode.ExtensionContext) {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const content = fs.readFileSync(SESSION_FILE, 'utf-8');
      const sessionData: SessionData = JSON.parse(content);

      // Check if session is recent (within last 30 seconds)
      const isRecent = Date.now() - sessionData.timestamp < 30000;

      if (isRecent && sessionData.debuggerUrl) {
        // Generate a session ID if not present (for legacy support)
        if (!sessionData.sessionId) {
          sessionData.sessionId = `legacy-${sessionData.timestamp}`;
        }
        
        const config = vscode.workspace.getConfiguration('testdriverai');
        const autoOpen = config.get<boolean>('autoOpenPreview', true);

        if (autoOpen && !processedSessions.has(sessionData.sessionId)) {
          processedSessions.add(sessionData.sessionId);
          openDebuggerPanel(context, sessionData);
        }
      }
    }
  } catch (error) {
    console.error('Error reading legacy session file:', error);
  }
}

function checkSessionFile(context: vscode.ExtensionContext, sessionFilePath: string) {
  try {
    if (fs.existsSync(sessionFilePath)) {
      const content = fs.readFileSync(sessionFilePath, 'utf-8');
      const sessionData: SessionData = JSON.parse(content);

      // Check if session is recent (within last 30 seconds)
      const isRecent = Date.now() - sessionData.timestamp < 30000;

      if (isRecent && sessionData.debuggerUrl) {
        // Generate a session ID from the filename if not present
        if (!sessionData.sessionId) {
          sessionData.sessionId = path.basename(sessionFilePath, '.json');
        }
        
        const config = vscode.workspace.getConfiguration('testdriverai');
        const autoOpen = config.get<boolean>('autoOpenPreview', true);

        if (autoOpen && !processedSessions.has(sessionData.sessionId)) {
          processedSessions.add(sessionData.sessionId);
          openDebuggerPanel(context, sessionData);
        }
      }
    }
  } catch (error) {
    console.error('Error reading session file:', sessionFilePath, error);
  }
}

// Helper to get test file name from path (just the filename, not full path)
function getTestFileName(testFile?: string): string {
  if (!testFile) {
    return 'TestDriver';
  }
  // Handle both forward and backslashes
  return testFile.split('/').pop()?.split('\\').pop() || 'TestDriver';
}

// Format the panel title to match debugger.html: [status] filename
function formatPanelTitle(status: string, testFile?: string): string {
  const fileName = getTestFileName(testFile);
  return `[${status}] ${fileName}`;
}

function openDebuggerPanel(context: vscode.ExtensionContext, sessionData?: SessionData) {
  // Generate or use existing session ID
  const sessionId = sessionData?.sessionId || `manual-${Date.now()}`;
  
  // Check if we already have a panel for this session
  const existingPanel = debuggerPanels.get(sessionId);
  if (existingPanel) {
    existingPanel.reveal(vscode.ViewColumn.Active);
    // Update content if we have new session data
    if (sessionData) {
      updateDebuggerContent(existingPanel, sessionData, context, sessionId);
    }
    return;
  }

  // Determine the initial title
  const initialTitle = sessionData 
    ? formatPanelTitle('Loading', sessionData.testFile)
    : 'TestDriver Live Preview';

  // Create a new webview panel for this session
  const panel = vscode.window.createWebviewPanel(
    'testdriverDebugger',
    initialTitle,
    vscode.ViewColumn.Beside,  // Open beside current editor to show multiple
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(context.extensionPath, 'media')),
        vscode.Uri.file(path.join(__dirname, '..', '..', 'debugger'))
      ]
    }
  );

  // Store the panel
  debuggerPanels.set(sessionId, panel);

  // Set the webview icon
  panel.iconPath = {
    light: vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.png')),
    dark: vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.png'))
  };

  // Handle panel disposal
  panel.onDidDispose(() => {
    debuggerPanels.delete(sessionId);
    disconnectWebSocket(sessionId);
    processedSessions.delete(sessionId);
  }, null, context.subscriptions);

  // Update content
  if (sessionData) {
    updateDebuggerContent(panel, sessionData, context, sessionId);
  } else {
    // Show waiting state
    panel.webview.html = getWaitingHtml();
  }
}

function updateDebuggerContent(panel: vscode.WebviewPanel, sessionData: SessionData, context: vscode.ExtensionContext, sessionId: string) {
  // Connect to the WebSocket server for live updates
  connectToWebSocket(sessionData.debuggerUrl, panel, sessionId, sessionData.testFile);

  // Build the data parameter for the debugger
  const data = {
    resolution: sessionData.resolution,
    url: extractVncUrl(sessionData.debuggerUrl),
    token: 'V3b8wG9',
    testFile: sessionData.testFile || null,
    os: sessionData.os || 'linux'
  };

  const encodedData = Buffer.from(JSON.stringify(data)).toString('base64');
  
  // Update the panel title to show it's running
  panel.title = formatPanelTitle('Running', sessionData.testFile);
  
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

function connectToWebSocket(debuggerUrl: string, panel: vscode.WebviewPanel, sessionId: string, testFile?: string) {
  // Disconnect existing connection for this session
  disconnectWebSocket(sessionId);

  try {
    const url = new URL(debuggerUrl);
    const wsUrl = `ws://${url.host}`;

    const ws = new WebSocket(wsUrl);
    websocketConnections.set(sessionId, ws);

    ws.on('open', () => {
      console.log(`Connected to TestDriver debugger WebSocket for session: ${sessionId}`);
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        // Forward events to the webview
        panel.webview.postMessage(message);
        
        // Update panel title based on test events (matching debugger.html behavior)
        if (message.event) {
          switch (message.event) {
            case 'test:start':
              panel.title = formatPanelTitle('Running', testFile);
              break;
            case 'test:stop':
              panel.title = formatPanelTitle('Stopped', testFile);
              break;
            case 'test:success':
              panel.title = formatPanelTitle('Passed', testFile);
              break;
            case 'test:error':
              panel.title = formatPanelTitle('Failed', testFile);
              break;
            case 'error:fatal':
            case 'error:sdk':
              panel.title = formatPanelTitle('Error', testFile);
              break;
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      console.log(`WebSocket connection closed for session: ${sessionId}`);
      // Update panel title to show disconnected/done state
      panel.title = formatPanelTitle('Done', testFile);
    });

    ws.on('error', (error: Error) => {
      console.error(`WebSocket error for session ${sessionId}:`, error);
    });
  } catch (error) {
    console.error('Error connecting to WebSocket:', error);
  }
}

function disconnectWebSocket(sessionId: string) {
  const ws = websocketConnections.get(sessionId);
  if (ws) {
    ws.close();
    websocketConnections.delete(sessionId);
  }
}

function closeAllDebuggerPanels() {
  // Close all panels
  for (const [sessionId, panel] of debuggerPanels) {
    panel.dispose();
    disconnectWebSocket(sessionId);
  }
  debuggerPanels.clear();
  processedSessions.clear();
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
  // Parse the URL properly to handle existing query parameters
  const url = new URL(debuggerUrl);
  url.searchParams.set('data', encodedData);
  const fullUrl = url.toString();

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
  closeAllDebuggerPanels();
  if (fileWatcher) {
    fileWatcher.close();
  }
  if (sessionsWatcher) {
    sessionsWatcher.close();
  }
  
  // Clean up session files
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
    // Clean up all session files in the sessions directory
    if (fs.existsSync(SESSIONS_DIR)) {
      const files = fs.readdirSync(SESSIONS_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(SESSIONS_DIR, file));
        }
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}
