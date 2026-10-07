import { test, expect } from "@playwright/test";

test.describe("05. Room Lifecycle & Join Gate", () => {
  test("Join room page renders code and participant inputs", async ({ page }) => {
    await page.goto("/join");

    await expect(page.locator("input#join-code")).toBeVisible();
    await expect(page.locator("input#join-name")).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });

  test("Prefilled code from URL query parameter is displayed correctly", async ({ page }) => {
    await page.goto("/join?code=ABC123");

    // Code should be prefilled
    await expect(page.locator("input[name='code']")).toHaveValue("ABC123");
    await expect(page.locator("input#join-name")).toBeVisible();
  });

  test("Error message is cleanly rendered when provided in searchParams", async ({ page }) => {
    await page.goto("/join?error=ROOM_NOT_FOUND");

    await expect(page.locator("text=ROOM_NOT_FOUND")).toBeVisible();
  });
});
