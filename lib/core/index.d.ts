/**
 * TypeScript definitions for TestDriver Core Module
 * @module testdriverai/core
 */

export class Dashcam {
  /**
   * Create a new Dashcam instance
   * @param client - TestDriver client instance
   * @param options - Dashcam options
   */
  constructor(client: any, options?: DashcamOptions);
  
  /**
   * Authenticate with Dashcam CLI
   * @param apiKey - Dashcam API key (optional, uses DASHCAM_API_KEY env var if not provided)
   * @returns Promise that resolves when authenticated
   */
  auth(apiKey?: string): Promise<void>;
  
  /**
   * Add a log entry to Dashcam
   * @param config - Log configuration
   */
  addLog(config: LogConfig): Promise<void>;
  
  /**
   * Add a file log to Dashcam
   * @param path - Path to file to log
   * @param name - Name/description for the log entry
   */
  addFileLog(path: string, name: string): Promise<void>;
  
  /**
   * Add an application log to Dashcam
   * @param application - Application name to track
   * @param name - Name/description for the log entry
   */
  addApplicationLog(application: string, name: string): Promise<void>;
  
  /**
   * Start recording
   * @returns Promise that resolves when recording starts
   */
  start(): Promise<void>;
  
  /**
   * Stop recording and get replay URL
   * @returns Promise that resolves to the replay URL (or null if not recording)
   */
  stop(): Promise<string | null>;
  
  /**
   * Check if currently recording
   * @returns true if recording, false otherwise
   */
  isRecording(): boolean;
}

export interface DashcamOptions {
  /**
   * Dashcam API key (defaults to DASHCAM_API_KEY env var)
   */
  apiKey?: string;
}

export interface LogConfig {
  /**
   * Type of log entry
   */
  type: 'file' | 'application';
  
  /**
   * Path to file (for file logs)
   */
  path?: string;
  
  /**
   * Application name (for application logs)
   */
  application?: string;
  
  /**
   * Name/description for the log entry
   */
  name: string;
}

/**
 * TestDriver SDK class
 * Re-exported from main module for convenience
 */
export class TestDriver {
  constructor(apiKey: string, options?: TestDriverOptions);
  
  auth(): Promise<void>;
  connect(options?: ConnectOptions): Promise<any>;
  disconnect(): Promise<void>;
  
  find(query: string): Promise<any>;
  findAll(query: string): Promise<any[]>;
  click(target: string): Promise<void>;
  type(target: string, text: string): Promise<void>;
  exec(shell: string, command: string, timeout?: number, ignoreError?: boolean): Promise<string>;
  focusApplication(appName: string): Promise<void>;
  
  // Add other TestDriver methods as needed
}

export interface TestDriverOptions {
  /**
   * API endpoint URL
   */
  apiRoot?: string;
  
  /**
   * Target OS: 'linux', 'mac', or 'windows'
   */
  os?: 'linux' | 'mac' | 'windows';
  
  /**
   * Create new sandbox
   */
  newSandbox?: boolean;
  
  /**
   * Screen resolution
   */
  resolution?: string;
  
  /**
   * Enable analytics
   */
  analytics?: boolean;
  
  /**
   * Cache thresholds for find operations
   */
  cacheThresholds?: {
    find?: number;
    findAll?: number;
  };
}

export interface ConnectOptions {
  /**
   * Create new sandbox instance
   */
  new?: boolean;
}
