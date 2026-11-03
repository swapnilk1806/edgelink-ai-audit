import assert from "node:assert/strict";
import { test } from "node:test";
import { crawlWebsite, WebsiteTimeoutError } from "./crawler";

test("crawler reports website request timeouts with an actionable message", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  };

  try {
    await assert.rejects(
      crawlWebsite("https://203.0.113.1"),
      (error: unknown) => {
        assert.ok(error instanceof WebsiteTimeoutError);
        assert.equal(error.timeoutMs, 30000);
        assert.match(error.message, /website did not respond within 30 seconds/i);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
