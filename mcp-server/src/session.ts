/**
 * Session state management for TestDriver MCP Server
 * Tracks sandbox sessions for MCP server
 */

export interface SessionState {
  sessionId: string;
  sandboxId: string | null;
  status: "initializing" | "active" | "expired" | "error";
  os: "linux" | "windows";
  resolution: string;
  createdAt: number;
  expiresAt: number;
  keepAlive: number;
  testFile: string | null;
  lastScreenshot: string | null;
  errorMessage?: string;
}

// Generate unique session ID
function generateSessionId(): string {
  return `td-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Session Manager - handles session state for MCP server
 */
export class SessionManager {
  private sessions: Map<string, SessionState> = new Map();
  private currentSessionId: string | null = null;

  /**
   * Create a new session
   */
  createSession(options: {
    sandboxId?: string;
    os?: "linux" | "windows";
    resolution?: string;
    keepAlive?: number;
    testFile?: string;
  }): SessionState {
    const sessionId = generateSessionId();
    const keepAlive = options.keepAlive ?? 300000; // Default 5 minutes

    const session: SessionState = {
      sessionId,
      sandboxId: options.sandboxId ?? null,
      status: "initializing",
      os: options.os ?? "linux",
      resolution: options.resolution ?? "1366x768",
      createdAt: Date.now(),
      expiresAt: Date.now() + keepAlive,
      keepAlive,
      testFile: options.testFile ?? null,
      lastScreenshot: null,
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;

    return session;
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): SessionState | null {
    if (!this.currentSessionId) return null;
    return this.sessions.get(this.currentSessionId) ?? null;
  }

  /**
   * Get a session by ID
   */
  getSession(sessionId: string): SessionState | null {
    return this.sessions.get(sessionId) ?? null;
  }

  /**
   * Update session state
   */
  updateSession(
    sessionId: string,
    updates: Partial<SessionState>
  ): SessionState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const updated = { ...session, ...updates };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  /**
   * Mark session as active with sandbox ID
   */
  activateSession(sessionId: string, sandboxId: string): SessionState | null {
    return this.updateSession(sessionId, {
      sandboxId,
      status: "active",
    });
  }

  /**
   * Extend session expiry time
   */
  extendSession(sessionId: string, additionalMs: number): SessionState | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return this.updateSession(sessionId, {
      expiresAt: session.expiresAt + additionalMs,
    });
  }

  /**
   * Check if session is still valid
   */
  isSessionValid(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    if (session.status === "expired" || session.status === "error") return false;
    if (Date.now() > session.expiresAt) {
      this.updateSession(sessionId, { status: "expired" });
      return false;
    }
    return true;
  }

  /**
   * Get time remaining until session expires
   */
  getTimeRemaining(sessionId: string): number {
    const session = this.sessions.get(sessionId);
    if (!session) return 0;
    return Math.max(0, session.expiresAt - Date.now());
  }

  /**
   * Mark session as expired/ended
   */
  endSession(sessionId: string): void {
    this.updateSession(sessionId, { status: "expired" });
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
    return this.sessions.delete(sessionId);
  }

  /**
   * Get session summary for status reporting
   */
  getSessionSummary(sessionId: string): {
    sessionId: string;
    status: string;
    sandboxId: string | null;
    timeRemaining: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId: session.sessionId,
      status: session.status,
      sandboxId: session.sandboxId,
      timeRemaining: this.getTimeRemaining(sessionId),
    };
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
