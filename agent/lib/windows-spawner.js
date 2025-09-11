const { ConnectionManager } = require('./connection-manager.js');
const { PyAutoGUIClient } = require('./pyautogui-client.js');

/**
 * Main Windows Spawner class for CLI that connects to TestDriver instances
 */
class WindowsSpawner {
  constructor(ip = null) {
    this.connectionManager = ip ? new ConnectionManager(ip) : null;
    this.pyautoguiClient = null;
    this.instanceId = null;
    this.ip = ip;
    this.vncPort = 8080;
    this.wsUrl = null;
    this.wsPort = 8765;
  }

  toJSON() {
    return {
      instanceId: this.instanceId,
      ip: this.ip,
      vncPort: this.vncPort,
      wsUrl: this.wsUrl,
      vncUrl: this.vncUrl,
      wsPort: this.wsPort
    };
  }

  /**
   * Connect to the TestDriver instance by IP
   */
  async connectToInstance(apiKey, ip = null) {
    // Use provided IP or the one from constructor
    if (ip) {
      this.ip = ip;
      this.connectionManager = new ConnectionManager(ip);
    }
    
    if (!this.connectionManager) {
      throw new Error('No IP address provided for connection');
    }
    
    const connectionInfo = this.connectionManager.getConnectionInfo();
    this.ip = connectionInfo.ip;
    this.wsUrl = connectionInfo.wsUrl;
    this.vncUrl = connectionInfo.vncUrl;
    this.instanceId = `testdriver-${this.ip.replace(/\./g, '-')}`;
    
    console.log(`Connecting to TestDriver instance at ${this.ip}`);
  
    
    console.log(`VNC available at: ${this.vncUrl}`);
    
    // Connect PyAutoGUI client
    try {
      console.log('Connecting to pyautogui client at ' + this.wsUrl);
      this.pyautoguiClient = new PyAutoGUIClient(this.wsUrl);
      await this.pyautoguiClient.connect();
    } catch (e) {
      console.error(`Failed to connect to PyAutoGUI client: ${e}`);
      throw e;
    }
    
    // Authorize Dashcam
    await this.authorizeDashcam(apiKey);
    
    return this;
  }

  /**
   * Backward compatibility method - redirects to connectToInstance
   */
  async connectToExisting(apiKey) {
    return this.connectToInstance(apiKey);
  }

  /**
   * Get the PyAutoGUI client (must be connected first)
   */
  getClient() {
    if (!this.pyautoguiClient || !this.pyautoguiClient.connected) {
      return null;
    }
    return this.pyautoguiClient;
  }

  /**
   * Authorize Dashcam with retry logic
   */
  async authorizeDashcam(apiKey) {
    console.log('🔐 Authorizing Dashcam...');
    
    let authResponse;
    const maxRetries = 12; // 60 seconds total (12 attempts × 5 seconds)
    const retryInterval = 5000; // 5 seconds between retries
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        authResponse = await this.pyautoguiClient.exec(
          `dashcam auth ${apiKey}`
        );

        console.log('Dashcam auth response:', authResponse);

        // Check if the response contains "Connected as"
        if (
          authResponse &&
          authResponse.stdout &&
          authResponse.stdout.includes('Connected as')
        ) {
          console.log('✅ Dashcam auth successful - Connected as found');
          return authResponse;
        }

        console.log(
          `⏳ Dashcam auth not yet successful, retrying in ${retryInterval / 1000}s... (attempt ${retryCount + 1}/${maxRetries})`
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        retryCount++;
      } catch (error) {
        console.error(
          `❌ Dashcam auth attempt ${retryCount + 1} failed:`,
          error
        );

        // Wait before retrying even on error
        await new Promise(resolve => setTimeout(resolve, retryInterval));
        retryCount++;
      }
    }

    if (retryCount >= maxRetries) {
      console.warn('⚠️  Dashcam auth did not succeed within 60 seconds');
    }

    return authResponse;
  }
}

module.exports = { WindowsSpawner };
