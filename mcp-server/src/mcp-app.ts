/**
 * TestDriver MCP App - displays screenshots with overlays for action results
 */
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ReadResourceResultSchema } from "@modelcontextprotocol/sdk/types.js";
import "./mcp-app.css";

// DOM elements
const mainEl = document.querySelector(".main") as HTMLElement;
const containerEl = document.getElementById("screenshot-container") as HTMLDivElement;
const screenshotEl = document.getElementById("screenshot") as HTMLImageElement;
const overlaysEl = document.getElementById("overlays") as HTMLDivElement;
const actionStatusEl = document.getElementById("action-status") as HTMLSpanElement;
const sessionInfoEl = document.getElementById("session-info") as HTMLSpanElement;
const loadingOverlayEl = document.getElementById("loading-overlay") as HTMLDivElement;
const loadingTextEl = loadingOverlayEl.querySelector(".loading-text") as HTMLSpanElement;

// Create target info element dynamically
const targetInfoEl = document.createElement("div");
targetInfoEl.id = "target-info";
targetInfoEl.className = "target-info hidden";

// Track screenshot natural dimensions for coordinate scaling
let screenshotNaturalWidth = 0;
let screenshotNaturalHeight = 0;

// Zoom state
let isZoomed = true; // Start zoomed in when element found
const ZOOM_LEVEL = 2.0; // 2x zoom

// Types for tool result data
interface ToolResultData {
  action?: string;
  success?: boolean;
  imageUrl?: string;  // Data URL with cropped image from find() response
  screenshotResourceUri?: string;  // Resource URI to fetch screenshot blob
  element?: {
    description?: string;
    x?: number;
    y?: number;
    centerX?: number;
    centerY?: number;
    width?: number;
    height?: number;
    confidence?: number;
    ref?: string;
  };
  clickPosition?: { x: number; y: number };
  scrollDirection?: string;
  assertion?: string;
  text?: string;
  execResult?: string;
  error?: string;
  session?: {
    id?: string;
    expiresIn?: number;
  };
  debuggerUrl?: string;
  sessionId?: string;
  duration?: number;
}

// Store session info globally for display
let currentDebuggerUrl: string | null = null;

/**
 * Extract structured data from tool result
 */
function extractData(result: CallToolResult): ToolResultData {
  return (result.structuredContent as ToolResultData) ?? {};
}

/**
 * Show loading state with optional custom message
 */
function showLoading(message = "Waiting for screenshot...") {
  loadingTextEl.textContent = message;
  loadingOverlayEl.classList.remove("hidden");
}

/**
 * Hide loading state
 */
function hideLoading() {
  loadingOverlayEl.classList.add("hidden");
}

/**
 * Apply host context (theme, styles, safe areas)
 */
function handleHostContextChanged(ctx: McpUiHostContext) {
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
  if (ctx.safeAreaInsets) {
    mainEl.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    mainEl.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    mainEl.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    mainEl.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}

/**
 * Scale coordinates from screenshot natural size to displayed size
 */
function scaleCoord(value: number, naturalSize: number, displayedSize: number): number {
  if (naturalSize === 0) return value;
  return (value / naturalSize) * displayedSize;
}

/**
 * Apply zoom transform to center on a point
 */
function applyZoom(centerX: number, centerY: number, zoom: boolean) {
  if (!zoom) {
    containerEl.style.transform = "none";
    containerEl.classList.remove("zoomed");
    return;
  }

  const displayedWidth = screenshotEl.clientWidth;
  const displayedHeight = screenshotEl.clientHeight;
  
  // Scale the target coordinates to displayed size
  const scaledX = scaleCoord(centerX, screenshotNaturalWidth, displayedWidth);
  const scaledY = scaleCoord(centerY, screenshotNaturalHeight, displayedHeight);
  
  // Calculate translation to center the point
  // After zoom, we need to translate so the point ends up in the center of the container
  const containerWidth = containerEl.parentElement?.clientWidth || displayedWidth;
  const containerHeight = containerEl.parentElement?.clientHeight || displayedHeight;
  
  // The point's position after scaling
  const scaledPointX = scaledX * ZOOM_LEVEL;
  const scaledPointY = scaledY * ZOOM_LEVEL;
  
  // Translation needed to center the point
  const translateX = (containerWidth / 2) - scaledPointX;
  const translateY = (containerHeight / 2) - scaledPointY;
  
  containerEl.style.transform = `scale(${ZOOM_LEVEL}) translate(${translateX / ZOOM_LEVEL}px, ${translateY / ZOOM_LEVEL}px)`;
  containerEl.classList.add("zoomed");
}

/**
 * Reset zoom to show full screenshot
 */
function resetZoom() {
  containerEl.style.transform = "none";
  containerEl.classList.remove("zoomed");
}

/**
 * Add overlays after screenshot loads (so we know dimensions)
 */
function addOverlays(data: ToolResultData) {
  overlaysEl.innerHTML = "";
  
  const displayedWidth = screenshotEl.clientWidth;
  const displayedHeight = screenshotEl.clientHeight;
  
  // Track the focal point for zoom
  let focalX: number | undefined;
  let focalY: number | undefined;
  
  // Add element target overlay only for 'find' action (not click)
  // The cropped image is always centered on the found element, so position target at image center
  if (data.action === "find" && data.element) {
    const target = document.createElement("div");
    target.className = "element-target";
    
    // Position at center of displayed image (cropped image is already centered on element)
    target.style.left = `${displayedWidth / 2}px`;
    target.style.top = `${displayedHeight / 2}px`;
    
    // Add crosshair lines
    const crosshairH = document.createElement("div");
    crosshairH.className = "crosshair-h";
    target.appendChild(crosshairH);
    
    const crosshairV = document.createElement("div");
    crosshairV.className = "crosshair-v";
    target.appendChild(crosshairV);
    
    // Add label
    const label = document.createElement("div");
    label.className = "element-label";
    label.textContent = data.element.description || "Element";
    if (data.element.confidence) {
      label.textContent += ` (${Math.round(data.element.confidence * 100)}%)`;
    }
    target.appendChild(label);
    
    overlaysEl.appendChild(target);
    
    // Set focal point for zoom at image center
    focalX = screenshotNaturalWidth / 2;
    focalY = screenshotNaturalHeight / 2;
  }

  // Add click marker overlay
  if (data.clickPosition && data.clickPosition.x !== undefined && data.clickPosition.y !== undefined) {
    const marker = document.createElement("div");
    marker.className = "click-marker";
    
    const scaledX = scaleCoord(data.clickPosition.x, screenshotNaturalWidth, displayedWidth);
    const scaledY = scaleCoord(data.clickPosition.y, screenshotNaturalHeight, displayedHeight);
    
    marker.style.left = `${scaledX}px`;
    marker.style.top = `${scaledY}px`;
    
    // Add ripple effect
    const ripple = document.createElement("div");
    ripple.className = "click-ripple";
    marker.appendChild(ripple);
    
    overlaysEl.appendChild(marker);
    
    // Set focal point for zoom (click position takes priority if no element)
    if (focalX === undefined) {
      focalX = data.clickPosition.x;
      focalY = data.clickPosition.y;
    }
  }

  // Add scroll indicator (doesn't need scaling - centered)
  if (data.scrollDirection) {
    const arrow = document.createElement("div");
    arrow.className = `scroll-indicator scroll-${data.scrollDirection}`;
    arrow.textContent = data.scrollDirection === "up" ? "↑" : 
                        data.scrollDirection === "down" ? "↓" :
                        data.scrollDirection === "left" ? "←" : "→";
    overlaysEl.appendChild(arrow);
  }
  
  // Apply zoom if we have a focal point
  if (focalX !== undefined && focalY !== undefined) {
    isZoomed = true;
    applyZoom(focalX, focalY, true);
    
    // Store focal point for toggle
    containerEl.dataset.focalX = String(focalX);
    containerEl.dataset.focalY = String(focalY);
  } else {
    resetZoom();
    delete containerEl.dataset.focalX;
    delete containerEl.dataset.focalY;
  }
}

/**
 * Render screenshot and overlays
 * Fetches screenshot via HTTP from localhost server (enabled by CSP connectDomains)
 * This keeps base64 data out of AI context - only a small URL is passed
 */
function renderResult(data: ToolResultData) {
  // Clear previous overlays
  overlaysEl.innerHTML = "";

  // Update action status immediately
  const actionName = data.action || "unknown";
  const statusIcon = data.success ? "✓" : "✗";
  const statusClass = data.success ? "success" : "error";
  let statusText = `${statusIcon} ${actionName}`;
  
  if (data.duration) {
    statusText += ` (${data.duration}ms)`;
  }
  if (data.assertion) {
    statusText += `: "${data.assertion}"`;
  }
  if (data.text && data.action === "type") {
    statusText += `: "${data.text}"`;
  }
  if (data.error) {
    statusText += ` - ${data.error}`;
  }
  
  actionStatusEl.textContent = statusText;
  actionStatusEl.className = statusClass;

  // Store debugger URL from session_start
  if (data.debuggerUrl) {
    currentDebuggerUrl = data.debuggerUrl;
  }

  // Update session info with debugger link
  if (data.session) {
    const expiresIn = data.session.expiresIn ? Math.round(data.session.expiresIn / 1000) : 0;
    sessionInfoEl.innerHTML = "";
    
    if (currentDebuggerUrl) {
      const link = document.createElement("a");
      link.href = currentDebuggerUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = `${expiresIn}s remaining`;
      link.className = "debugger-link";
      link.title = `Open debugger: ${currentDebuggerUrl}`;
      sessionInfoEl.appendChild(link);
    } else {
      sessionInfoEl.textContent = `${expiresIn}s remaining`;
    }
    sessionInfoEl.className = expiresIn < 30 ? "warning" : "";
  } else if (currentDebuggerUrl) {
    // No session data but we have a debugger URL - show it
    sessionInfoEl.innerHTML = "";
    const link = document.createElement("a");
    link.href = currentDebuggerUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open Debugger";
    link.className = "debugger-link";
    link.title = currentDebuggerUrl;
    sessionInfoEl.appendChild(link);
  } else if (data.action === "session_start") {
    sessionInfoEl.textContent = "Session started";
  }

  // Update target info for find/find_and_click actions
  if (data.element && (data.action === "find" || data.action === "find_and_click")) {
    const el = data.element;
    let targetHtml = `<strong>Target:</strong> "${el.description || "Element"}"`;
    if (el.centerX !== undefined && el.centerY !== undefined) {
      targetHtml += ` <span class="target-coords">(${Math.round(el.centerX)}, ${Math.round(el.centerY)})</span>`;
    }
    if (el.confidence !== undefined) {
      const confidencePercent = Math.round(el.confidence * 100);
      targetHtml += ` <span class="target-confidence ${confidencePercent >= 70 ? 'high' : confidencePercent >= 40 ? 'medium' : 'low'}">${confidencePercent}%</span>`;
    }
    if (el.ref) {
      targetHtml += ` <span class="target-ref">ref: ${el.ref}</span>`;
    }
    targetInfoEl.innerHTML = targetHtml;
    targetInfoEl.classList.remove("hidden");
  } else {
    targetInfoEl.classList.add("hidden");
  }

  // Load cropped image from find() response (data URL)
  if (data.imageUrl) {
    showLoading("Loading image...");
    screenshotEl.onerror = () => {
      console.error("Image failed to load");
      screenshotEl.alt = "Image failed to load";
      hideLoading();
    };
    screenshotEl.onload = () => {
      console.info("Image loaded:", screenshotEl.naturalWidth, "x", screenshotEl.naturalHeight);
      // Store natural dimensions
      screenshotNaturalWidth = screenshotEl.naturalWidth;
      screenshotNaturalHeight = screenshotEl.naturalHeight;
      // Add overlays now that we know dimensions
      addOverlays(data);
      // Hide loading state
      hideLoading();
    };
    screenshotEl.src = data.imageUrl;
    screenshotEl.style.display = "block";
  } else {
    // No image available - just show status without visual
    screenshotEl.style.display = "none";
    hideLoading();
  }
}

// 1. Create app instance
const app = new App({ name: "TestDriver Screenshot", version: "1.0.0" });

/**
 * Fetch screenshot blob from resource URI and convert to data URL
 */
async function fetchScreenshotFromResource(resourceUri: string): Promise<string | null> {
  try {
    console.info("Fetching screenshot from resource:", resourceUri);
    const result = await app.request(
      { method: "resources/read", params: { uri: resourceUri } },
      ReadResourceResultSchema,
    );

    const content = result.contents[0];
    if (!content || !("blob" in content)) {
      console.error("Resource did not contain blob data");
      return null;
    }

    // Convert base64 blob to data URL
    const dataUrl = `data:${content.mimeType || "image/png"};base64,${content.blob}`;
    console.info("Screenshot fetched successfully, blob length:", content.blob.length);
    return dataUrl;
  } catch (error) {
    console.error("Failed to fetch screenshot resource:", error);
    return null;
  }
}

// 2. Register handlers BEFORE connecting
app.onteardown = async () => {
  console.info("TestDriver app being torn down");
  return {};
};

app.ontoolinput = (params) => {
  console.info("Received tool input:", params);
  // Show loading state
  actionStatusEl.textContent = "Running action...";
  actionStatusEl.className = "loading";
  showLoading("Running action...");
};

app.ontoolresult = async (result) => {
  console.info("Received tool result:", result);
  console.info("structuredContent:", result.structuredContent);
  const data = extractData(result);
  console.info("Extracted data keys:", Object.keys(data));
  console.info("Has imageUrl:", !!data.imageUrl);
  console.info("Has screenshotResourceUri:", !!data.screenshotResourceUri);
  
  // If a screenshot resource URI is provided, fetch the screenshot from it
  if (data.screenshotResourceUri && !data.imageUrl) {
    showLoading("Fetching screenshot...");
    const imageUrl = await fetchScreenshotFromResource(data.screenshotResourceUri);
    if (imageUrl) {
      data.imageUrl = imageUrl;
    }
  }
  
  renderResult(data);
};

app.ontoolcancelled = (params) => {
  console.info("Tool cancelled:", params.reason);
  actionStatusEl.textContent = `Cancelled: ${params.reason}`;
  actionStatusEl.className = "error";
  hideLoading();
};

app.onerror = (error) => {
  console.error("App error:", error);
  actionStatusEl.textContent = `Error: ${error}`;
  actionStatusEl.className = "error";
  hideLoading();
};

app.onhostcontextchanged = handleHostContextChanged;

// 3. Connect to host
app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) {
    handleHostContextChanged(ctx);
  }
});

// Insert target info element after screenshot wrapper
const screenshotWrapper = document.querySelector(".screenshot-wrapper");
if (screenshotWrapper && screenshotWrapper.parentNode) {
  screenshotWrapper.parentNode.insertBefore(targetInfoEl, screenshotWrapper.nextSibling);
}

// 4. Add click-to-toggle zoom
containerEl.addEventListener("click", () => {
  const focalX = containerEl.dataset.focalX;
  const focalY = containerEl.dataset.focalY;
  
  if (focalX && focalY) {
    isZoomed = !isZoomed;
    applyZoom(parseFloat(focalX), parseFloat(focalY), isZoomed);
  }
});
