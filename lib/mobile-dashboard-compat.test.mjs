import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deprecatedMobileDashboardHandler,
  MOBILE_DASHBOARD_DEPRECATION,
  MOBILE_DASHBOARD_SUCCESSOR_LINK
} from "./mobile-dashboard-compat.js";

function assertDeprecationHeaders(response) {
  assert.equal(
    response.headers.get("Deprecation"),
    MOBILE_DASHBOARD_DEPRECATION
  );
  assert.match(
    response.headers.get("Link"),
    new RegExp(
      MOBILE_DASHBOARD_SUCCESSOR_LINK.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    )
  );
}

describe("mobile dashboard compatibility handlers", () => {
  it("delegates GET without changing its response contract", async () => {
    const request = new Request("https://admin.thebrokie.com/api/mobile/dashboard");
    const context = { params: Promise.resolve({}) };
    const expected = new Response('{"ok":false,"error":"Authentication required"}', {
      status: 401,
      statusText: "Unauthorized",
      headers: {
        "Content-Type": "application/json",
        Link: '</docs/mobile>; rel="deprecation"',
        "X-Contract": "mobile-app"
      }
    });
    let receivedArgs;
    const GET = deprecatedMobileDashboardHandler(async (...args) => {
      receivedArgs = args;
      return expected;
    });

    const actual = await GET(request, context);

    assert.strictEqual(actual, expected);
    assert.deepEqual(receivedArgs, [request, context]);
    assert.equal(actual.status, 401);
    assert.equal(actual.statusText, "Unauthorized");
    assert.equal(actual.headers.get("Content-Type"), "application/json");
    assert.equal(actual.headers.get("X-Contract"), "mobile-app");
    assert.match(actual.headers.get("Link"), /<\/docs\/mobile>/);
    assertDeprecationHeaders(actual);
    assert.equal(
      await actual.text(),
      '{"ok":false,"error":"Authentication required"}'
    );
  });

  it("delegates POST with the original request and response", async () => {
    const request = new Request(
      "https://admin.thebrokie.com/api/mobile/dashboard",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-token" },
        body: JSON.stringify({ action: "sync_sales" })
      }
    );
    const expected = Response.json(
      { ok: true, message: "Sales synced.", summary: { orders30d: 4 } },
      { status: 202, headers: { "X-Contract": "mobile-app" } }
    );
    let receivedRequest;
    const POST = deprecatedMobileDashboardHandler(async (handlerRequest) => {
      receivedRequest = handlerRequest;
      assert.deepEqual(await handlerRequest.json(), { action: "sync_sales" });
      return expected;
    });

    const actual = await POST(request);

    assert.strictEqual(receivedRequest, request);
    assert.strictEqual(actual, expected);
    assert.equal(actual.status, 202);
    assert.equal(actual.headers.get("X-Contract"), "mobile-app");
    assertDeprecationHeaders(actual);
    assert.deepEqual(await actual.json(), {
      ok: true,
      message: "Sales synced.",
      summary: { orders30d: 4 }
    });
  });
});
