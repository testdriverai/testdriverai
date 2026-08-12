import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import http from "node:http";

const require = createRequire(import.meta.url);
const { createSDK, withRetry } = require("./sdk.js");

/**
 * A team's OpenRouter key can be revoked, run out of credit, or never be
 * configured. The API reports that as a 400 carrying an OPENROUTER_* code.
 * Two things have to hold for the user to ever see it: the request layer must
 * not retry it into a two-minute stall, and it must arrive as a real error with
 * `isConfigError` set — that flag is what stops find()/findAll() from folding it
 * into "element not found" / an empty array.
 */

const axiosError = (status, data) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data },
  });

const KEY_ERROR_BODY = {
  error:
    "Your team's OpenRouter API key has no credits remaining — HTTP 402. Add credits at https://openrouter.ai/credits.",
  code: "OPENROUTER_KEY_ERROR",
  details: { openrouterStatus: 402, source: "testdriver-locate" },
};

describe("OpenRouter key errors are not retried", () => {
  it("fails a rejected key on the first attempt", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        throw axiosError(400, KEY_ERROR_BODY);
      }),
    ).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it("fails a missing key on the first attempt", async () => {
    let attempts = 0;
    await expect(
      withRetry(async () => {
        attempts++;
        throw axiosError(400, {
          error: "OpenRouter API key is required for self-hosted plans.",
          code: "OPENROUTER_KEY_REQUIRED",
        });
      }),
    ).rejects.toThrow();
    expect(attempts).toBe(1);
  });

  it("still retries server errors and network failures", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw axiosError(500, {});
        },
        { retryConfig: { maxRetries: 2, baseDelayMs: 1 } },
      ),
    ).rejects.toThrow();
    expect(attempts).toBe(3);

    attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw Object.assign(new Error("socket hang up"), {
            code: "ECONNRESET",
          });
        },
        { retryConfig: { maxRetries: 2, baseDelayMs: 1 } },
      ),
    ).rejects.toThrow();
    expect(attempts).toBe(3);
  });
});

describe("OpenRouter key errors reach the caller", () => {
  /** Serve one 400 with the given body, then hand back its origin. */
  const serve = async (body) => {
    const server = http.createServer((req, res) => {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    });
    await new Promise((resolve) => server.listen(0, resolve));
    return {
      origin: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((resolve) => server.close(resolve)),
    };
  };

  it("throws the API's message with isConfigError set", async () => {
    const { origin, close } = await serve(KEY_ERROR_BODY);
    const emitted = [];
    const { req } = createSDK(
      { emit: (event, payload) => emitted.push({ event, payload }) },
      { TD_API_ROOT: origin },
      { get: () => "session-1" },
    );

    try {
      const error = await req("find", { element: "the login button" }).then(
        () => null,
        (e) => e,
      );

      expect(error).toBeTruthy();
      expect(error.isConfigError).toBe(true);
      expect(error.code).toBe("OPENROUTER_KEY_ERROR");
      expect(error.message).toBe(KEY_ERROR_BODY.error);
      expect(error.details).toEqual(KEY_ERROR_BODY.details);

      // The message also has to reach whoever is listening to the emitter,
      // not just the throw site.
      expect(
        emitted.some((e) => e.payload?.message === KEY_ERROR_BODY.error),
      ).toBe(true);
    } finally {
      await close();
    }
  });

  it("leaves other 400s on the existing path", async () => {
    const { origin, close } = await serve({ error: "Invalid image data" });
    const { req } = createSDK({ emit: () => {} }, { TD_API_ROOT: origin }, {
      get: () => "session-1",
    });

    try {
      const error = await req("find", { element: "x" }).then(
        () => null,
        (e) => e,
      );
      expect(error).toBeTruthy();
      expect(error.isConfigError).toBeUndefined();
    } finally {
      await close();
    }
  });
});
