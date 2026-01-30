/**
 * Shared provision types for MCP Server
 * These types mirror the SDK's ProvisionAPI interface
 * 
 * When adding new provision types to the SDK, add them here as well.
 * Reference: sdk.d.ts ProvisionAPI interface
 */

import { z } from "zod";

// ====================================
// Provision Type Definitions
// ====================================

/**
 * All available provision types
 * Must match the SDK's ProvisionAPI methods
 */
export const ProvisionTypes = ["chrome", "chromeExtension", "vscode", "installer", "electron"] as const;
export type ProvisionType = typeof ProvisionTypes[number];

// ====================================
// Provision Options Schemas
// ====================================

/**
 * Options for provision.chrome
 * Matches SDK: ProvisionChromeOptions
 */
export const ProvisionChromeOptionsSchema = z.object({
  /** URL to navigate to (default: 'https://example.com') */
  url: z.string().optional().describe("URL to navigate to"),
  /** Start maximized (default: true) */
  maximized: z.boolean().optional().describe("Start maximized"),
  /** Use guest mode (default: false) */
  guest: z.boolean().optional().describe("Use guest mode"),
});
export type ProvisionChromeOptions = z.infer<typeof ProvisionChromeOptionsSchema>;

/**
 * Options for provision.chromeExtension
 * Matches SDK: ProvisionChromeExtensionOptions
 */
export const ProvisionChromeExtensionOptionsSchema = z.object({
  /** Local filesystem path to the unpacked extension directory */
  extensionPath: z.string().optional().describe("Path to unpacked extension directory"),
  /** Chrome Web Store extension ID */
  extensionId: z.string().optional().describe("Chrome Web Store extension ID"),
  /** Start maximized (default: true) */
  maximized: z.boolean().optional().describe("Start maximized"),
});
export type ProvisionChromeExtensionOptions = z.infer<typeof ProvisionChromeExtensionOptionsSchema>;

/**
 * Options for provision.vscode
 * Matches SDK: ProvisionVSCodeOptions
 */
export const ProvisionVSCodeOptionsSchema = z.object({
  /** Path to workspace or folder to open */
  workspace: z.string().optional().describe("Path to workspace or folder to open"),
  /** Array of extension IDs to install */
  extensions: z.array(z.string()).optional().describe("Extension IDs to install"),
});
export type ProvisionVSCodeOptions = z.infer<typeof ProvisionVSCodeOptionsSchema>;

/**
 * Options for provision.installer
 * Matches SDK: ProvisionInstallerOptions
 */
export const ProvisionInstallerOptionsSchema = z.object({
  /** URL to download the installer from (required) */
  url: z.string().describe("URL to download the installer from"),
  /** Filename to save as (auto-detected from URL if not provided) */
  filename: z.string().optional().describe("Filename to save as"),
  /** Application name to focus after install */
  appName: z.string().optional().describe("Application name to focus after install"),
  /** Whether to launch the app after installation (default: true) */
  launch: z.boolean().optional().describe("Launch app after installation"),
});
export type ProvisionInstallerOptions = z.infer<typeof ProvisionInstallerOptionsSchema>;

/**
 * Options for provision.electron
 * Matches SDK: ProvisionElectronOptions
 */
export const ProvisionElectronOptionsSchema = z.object({
  /** Path to Electron app (required) */
  appPath: z.string().describe("Path to Electron app"),
  /** Additional electron args */
  args: z.array(z.string()).optional().describe("Additional Electron arguments"),
});
export type ProvisionElectronOptions = z.infer<typeof ProvisionElectronOptionsSchema>;

// ====================================
// Session Start Input Schema
// ====================================

/**
 * Complete session_start input schema
 * Supports all provision types with their respective options
 */
export const SessionStartInputSchema = z.object({
  /** Provision type - determines which application to launch */
  type: z.enum(ProvisionTypes).default("chrome").describe(
    "Provision type: 'chrome' (browser), 'chromeExtension' (browser with extension), 'vscode' (VS Code), 'installer' (download and install app), 'electron' (Electron app)"
  ),
  
  // Chrome options
  /** URL to navigate to (for chrome/chromeExtension) */
  url: z.string().optional().describe("URL to navigate to (for chrome)"),
  /** Start maximized (for chrome/chromeExtension) */
  maximized: z.boolean().optional().describe("Start browser maximized"),
  /** Use guest mode (for chrome) */
  guest: z.boolean().optional().describe("Use Chrome guest mode"),
  
  // Chrome extension options
  /** Local path to unpacked extension (for chromeExtension) */
  extensionPath: z.string().optional().describe("Path to unpacked extension directory"),
  /** Chrome Web Store extension ID (for chromeExtension) */
  extensionId: z.string().optional().describe("Chrome Web Store extension ID"),
  
  // VSCode options
  /** Workspace path (for vscode) */
  workspace: z.string().optional().describe("Path to workspace or folder (for vscode)"),
  /** Extension IDs to install (for vscode) */
  extensions: z.array(z.string()).optional().describe("VSCode extension IDs to install"),
  
  // Installer options
  /** URL to download installer from (for installer, required when type='installer') */
  installerUrl: z.string().optional().describe("URL to download installer from"),
  /** Filename for installer (for installer) */
  installerFilename: z.string().optional().describe("Filename for downloaded installer"),
  /** App name to focus after install (for installer) */
  appName: z.string().optional().describe("App name to focus after installation"),
  /** Launch app after install (for installer) */
  launch: z.boolean().optional().describe("Launch app after installation"),
  
  // Electron options
  /** Path to Electron app (for electron, required when type='electron') */
  appPath: z.string().optional().describe("Path to Electron app"),
  /** Electron args (for electron) */
  electronArgs: z.array(z.string()).optional().describe("Additional Electron arguments"),
  
  // Common session options
  /** Operating system for the sandbox */
  os: z.enum(["linux", "windows"]).default("linux").describe("Sandbox OS"),
  /** Keep sandbox alive duration in ms (default: 5 minutes) */
  keepAlive: z.number().default(300000).describe("Keep sandbox alive for this many ms"),
  /** Path to test file being built */
  testFile: z.string().optional().describe("Path to test file being built"),
  /** Reconnect to last sandbox */
  reconnect: z.boolean().default(false).describe("Reconnect to last sandbox"),
  /** API endpoint URL */
  apiRoot: z.string().optional().describe("API endpoint URL"),
  
  // Self-hosted connection options
  /** Direct IP address of self-hosted instance (bypasses cloud provisioning) */
  ip: z.string().optional().describe("Direct IP address of self-hosted Windows instance (e.g., from AWS). When provided, connects directly to this IP instead of using cloud provisioning."),
});

export type SessionStartInput = z.infer<typeof SessionStartInputSchema>;

/**
 * Helper to extract provision-specific options from session start input
 */
export function getProvisionOptions(params: SessionStartInput) {
  switch (params.type) {
    case "chrome":
      return {
        url: params.url || "https://example.com",
        maximized: params.maximized,
        guest: params.guest,
      };
    
    case "chromeExtension":
      return {
        extensionPath: params.extensionPath,
        extensionId: params.extensionId,
        maximized: params.maximized,
      };
    
    case "vscode":
      return {
        workspace: params.workspace,
        extensions: params.extensions,
      };
    
    case "installer":
      return {
        url: params.installerUrl || "",
        filename: params.installerFilename,
        appName: params.appName,
        launch: params.launch,
      };
    
    case "electron":
      return {
        appPath: params.appPath || "",
        args: params.electronArgs,
      };
    
    default:
      return {};
  }
}
