import { test, expect } from "@playwright/test";

test.describe("01. Authentication & Security Gate", () => {
  test("Teacher login page renders with branding and security fields", async ({ page }) => {
    await page.goto("/login");

    const emailInput = page.locator("input#email");
    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await expect(emailInput).toBeVisible();
    await expect(page.locator("input#password")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("Protected route (/dashboard) redirects unauthenticated visitors to /login", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for redirect to /login
    await page.waitForURL((url) => url.pathname.includes("/login"), { timeout: 15000 });
    expect(page.url()).toContain("/login");
  });

  test("Student login page renders with name and PIN fields", async ({ page }) => {
    await page.goto("/student/login");

    const nameInput = page.locator("input#name");
    await nameInput.waitFor({ state: "visible", timeout: 15000 });
    await expect(nameInput).toBeVisible();
    await expect(page.locator("input#pin")).toBeVisible();
  });

  test("Health check endpoint (/api/health) is accessible and operational", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(["ok", "degraded", "down"]).toContain(body.status);
    expect(body.checks.app).toBe("ok");
    expect(body.checks.migrations).toBe("ok");
  });
});
