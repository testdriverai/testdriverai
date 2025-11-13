/**
 * TestDriver SDK - TypeScript Definitions
 */

// Type Definitions
export type ClickAction = 'click' | 'right-click' | 'double-click' | 'hover' | 'drag-start' | 'drag-end';
export type ScrollDirection = 'up' | 'down' | 'left' | 'right';
export type ScrollMethod = 'keyboard' | 'mouse';
export type TextMatchMethod = 'ai' | 'turbo';
export type ExecLanguage = 'js' | 'pwsh';
export type KeyboardKey = 
  | '\t' | '\n' | '\r' | ' ' | '!' | '"' | '#' | '$' | '%' | '&' | "'" | '(' | ')' | '*' | '+' | ',' | '-' | '.' | '/'
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | ':' | ';' | '<' | '=' | '>' | '?' | '@' | '[' | '\\' | ']' | '^' | '_' | '`'
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z'
  | '{' | '|' | '}' | '~'
  | 'accept' | 'add' | 'alt' | 'altleft' | 'altright' | 'apps' | 'backspace'
  | 'browserback' | 'browserfavorites' | 'browserforward' | 'browserhome' | 'browserrefresh' | 'browsersearch' | 'browserstop'
  | 'capslock' | 'clear' | 'convert' | 'ctrl' | 'ctrlleft' | 'ctrlright' | 'decimal' | 'del' | 'delete' | 'divide' | 'down' | 'end' | 'enter' | 'esc' | 'escape' | 'execute'
  | 'f1' | 'f2' | 'f3' | 'f4' | 'f5' | 'f6' | 'f7' | 'f8' | 'f9' | 'f10' | 'f11' | 'f12' | 'f13' | 'f14' | 'f15' | 'f16' | 'f17' | 'f18' | 'f19' | 'f20' | 'f21' | 'f22' | 'f23' | 'f24'
  | 'final' | 'fn' | 'hanguel' | 'hangul' | 'hanja' | 'help' | 'home' | 'insert' | 'junja' | 'kana' | 'kanji'
  | 'launchapp1' | 'launchapp2' | 'launchmail' | 'launchmediaselect' | 'left' | 'modechange' | 'multiply' | 'nexttrack' | 'nonconvert'
  | 'num0' | 'num1' | 'num2' | 'num3' | 'num4' | 'num5' | 'num6' | 'num7' | 'num8' | 'num9' | 'numlock'
  | 'pagedown' | 'pageup' | 'pause' | 'pgdn' | 'pgup' | 'playpause' | 'prevtrack' | 'print' | 'printscreen' | 'prntscrn' | 'prtsc' | 'prtscr'
  | 'return' | 'right' | 'scrolllock' | 'select' | 'separator' | 'shift' | 'shiftleft' | 'shiftright' | 'sleep' | 'space' | 'stop' | 'subtract' | 'tab' | 'up'
  | 'volumedown' | 'volumemute' | 'volumeup' | 'win' | 'winleft' | 'winright' | 'yen' | 'command' | 'option' | 'optionleft' | 'optionright';

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
   * @param text - Text to find and hover over
   * @param description - Optional description of the element
   * @param action - Action to perform (default: 'click')
   * @param method - Text matching method (default: 'turbo')
   * @param timeout - Timeout in milliseconds (default: 5000)
   */
  hoverText(
    text: string,
    description?: string | null,
    action?: ClickAction,
    method?: TextMatchMethod,
    timeout?: number
  ): Promise<HoverResult>;

  /**
   * Type text
   * @param text - Text to type
   * @param delay - Delay between keystrokes in milliseconds (default: 250)
   */
  type(text: string | number, delay?: number): Promise<void>;

  /**
   * Wait for text to appear on screen
   * @param text - Text to wait for
   * @param timeout - Timeout in milliseconds (default: 5000)
   * @param method - Text matching method (default: 'turbo')
   * @param invert - Invert the match (wait for text to disappear) (default: false)
   */
  waitForText(
    text: string,
    timeout?: number,
    method?: TextMatchMethod,
    invert?: boolean
  ): Promise<void>;

  /**
   * Scroll until text is found
   * @param text - Text to find
   * @param direction - Scroll direction (default: 'down')
   * @param maxDistance - Maximum distance to scroll in pixels (default: 10000)
   * @param textMatchMethod - Text matching method (default: 'turbo')
   * @param method - Scroll method (default: 'keyboard')
   * @param invert - Invert the match (default: false)
   */
  scrollUntilText(
    text: string,
    direction?: ScrollDirection,
    maxDistance?: number,
    textMatchMethod?: TextMatchMethod,
    method?: ScrollMethod,
    invert?: boolean
  ): Promise<void>;

  // Image Interaction Methods

  /**
   * Hover over an image on screen
   * @param description - Description of the image to find
   * @param action - Action to perform (default: 'click')
   */
  hoverImage(description: string, action?: ClickAction): Promise<HoverResult>;

  /**
   * Match and interact with an image template
   * @param imagePath - Path to the image template
   * @param action - Action to perform (default: 'click')
   * @param invert - Invert the match (default: false)
   */
  matchImage(
    imagePath: string,
    action?: ClickAction,
    invert?: boolean
  ): Promise<boolean>;

  /**
   * Wait for image to appear on screen
   * @param description - Description of the image
   * @param timeout - Timeout in milliseconds (default: 10000)
   * @param invert - Invert the match (wait for image to disappear) (default: false)
   */
  waitForImage(
    description: string,
    timeout?: number,
    invert?: boolean
  ): Promise<void>;

  /**
   * Scroll until image is found
   * @param description - Description of the image (or use path parameter)
   * @param direction - Scroll direction (default: 'down')
   * @param maxDistance - Maximum distance to scroll in pixels (default: 10000)
   * @param method - Scroll method (default: 'keyboard')
   * @param path - Path to image template (default: null)
   * @param invert - Invert the match (default: false)
   */
  scrollUntilImage(
    description: string,
    direction?: ScrollDirection,
    maxDistance?: number,
    method?: ScrollMethod,
    path?: string | null,
    invert?: boolean
  ): Promise<void>;

  // Mouse & Keyboard Methods

  /**
   * Click at coordinates
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param action - Type of click action (default: 'click')
   */
  click(
    x: number,
    y: number,
    action?: ClickAction
  ): Promise<void>;

  /**
   * Hover at coordinates
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  hover(x: number, y: number): Promise<void>;

  /**
   * Press keyboard keys
   * @param keys - Array of keys to press
   */
  pressKeys(keys: KeyboardKey[]): Promise<void>;

  /**
   * Scroll the page
   * @param direction - Direction to scroll (default: 'down')
   * @param amount - Amount to scroll in pixels (default: 300)
   * @param method - Scroll method (default: 'mouse')
   */
  scroll(
    direction?: ScrollDirection,
    amount?: number,
    method?: ScrollMethod
  ): Promise<void>;

  // Application Control

  /**
   * Focus an application by name
   * @param name - Application name
   */
  focusApplication(name: string): Promise<string>;

  // AI-Powered Methods

  /**
   * Make an AI-powered assertion
   * @param assertion - Assertion to check
   * @param async - Run asynchronously (default: false)
   * @param invert - Invert the assertion (default: false)
   */
  assert(assertion: string, async?: boolean, invert?: boolean): Promise<boolean>;

  /**
   * Extract and remember information from the screen using AI
   * @param description - What to remember
   */
  remember(description: string): Promise<string>;

  // Code Execution

  /**
   * Execute code in the sandbox
   * @param language - Language ('js' or 'pwsh')
   * @param code - Code to execute
   * @param timeout - Timeout in milliseconds
   * @param silent - Suppress output (default: false)
   */
  exec(
    language: ExecLanguage,
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

  // AI Methods (Exploratory Loop)

  /**
   * Execute a natural language task using AI
   * This is the SDK equivalent of the CLI's exploratory loop
   * 
   * @param task - Natural language description of what to do
   * @param options - Execution options
   * @returns Final AI response if validateAndLoop is true
   * 
   * @example
   * // Simple execution
   * await client.ai('Click the submit button');
   * 
   * @example
   * // With validation loop
   * const result = await client.ai('Fill out the contact form', { validateAndLoop: true });
   * console.log(result); // AI's final assessment
   */
  ai(task: string, options?: { validateAndLoop?: boolean }): Promise<string | void>;
}
