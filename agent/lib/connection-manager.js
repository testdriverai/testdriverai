/**
 * Simple connection manager for TestDriver CLI
 * Connects to TestDriver instances via IP address
 */
class ConnectionManager {
  constructor(ip) {
    if (!ip) {
      throw new Error('IP address is required for connection');
    }
    
    this.ip = ip;
    this.vncPort = 8080;
    this.wsPort = 8765;
    
    // Hard-coded paths on the remote instance
    this.userBasePath = `C:\\Users\\Administrator`;
    this.pythonPath = `${this.userBasePath}\\AppData\\Local\\Programs\\Python\\Python313\\python.exe`;
    this.scriptPath = `${this.userBasePath}\\Desktop\\pyautogui-cli.py`;
    this.psexecPath = `${this.userBasePath}\\Desktop\\PsExec.exe`;
    this.wsConfigPath = `C:\\Windows\\Temp\\pyautogui-ws.json`;
  }

}

module.exports = { ConnectionManager };
