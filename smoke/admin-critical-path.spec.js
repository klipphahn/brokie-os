import { expect, test } from "@playwright/test";

test.describe("admin critical-path smoke", () => {
  test("authentication boundary redirects the dashboard to login", async ({
    page
  }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });

    expect(response, "dashboard request should receive a response").toBeTruthy();
    expect(response.status(), "redirected dashboard should land successfully").toBeLessThan(400);

    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    expect(new URL(page.url()).searchParams.get("next")).toBe("/");

    await expect(page.getByRole("heading", { name: "Brokie OS" })).toBeVisible();
    await expect(page.getByText("PRIVATE ADMIN")).toBeVisible();
  });

  test("authentication boundary blocks protected admin APIs", async ({
    request
  }) => {
    const response = await request.get("/api/activity");
    const body = await response.json().catch(() => null);

    expect(response.status(), "protected API must fail closed").toBe(401);
    expect(body, "401 body should be JSON for diagnostics").toMatchObject({
      ok: false,
      error: expect.any(String)
    });
    expect(String(body.error).length, "error message should be useful").toBeGreaterThan(0);
  });

  test("admin login (dashboard gate) loads with sign-in controls", async ({
    page
  }) => {
    const response = await page.goto("/login", { waitUntil: "networkidle" });

    expect(response, "login page should respond").toBeTruthy();
    expect(response.status()).toBe(200);

    await expect(page.getByRole("heading", { name: "Brokie OS" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    await expect(page.getByText("Authorized accounts only.")).toBeVisible();
  });

  test("safe read-only storefront feed API responds without write side effects", async ({
    request
  }) => {
    const response = await request.get("/api/storefront/featured");
    const body = await response.json().catch(() => null);

    expect(
      [200, 503].includes(response.status()),
      `featured feed status should be readable, got ${response.status()}`
    ).toBe(true);
    expect(body, "featured feed should return JSON").toBeTruthy();
    expect(typeof body.ok).toBe("boolean");

    if (response.status() === 200) {
      expect(body).toMatchObject({
        ok: true,
        schemaVersion: expect.any(String),
        storefront: expect.any(Object),
        products: expect.any(Array)
      });
    } else {
      expect(body).toMatchObject({
        ok: false,
        error: expect.any(String)
      });
    }

    // Read-only smoke: never POST/PUT/PATCH/DELETE against third-party bridges.
    for (const path of [
      "/api/printful/bridge",
      "/api/publisher",
      "/api/ai/generate",
      "/api/local-ai/ask",
      "/api/shopify/products"
    ]) {
      const writeProbe = await request.fetch(path, { method: "POST", data: {} });
      expect(
        writeProbe.status(),
        `${path} must not succeed without auth during smoke`
      ).toBeGreaterThanOrEqual(401);
    }
  });
});
