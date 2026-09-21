/**
 * http-auth.ts
 *
 * OAuth 2.0 Resource Server helpers for the standalone TestDriver MCP server's
 * Streamable HTTP transport. Identity is delegated to Auth0 — this server only
 * *validates* the Bearer JWTs Auth0 issues for the TestDriver API audience.
 *
 * Auth0 cannot be advertised as the authorization server directly. MCP clients
 * discover it, register through Dynamic Client Registration — which at Auth0
 * always yields a *third-party* client — and then call `/authorize` with the
 * RFC 8707 `resource` parameter and no `audience`. Auth0 ignores `resource`,
 * falls back to its default `/userinfo` audience, and rejects the request:
 * "The userinfo audience is not allowed for third party clients." Even if it
 * succeeded, a `/userinfo`-audience token is opaque and would fail the JWT
 * verification below, which requires `aud === MCP_AUDIENCE`.
 *
 * So this server advertises *itself* as the authorization server (RFC 8414) and
 * proxies exactly one endpoint: `/authorize` redirects to Auth0 with
 * `audience=<MCP_AUDIENCE>` injected. Token exchange, client registration and
 * JWKS point straight at Auth0, so no credentials pass through us. The metadata
 * `issuer` is therefore this server while issued tokens carry Auth0's `iss`;
 * that is inherent to the proxy pattern and fine because access tokens are
 * opaque to OAuth clients — only we, the resource server, read `iss`, and we
 * check it against TRUSTED_ISSUERS.
 *
 * When OAuth is disabled (no `TD_MCP_AUTH=oauth`), everything here is a no-op so
 * local stdio / trusted-network usage is unchanged.
 */

import type { IncomingMessage } from "http";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

/** Whether OAuth enforcement is enabled for the HTTP transport. */
export function isOAuthEnabled(): boolean {
  return (process.env.TD_MCP_AUTH || "").toLowerCase() === "oauth";
}

/**
 * The Auth0 API audience every access token must be minted for. This is what we
 * inject into the proxied `/authorize` and what `authenticate()` asserts as
 * `aud`. Note this is NOT the RFC 8707 resource identifier (that is the MCP
 * endpoint URL, see `resourceUrl()`); Auth0 keys tokens on `audience` alone.
 */
const MCP_AUDIENCE =
  process.env.TD_AUTH0_AUDIENCE || "https://api.testdriver.ai";

/** Auth0 issuer(s) trusted to mint tokens. Comma-separated env override. */
const TRUSTED_ISSUERS = (
  process.env.TD_MCP_TRUSTED_ISSUERS ||
  (process.env.AUTH0_DOMAIN
    ? `https://${String(process.env.AUTH0_DOMAIN)
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "")}/`
    : "https://replayable.us.auth0.com/")
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * The Auth0 tenant we actually send users to. TRUSTED_ISSUERS may list several
 * tenants we *accept* tokens from (staging alongside production); the first is
 * the one we hand off to. Kept without a trailing slash for URL building —
 * TRUSTED_ISSUERS entries keep theirs, because `iss` matching is exact.
 */
const AUTH0_ORIGIN = (TRUSTED_ISSUERS[0] || "https://replayable.us.auth0.com/")
  .replace(/\/$/, "");

/** Scopes advertised in both metadata documents. */
const SCOPES_SUPPORTED = ["openid", "profile", "email", "offline_access"];

// One remote JWKS per issuer; jose caches keys and handles rotation.
const jwksByIssuer = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

function jwksForIssuer(issuer: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(
      new URL(`${issuer.replace(/\/$/, "")}/.well-known/jwks.json`),
    );
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

/** Scheme the client used to reach us (honours a TLS-terminating proxy). */
function requestScheme(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-proto"];
  if (forwarded) {
    return Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
  }
  const socket = req.socket as { encrypted?: boolean } | undefined;
  return socket && socket.encrypted ? "https" : "http";
}

/**
 * The public origin clients reach us on — the authorization server identifier
 * we advertise, so it must match the host the metadata was fetched from.
 * `TD_MCP_PUBLIC_URL` overrides it when the proxy hop rewrites the host.
 */
function publicOrigin(req: IncomingMessage): string {
  if (process.env.TD_MCP_PUBLIC_URL) {
    return process.env.TD_MCP_PUBLIC_URL.replace(/\/$/, "");
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${requestScheme(req)}://${host}`;
}

/** The public URL clients use to reach this server's MCP endpoint. */
function resourceUrl(req: IncomingMessage, mcpPath: string): string {
  if (process.env.TD_MCP_RESOURCE) {
    return process.env.TD_MCP_RESOURCE;
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${requestScheme(req)}://${host}${mcpPath}`;
}

/**
 * RFC 9728 protected resource metadata document.
 *
 * `authorization_servers` is *this* server, not Auth0: clients must go through
 * our `/authorize` so the Auth0 API audience gets injected (see the file
 * header). They then discover the rest from our RFC 8414 document below.
 */
export function protectedResourceMetadata(
  req: IncomingMessage,
  mcpPath: string,
): Record<string, unknown> {
  return {
    resource: resourceUrl(req, mcpPath),
    authorization_servers: [publicOrigin(req)],
    bearer_methods_supported: ["header"],
    scopes_supported: SCOPES_SUPPORTED,
    resource_documentation: "https://docs.testdriver.ai",
  };
}

/**
 * RFC 8414 authorization server metadata. Only `authorization_endpoint` is
 * ours; token exchange, Dynamic Client Registration and JWKS go straight to
 * Auth0, so no client credentials or codes pass through this server.
 */
export function authorizationServerMetadata(
  req: IncomingMessage,
): Record<string, unknown> {
  const base = publicOrigin(req);
  return {
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${AUTH0_ORIGIN}/oauth/token`,
    registration_endpoint: `${AUTH0_ORIGIN}/oidc/register`,
    revocation_endpoint: `${AUTH0_ORIGIN}/oauth/revoke`,
    jwks_uri: `${AUTH0_ORIGIN}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // OAuth 2.1 / MCP clients are public clients using PKCE.
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [
      "none",
      "client_secret_post",
      "client_secret_basic",
    ],
    scopes_supported: SCOPES_SUPPORTED,
  };
}

/**
 * Translate an inbound request to our `/authorize` into the upstream Auth0
 * authorization URL. Every client parameter is forwarded verbatim — including
 * `state`, `code_challenge` and `redirect_uri`, which stay end-to-end between
 * the client and Auth0 — with two changes:
 *
 *   - `audience` is set to MCP_AUDIENCE. This is the whole point of the hop:
 *     without it Auth0 defaults to the `/userinfo` audience and refuses the
 *     third-party (DCR-registered) client outright.
 *   - `resource` is dropped. Auth0 keys tokens on `audience`, and forwarding a
 *     resource indicator alongside it only risks the two disagreeing.
 */
export function authorizeRedirectUrl(requestUrl: URL): string {
  const target = new URL(`${AUTH0_ORIGIN}/authorize`);
  for (const [key, value] of requestUrl.searchParams) {
    if (key === "audience" || key === "resource") {
      continue;
    }
    target.searchParams.append(key, value);
  }
  target.searchParams.set("audience", MCP_AUDIENCE);
  return target.toString();
}

/** Build the `WWW-Authenticate` challenge header value. */
export function wwwAuthenticate(
  req: IncomingMessage,
  opts?: { error?: string; description?: string },
): string {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const metadataUrl = `${requestScheme(req)}://${host}/.well-known/oauth-protected-resource`;
  let challenge = `Bearer resource_metadata="${metadataUrl}"`;
  if (opts?.error) {
    challenge += `, error="${opts.error}"`;
  }
  if (opts?.description) {
    challenge += `, error_description="${opts.description}"`;
  }
  return challenge;
}

/** Extract a Bearer token from the Authorization header, or null. */
function bearerFromRequest(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth) {
    return null;
  }
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  return m ? m[1].trim() : null;
}

/** Result of an authentication attempt. */
export type AuthResult =
  | { ok: true; claims: JWTPayload; token: string }
  | { ok: false; status: number; error: string; description: string };

/**
 * Authenticate an incoming request against Auth0. Returns the verified claims
 * on success, or an error descriptor the caller turns into a 401 challenge.
 */
export async function authenticate(req: IncomingMessage): Promise<AuthResult> {
  const token = bearerFromRequest(req);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "invalid_request",
      description: "Authentication required",
    };
  }

  // Read the unverified issuer to select the right JWKS, then verify.
  let issuer: string | undefined;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf-8"),
    );
    issuer = payload.iss;
  } catch {
    issuer = undefined;
  }
  if (!issuer || !TRUSTED_ISSUERS.includes(issuer)) {
    return {
      ok: false,
      status: 401,
      error: "invalid_token",
      description: "Untrusted or missing token issuer",
    };
  }

  try {
    const { payload } = await jwtVerify(token, jwksForIssuer(issuer), {
      issuer,
      audience: MCP_AUDIENCE,
      algorithms: ["RS256"],
    });
    return { ok: true, claims: payload, token };
  } catch {
    return {
      ok: false,
      status: 401,
      error: "invalid_token",
      description: "Invalid or expired access token",
    };
  }
}
