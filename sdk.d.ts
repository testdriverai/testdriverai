/**
 * TestDriver SDK - TypeScript Definitions
 */

export interface TestDriverOptions {
  /** API endpoint URL (default: 'https://v6.testdriver.ai') */
  apiRoot?: string;
  /** Sandbox resolution (default: '1366x768') */
  resolution?: string;
  /** Enable analytics tracking (default: true) */
  analytics?: boolean;
  /** Enable console logging output (default: true) */
  logging?: boolean;
  /** Additional environment variables */
  environment?: Record<string, any>;
}

export interface ConnectOptions {
  /** Existing sandbox ID to reconnect to */
  sandboxId?: string;
  /** Force creation of a new sandbox */
  newSandbox?: boolean;
  /** Direct IP address to connect to */
  ip?: string;
  /** Custom AMI for sandbox */
  sandboxAmi?: string;
  /** Instance type for sandbox */
  sandboxInstance?: string;
}

export interface SandboxInstance {
  instanceId: string;
  ip: string;
  vncPort: number;
  [key: string]: any;
}

export interface HoverResult {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  [key: string]: any;
}

export default class TestDriverSDK {
  constructor(apiKey: string, options?: TestDriverOptions);

  /**
   * Authenticate with TestDriver API
   */
  auth(): Promise<string>;

  /**
   * Connect to a sandbox environment
   */
  connect(options?: ConnectOptions): Promise<SandboxInstance>;

  /**
   * Disconnect from the sandbox
   */
  disconnect(): Promise<void>;

  // Text Interaction Methods
  
  /**
   * Hover over text on screen
   */
  hoverText(
    text: string,
    description?: string | null,
    action?: string,
    method?: 'turbo' | 'leven' | 'dice',
    timeout?: number
  ): Promise<HoverResult>;

  /**
   * Type text
   */
  type(text: string, delay?: number): Promise<void>;

  /**
   * Wait for text to appear on screen
   */
  waitForText(
    text: string,
    timeout?: number,
    method?: 'turbo' | 'leven' | 'dice',
    invert?: boolean
  ): Promise<void>;

  /**
   * Scroll until text is found
   */
  scrollUntilText(
    text: string,
    direction?: 'up' | 'down',
    maxDistance?: number,
    textMatchMethod?: 'turbo' | 'leven' | 'dice',
    method?: 'mouse' | 'keyboard',
    invert?: boolean
  ): Promise<void>;

  // Image Interaction Methods

  /**
   * Hover over an image on screen
   */
  hoverImage(description: string, action?: string): Promise<HoverResult>;

  /**
   * Match and interact with an image template
   */
  matchImage(
    imagePath: string,
    action?: 'click' | 'hover',
    invert?: boolean
  ): Promise<boolean>;

  /**
   * Wait for image to appear on screen
   */
  waitForImage(
    description: string,
    timeout?: number,
    invert?: boolean
  ): Promise<void>;

  /**
   * Scroll until image is found
   */
  scrollUntilImage(
    description: string,
    direction?: 'up' | 'down',
    maxDistance?: number,
    method?: 'mouse' | 'keyboard',
    path?: string | null,
    invert?: boolean
  ): Promise<void>;

  // Mouse & Keyboard Methods

  /**
   * Click at coordinates
   */
  click(
    x: number,
    y: number,
    action?: 'click' | 'right-click' | 'double-click' | 'middle-click' | 'drag-start' | 'drag-end'
  ): Promise<void>;

  /**
   * Hover at coordinates
   */
  hover(x: number, y: number): Promise<void>;

  /**
   * Press keyboard keys
   */
  pressKeys(keys: string[]): Promise<void>;

  /**
   * Scroll the page
   */
  scroll(
    direction?: 'up' | 'down',
    amount?: number,
    method?: 'mouse' | 'keyboard'
  ): Promise<void>;

  // Application Control

  /**
   * Focus an application by name
   */
  focusApplication(name: string): Promise<string>;

  // AI-Powered Methods

  /**
   * Make an AI-powered assertion
   */
  assert(assertion: string, async?: boolean, invert?: boolean): Promise<boolean>;

  /**
   * Extract and remember information from the screen
   */
  remember(description: string): Promise<string>;

  // Code Execution

  /**
   * Execute code in the sandbox
   */
  exec(
    language: 'js' | 'pwsh',
    code: string,
    timeout: number,
    silent?: boolean
  ): Promise<string>;

  // Utility Methods

  /**
   * Wait for specified time
   */
  wait(timeout?: number): Promise<void>;

  /**
   * Get the current sandbox instance details
   */
  getInstance(): SandboxInstance | null;

  /**
   * Get the session ID
   */
  getSessionId(): string | null;

  /**
   * Enable or disable logging output
   */
  setLogging(enabled: boolean): void;

  /**
   * Get the event emitter for custom event handling
   */
  getEmitter(): any; // EventEmitter2 type
}
