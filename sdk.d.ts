/**
 * TestDriver SDK - TypeScript Definitions
 */

// Type Definitions
export type ClickAction =
  | "click"
  | "right-click"
  | "double-click"
  | "hover"
  | "mouseDown"
  | "mouseUp";
export type ScrollDirection = "up" | "down" | "left" | "right";
export type ScrollMethod = "keyboard" | "mouse";
export type TextMatchMethod = "ai" | "turbo";
export type ExecLanguage = "js" | "pwsh";
export type KeyboardKey =
  | "\t"
  | "\n"
  | "\r"
  | " "
  | "!"
  | '"'
  | "#"
  | "$"
  | "%"
  | "&"
  | "'"
  | "("
  | ")"
  | "*"
  | "+"
  | ","
  | "-"
  | "."
  | "/"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | ":"
  | ";"
  | "<"
  | "="
  | ">"
  | "?"
  | "@"
  | "["
  | "\\"
  | "]"
  | "^"
  | "_"
  | "`"
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z"
  | "{"
  | "|"
  | "}"
  | "~"
  | "accept"
  | "add"
  | "alt"
  | "altleft"
  | "altright"
  | "apps"
  | "backspace"
  | "browserback"
  | "browserfavorites"
  | "browserforward"
  | "browserhome"
  | "browserrefresh"
  | "browsersearch"
  | "browserstop"
  | "capslock"
  | "clear"
  | "convert"
  | "ctrl"
  | "ctrlleft"
  | "ctrlright"
  | "decimal"
  | "del"
  | "delete"
  | "divide"
  | "down"
  | "end"
  | "enter"
  | "esc"
  | "escape"
  | "execute"
  | "f1"
  | "f2"
  | "f3"
  | "f4"
  | "f5"
  | "f6"
  | "f7"
  | "f8"
  | "f9"
  | "f10"
  | "f11"
  | "f12"
  | "f13"
  | "f14"
  | "f15"
  | "f16"
  | "f17"
  | "f18"
  | "f19"
  | "f20"
  | "f21"
  | "f22"
  | "f23"
  | "f24"
  | "final"
  | "fn"
  | "hanguel"
  | "hangul"
  | "hanja"
  | "help"
  | "home"
  | "insert"
  | "junja"
  | "kana"
  | "kanji"
  | "launchapp1"
  | "launchapp2"
  | "launchmail"
  | "launchmediaselect"
  | "left"
  | "modechange"
  | "multiply"
  | "nexttrack"
  | "nonconvert"
  | "num0"
  | "num1"
  | "num2"
  | "num3"
  | "num4"
  | "num5"
  | "num6"
  | "num7"
  | "num8"
  | "num9"
  | "numlock"
  | "pagedown"
  | "pageup"
  | "pause"
  | "pgdn"
  | "pgup"
  | "playpause"
  | "prevtrack"
  | "print"
  | "printscreen"
  | "prntscrn"
  | "prtsc"
  | "prtscr"
  | "return"
  | "right"
  | "scrolllock"
  | "select"
  | "separator"
  | "shift"
  | "shiftleft"
  | "shiftright"
  | "sleep"
  | "space"
  | "stop"
  | "subtract"
  | "tab"
  | "up"
  | "volumedown"
  | "volumemute"
  | "volumeup"
  | "win"
  | "winleft"
  | "winright"
  | "yen"
  | "command"
  | "option"
  | "optionleft"
  | "optionright";

export interface TestDriverOptions {
  /** API endpoint URL (default: 'https://v6.testdriver.ai') */
  apiRoot?: string;
  /** Sandbox resolution (default: '1366x768') */
  resolution?: string;
  /** Enable analytics tracking (default: true) */
  analytics?: boolean;
  /** Enable console logging output (default: true) */
  logging?: boolean;
  /** Enable/disable cache (default: true). Set to false to force regeneration on all find operations */
  cache?: boolean;
  /** Cache threshold configuration for different methods */
  cacheThreshold?: {
    /** Threshold for find operations (default: 0.05 = 5% difference, 95% similarity) */
    find?: number;
    /** Threshold for findAll operations (default: 0.05 = 5% difference, 95% similarity) */
    findAll?: number;
  };
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

export interface ElementCoordinates {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
}

export interface ElementBoundingBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
  [key: string]: any;
}

export interface ElementResponse {
  coordinates: ElementCoordinates;
  confidence?: number;
  screenshot?: string;
  width?: number;
  height?: number;
  boundingBox?: ElementBoundingBox;
  text?: string;
  label?: string;
  [key: string]: any;
}

export interface HoverResult {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  [key: string]: any;
}

// ====================================
// Command Options Interfaces
// ====================================

/** Options for scroll command */
export interface ScrollOptions {
  /** Direction to scroll */
  direction?: ScrollDirection;
  /** Amount to scroll in pixels */
  amount?: number;
}

/** Options for click command */
export interface ClickOptions {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Type of click action */
  action?: ClickAction;
  /** Prompt for tracking */
  prompt?: string;
  /** Whether cache was hit */
  cacheHit?: boolean;
  /** Selector used */
  selector?: string;
  /** Whether selector was used */
  selectorUsed?: boolean;
}

/** Options for hover command */
export interface HoverOptions {
  /** X coordinate */
  x: number;
  /** Y coordinate */
  y: number;
  /** Prompt for tracking */
  prompt?: string;
  /** Whether cache was hit */
  cacheHit?: boolean;
  /** Selector used */
  selector?: string;
  /** Whether selector was used */
  selectorUsed?: boolean;
}

/** Options for hoverText command */
export interface HoverTextOptions {
  /** Text to find and hover over */
  text: string;
  /** Optional description of the element */
  description?: string | null;
  /** Action to perform */
  action?: ClickAction;
  /** Timeout in milliseconds */
  timeout?: number;
}

/** Options for hoverImage command */
export interface HoverImageOptions {
  /** Description of the image to find */
  description: string;
  /** Action to perform */
  action?: ClickAction;
}

/** Options for matchImage command */
export interface MatchImageOptions {
  /** Path to the image template */
  path: string;
  /** Action to perform */
  action?: ClickAction;
  /** Invert the match */
  invert?: boolean;
}

/** Options for type command */
export interface TypeOptions {
  /** Text to type */
  text: string | number;
  /** Delay between keystrokes in milliseconds */
  delay?: number;
}

/** Options for pressKeys command */
export interface PressKeysOptions {
  /** Array of keys to press */
  keys: KeyboardKey[];
}

/** Options for wait command */
export interface WaitOptions {
  /** Time to wait in milliseconds */
  timeout?: number;
}

/** Options for waitForText command */
export interface WaitForTextOptions {
  /** Text to wait for */
  text: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/** Options for waitForImage command */
export interface WaitForImageOptions {
  /** Description of the image */
  description: string;
  /** Timeout in milliseconds */
  timeout?: number;
}

/** Options for scrollUntilText command */
export interface ScrollUntilTextOptions {
  /** Text to find */
  text: string;
  /** Scroll direction */
  direction?: ScrollDirection;
  /** Maximum distance to scroll in pixels */
  maxDistance?: number;
  /** Invert the match */
  invert?: boolean;
}

/** Options for scrollUntilImage command */
export interface ScrollUntilImageOptions {
  /** Description of the image */
  description?: string;
  /** Scroll direction */
  direction?: ScrollDirection;
  /** Maximum distance to scroll in pixels */
  maxDistance?: number;
  /** Scroll method */
  method?: ScrollMethod;
  /** Path to image template */
  path?: string;
  /** Invert the match */
  invert?: boolean;
}

/** Options for focusApplication command */
export interface FocusApplicationOptions {
  /** Application name */
  name: string;
}

/** Options for remember command */
export interface RememberOptions {
  /** What to remember */
  description: string;
}

/** Options for assert command */
export interface AssertOptions {
  /** Assertion to check */
  assertion: string;
}

/** Options for exec command */
export interface ExecOptions {
  /** Language ('js', 'pwsh', or 'sh') */
  language?: ExecLanguage;
  /** Code to execute */
  code: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Suppress output */
  silent?: boolean;
}

/**
 * Element class representing a located or to-be-located element on screen
 */
export class Element {
  constructor(description: string);

  /**
   * Check if element was found
   */
  found(): boolean;

  /**
   * Find the element on screen
   * @param newDescription - Optional new description to search for
   * @param cacheThreshold - Cache threshold for this specific find (overrides global setting)
   */
  find(newDescription?: string, cacheThreshold?: number): Promise<Element>;

  /**
   * Click on the element
   * @param action - Type of click action (default: 'click')
   */
  click(action?: ClickAction): Promise<void>;

  /**
   * Hover over the element
   */
  hover(): Promise<void>;

  /**
   * Double-click on the element
   */
  doubleClick(): Promise<void>;

  /**
   * Right-click on the element
   */
  rightClick(): Promise<void>;

  /**
   * Press mouse button down on this element
   */
  mouseDown(): Promise<void>;

  /**
   * Release mouse button on this element
   */
  mouseUp(): Promise<void>;

  /**
   * Get the coordinates of the element
   */
  getCoordinates(): ElementCoordinates | null;

  /**
   * Get the x coordinate (top-left)
   */
  readonly x: number | null;

  /**
   * Get the y coordinate (top-left)
   */
  readonly y: number | null;

  /**
   * Get the center x coordinate
   */
  readonly centerX: number | null;

  /**
   * Get the center y coordinate
   */
  readonly centerY: number | null;

  /**
   * Get the full API response data
   */
  getResponse(): ElementResponse | null;

  /**
   * Get element screenshot if available (base64 encoded)
   */
  readonly screenshot: string | null;

  /**
   * Get element confidence score if available
   */
  readonly confidence: number | null;

  /**
   * Get element width if available
   */
  readonly width: number | null;

  /**
   * Get element height if available
   */
  readonly height: number | null;

  /**
   * Get element bounding box if available
   */
  readonly boundingBox: ElementBoundingBox | null;

  /**
   * Get element text content if available
   */
  readonly text: string | null;

  /**
   * Get element label if available
   */
  readonly label: string | null;
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

  // Element Finding API

  /**
   * Find an element by description
   * Automatically locates the element and returns it
   *
   * @param description - Description of the element to find
   * @param cacheThreshold - Cache threshold for this specific find (overrides global setting)
   * @returns Element instance that has been located
   *
   * @example
   * // Find and click immediately
   * const element = await client.find('the sign in button');
   * await element.click();
   *
   * @example
   * // Find with custom cache threshold
   * const element = await client.find('login button', 0.01);
   *
   * @example
   * // Poll until element is found
   * let element;
   * while (!element?.found()) {
   *   element = await client.find('login button');
   *   if (!element.found()) {
   *     await new Promise(resolve => setTimeout(resolve, 1000));
   *   }
   * }
   * await element.click();
   */
  find(description: string, cacheThreshold?: number): Promise<Element>;

  /**
   * Find all elements matching a description
   * @param description - Description of the elements to find
   * @param cacheThreshold - Cache threshold for this specific findAll (overrides global setting)
   * @returns Array of Element instances
   *
   * @example
   * // Find all buttons
   * const buttons = await client.findAll('button');
   *
   * @example
   * // Find with custom cache threshold
   * const items = await client.findAll('list item', 0.01);
   */
  findAll(description: string, cacheThreshold?: number): Promise<Element[]>;

  // Text Interaction Methods

  /**
   * Hover over text on screen
   * @deprecated Use find() and element.click() instead
   * @param options - Options object with text, description, action, and timeout
   */
  hoverText(options: HoverTextOptions): Promise<HoverResult>;
  /**
   * Hover over text on screen (positional arguments - legacy)
   * @deprecated Use find() and element.click() instead
   * @param text - Text to find and hover over
   * @param description - Optional description of the element
   * @param action - Action to perform (default: 'click')
   * @param timeout - Timeout in milliseconds (default: 5000)
   */
  hoverText(
    text: string,
    description?: string | null,
    action?: ClickAction,
    timeout?: number,
  ): Promise<HoverResult>;

  /**
   * Type text
   * @param text - Text to type
   * @param options - Options object with delay and secret
   * 
   * @example
   * // Type regular text
   * await client.type('hello world');
   * 
   * @example
   * // Type a password securely (not logged or stored)
   * await client.type(process.env.TD_PASSWORD, { secret: true });
   * 
   * @example
   * // Type with custom delay
   * await client.type('slow typing', { delay: 100 });
   */
  type(text: string | number, options?: { delay?: number; secret?: boolean }): Promise<void>;

  /**
   * Wait for text to appear on screen
   * @deprecated Use find() in a polling loop instead
   * @param options - Options object with text and timeout
   */
  waitForText(options: WaitForTextOptions): Promise<void>;
  /**
   * Wait for text to appear on screen (positional arguments - legacy)
   * @deprecated Use find() in a polling loop instead
   * @param text - Text to wait for
   * @param timeout - Timeout in milliseconds (default: 5000)
   */
  waitForText(text: string, timeout?: number): Promise<void>;

  /**
   * Scroll until text is found
   * @param options - Options object with text, direction, maxDistance, and invert
   */
  scrollUntilText(options: ScrollUntilTextOptions): Promise<void>;
  /**
   * Scroll until text is found (positional arguments - legacy)
   * @param text - Text to find
   * @param direction - Scroll direction (default: 'down')
   * @param maxDistance - Maximum distance to scroll in pixels (default: 10000)
   * @param invert - Invert the match (default: false)
   */
  scrollUntilText(
    text: string,
    direction?: ScrollDirection,
    maxDistance?: number,
    invert?: boolean,
  ): Promise<void>;

  // Image Interaction Methods

  /**
   * Hover over an image on screen
   * @deprecated Use find() and element.click() instead
   * @param options - Options object with description and action
   */
  hoverImage(options: HoverImageOptions): Promise<HoverResult>;
  /**
   * Hover over an image on screen (positional arguments - legacy)
   * @deprecated Use find() and element.click() instead
   * @param description - Description of the image to find
   * @param action - Action to perform (default: 'click')
   */
  hoverImage(description: string, action?: ClickAction): Promise<HoverResult>;

  /**
   * Match and interact with an image template
   * @param options - Options object with path, action, and invert
   */
  matchImage(options: MatchImageOptions): Promise<boolean>;
  /**
   * Match and interact with an image template (positional arguments - legacy)
   * @param imagePath - Path to the image template
   * @param action - Action to perform (default: 'click')
   * @param invert - Invert the match (default: false)
   */
  matchImage(
    imagePath: string,
    action?: ClickAction,
    invert?: boolean,
  ): Promise<boolean>;

  /**
   * Wait for image to appear on screen
   * @deprecated Use find() in a polling loop instead
   * @param options - Options object with description and timeout
   */
  waitForImage(options: WaitForImageOptions): Promise<void>;
  /**
   * Wait for image to appear on screen (positional arguments - legacy)
   * @deprecated Use find() in a polling loop instead
   * @param description - Description of the image
   * @param timeout - Timeout in milliseconds (default: 10000)
   */
  waitForImage(description: string, timeout?: number): Promise<void>;

  /**
   * Scroll until image is found
   * @param options - Options object with description, direction, maxDistance, method, path, and invert
   */
  scrollUntilImage(options: ScrollUntilImageOptions): Promise<void>;
  /**
   * Scroll until image is found (positional arguments - legacy)
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
    invert?: boolean,
  ): Promise<void>;

  // Mouse & Keyboard Methods

  /**
   * Click at coordinates
   * @param options - Options object with x, y, and action
   */
  click(options: ClickOptions): Promise<void>;
  /**
   * Click at coordinates (positional arguments - legacy)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param action - Type of click action (default: 'click')
   */
  click(x: number, y: number, action?: ClickAction): Promise<void>;

  /**
   * Hover at coordinates
   * @param options - Options object with x and y
   */
  hover(options: HoverOptions): Promise<void>;
  /**
   * Hover at coordinates (positional arguments - legacy)
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  hover(x: number, y: number): Promise<void>;

  /**
   * Press keyboard keys
   * @param keys - Array of keys to press
   * @param options - Additional options (reserved for future use)
   */
  pressKeys(keys: KeyboardKey[], options?: object): Promise<void>;

  /**
   * Scroll the page
   * @param direction - Direction to scroll (default: 'down')
   * @param options - Options object with amount
   */
  scroll(direction?: ScrollDirection, options?: { amount?: number }): Promise<void>;

  // Application Control

  /**
   * Focus an application by name
   * @param name - Application name
   * @param options - Additional options (reserved for future use)
   */
  focusApplication(name: string, options?: object): Promise<string>;

  // AI-Powered Methods

  /**
   * Make an AI-powered assertion
   * @param assertion - Assertion to check
   * @param options - Additional options (reserved for future use)
   */
  assert(assertion: string, options?: object): Promise<boolean>;

  /**
   * Extract and remember information from the screen using AI
   * @param options - Options object with description
   */
  remember(options: RememberOptions): Promise<string>;
  /**
   * Extract and remember information from the screen using AI (positional arguments - legacy)
   * @param description - What to remember
   */
  remember(description: string): Promise<string>;

  // Code Execution

  /**
   * Execute code in the sandbox
   * @param options - Options object with language, code, timeout, and silent
   */
  exec(options: ExecOptions): Promise<string>;
  /**
   * Execute code in the sandbox (positional arguments - legacy)
   * @param language - Language ('js' or 'pwsh')
   * @param code - Code to execute
   * @param timeout - Timeout in milliseconds
   * @param silent - Suppress output (default: false)
   */
  exec(
    language: ExecLanguage,
    code: string,
    timeout: number,
    silent?: boolean,
  ): Promise<string>;

  // Utility Methods

  /**
   * Capture a screenshot of the current screen
   * @param scale - Scale factor for the screenshot (default: 1 = original size)
   * @param silent - Whether to suppress logging (default: false)
   * @param mouse - Whether to include mouse cursor (default: false)
   * @returns Base64 encoded PNG screenshot
   *
   * @example
   * // Capture a screenshot
   * const screenshot = await client.screenshot();
   * fs.writeFileSync('screenshot.png', Buffer.from(screenshot, 'base64'));
   *
   * @example
   * // Capture with mouse cursor visible
   * const screenshot = await client.screenshot(1, false, true);
   */
  screenshot(
    scale?: number,
    silent?: boolean,
    mouse?: boolean,
  ): Promise<string>;

  /**
   * Wait for specified time
   * @deprecated Consider using element polling with find() instead of arbitrary waits
   * @param timeout - Time to wait in milliseconds (default: 3000)
   * @param options - Additional options (reserved for future use)
   */
  wait(timeout?: number, options?: object): Promise<void>;

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
  ai(
    task: string,
    options?: { validateAndLoop?: boolean },
  ): Promise<string | void>;
}
