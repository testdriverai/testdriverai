/**
 * Unit tests for http-auth.ts
 *
 * Focus: the OAuth hop this server puts in front of Auth0. Auth0 rejects a
 * DCR-registered (third-party) client that reaches `/authorize` without an
 * `audience` — "The userinfo audience is not allowed for third party clients"
 * — and ignores the RFC 8707 `resource` parameter MCP clients send instead.
 * These tests pin the three things that together avoid that:
 *
 *   1. we advertise ourselves, not Auth0, as the authorization server,
 *   2. our RFC 8414 document routes only `/authorize` through us,
 *   3. that redirect injects the API audience and preserves state/PKCE.
 */

import type { IncomingMessage } from "http";
import { describe, it, expect, afterEach } from "vitest";
import {
  authorizationServerMetadata,
  authorizeRedirectUrl,
  protectedResourceMetadata,
} from "./http-auth.js";

const AUTH0 = "https://replayable.us.auth0.com";
const AUDIENCE = "https://api.testdriver.ai";

/** Minimal IncomingMessage stand-in: only headers and socket are read. */
function fakeReq(
  headers: Record<string, string> = {},
  encrypted = false,
): IncomingMessage {
  return {
    headers: { host: "mcp.example.com", ...headers },
    socket: { encrypted },
  } as unknown as IncomingMessage;
}

/** The authorize request Claude sends today, which Auth0 refused. */
function clientAuthorizeUrl(
  extra: Record<string, string> = {},
): URL {
  const url = new URL("https://mcp.example.com/authorize");
  const params: Record<string, string> = {
    response_type: "code",
    client_id: "dcr-generated-client",
    redirect_uri: "https://claude.ai/api/mcp/auth_callback",
    scope: "openid profile email offline_access",
    state: "opaque-state",
    code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    code_challenge_method: "S256",
    resource: "https://mcp.example.com/mcp",
    ...extra,
  };
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url;
}

afterEach(() => {
  delete process.env.TD_MCP_PUBLIC_URL;
  delete process.env.TD_MCP_RESOURCE;
});

// ---------------------------------------------------------------------------
// protectedResourceMetadata (RFC 9728)
// ---------------------------------------------------------------------------

describe("protectedResourceMetadata", () => {
  it("advertises this server as the authorization server, not Auth0", () => {
    const doc = protectedResourceMetadata(fakeReq(), "/mcp");
    // Pointing straight at Auth0 is what produced the userinfo-audience error.
    expect(doc.authorization_servers).toEqual(["http://mcp.example.com"]);
    expect(JSON.stringify(doc.authorization_servers)).not.toContain("auth0");
  });

  it("keeps the MCP endpoint as the RFC 8707 resource identifier", () => {
    const doc = protectedResourceMetadata(fakeReq(), "/mcp");
    expect(doc.resource).toBe("http://mcp.example.com/mcp");
  });

  it("honours a TLS-terminating proxy's forwarded scheme and host", () => {
    const doc = protectedResourceMetadata(
      fakeReq({
        "x-forwarded-proto": "https",
        "x-forwarded-host": "td-test-mcp-server.fly.dev",
      }),
      "/mcp",
    );
    expect(doc.authorization_servers).toEqual([
      "https://td-test-mcp-server.fly.dev",
    ]);
  });
});

// ---------------------------------------------------------------------------
// authorizationServerMetadata (RFC 8414)
// ---------------------------------------------------------------------------

describe("authorizationServerMetadata", () => {
  it("names itself as issuer so discovery validation matches the fetch URL", () => {
    const doc = authorizationServerMetadata(
      fakeReq({ "x-forwarded-proto": "https" }),
    );
    expect(doc.issuer).toBe("https://mcp.example.com");
    expect(doc.authorization_endpoint).toBe("https://mcp.example.com/authorize");
  });

  it("sends token exchange, registration and JWKS straight to Auth0", () => {
    const doc = authorizationServerMetadata(fakeReq());
    // No credentials or codes should route through this server.
    expect(doc.token_endpoint).toBe(`${AUTH0}/oauth/token`);
    expect(doc.registration_endpoint).toBe(`${AUTH0}/oidc/register`);
    expect(doc.jwks_uri).toBe(`${AUTH0}/.well-known/jwks.json`);
  });

  it("advertises PKCE, as OAuth 2.1 public clients require", () => {
    const doc = authorizationServerMetadata(fakeReq());
    expect(doc.code_challenge_methods_supported).toEqual(["S256"]);
    expect(doc.token_endpoint_auth_methods_supported).toContain("none");
  });

  it("lets TD_MCP_PUBLIC_URL override a host the proxy hop rewrote", () => {
    process.env.TD_MCP_PUBLIC_URL = "https://mcp.testdriver.ai/";
    const doc = authorizationServerMetadata(fakeReq());
    expect(doc.issuer).toBe("https://mcp.testdriver.ai");
    expect(doc.authorization_endpoint).toBe(
      "https://mcp.testdriver.ai/authorize",
    );
  });
});

// ---------------------------------------------------------------------------
// authorizeRedirectUrl — the fix itself
// ---------------------------------------------------------------------------

describe("authorizeRedirectUrl", () => {
  it("injects the API audience Auth0 needs from third-party clients", () => {
    const target = new URL(authorizeRedirectUrl(clientAuthorizeUrl()));
    expect(target.origin + target.pathname).toBe(`${AUTH0}/authorize`);
    expect(target.searchParams.get("audience")).toBe(AUDIENCE);
  });

  it("passes state, PKCE and redirect_uri through untouched", () => {
    const source = clientAuthorizeUrl();
    const target = new URL(authorizeRedirectUrl(source));
    for (const key of [
      "response_type",
      "client_id",
      "redirect_uri",
      "scope",
      "state",
      "code_challenge",
      "code_challenge_method",
    ]) {
      expect(target.searchParams.get(key)).toBe(source.searchParams.get(key));
    }
  });

  it("drops the resource indicator Auth0 ignores", () => {
    const target = new URL(authorizeRedirectUrl(clientAuthorizeUrl()));
    expect(target.searchParams.has("resource")).toBe(false);
  });

  it("replaces a client-supplied audience rather than duplicating it", () => {
    const target = new URL(
      authorizeRedirectUrl(
        clientAuthorizeUrl({ audience: "https://wrong.example.com" }),
      ),
    );
    expect(target.searchParams.getAll("audience")).toEqual([AUDIENCE]);
  });

  it("forwards repeated parameters without collapsing them", () => {
    const source = clientAuthorizeUrl();
    source.searchParams.append("prompt", "consent");
    source.searchParams.append("prompt", "login");
    const target = new URL(authorizeRedirectUrl(source));
    expect(target.searchParams.getAll("prompt")).toEqual(["consent", "login"]);
  });
});
