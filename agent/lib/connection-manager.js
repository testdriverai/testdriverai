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

  /**
   * Get connection details
   */
  getConnectionInfo() {
    return {
      ip: this.ip,
      vncPort: this.vncPort,
      wsPort: this.wsPort,
      wsUrl: `ws://${this.ip}:${this.wsPort}`,
      vncUrl: `http://${this.ip}:${this.vncPort}`
    };
  }

  /**
   * Check if the instance is reachable (basic connectivity test)
   */
  async isInstanceReachable() {
    const net = require('net');
    
    return new Promise((resolve) => {
      const socket = new net.Socket();
      const timeout = 5000; // 5 second timeout
      
      socket.setTimeout(timeout);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.connect(this.wsPort, this.ip);
    });
  }
}

module.exports = { ConnectionManager };
