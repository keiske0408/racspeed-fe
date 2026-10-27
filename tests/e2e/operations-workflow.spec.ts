import { test, expect } from "@playwright/test";

test.describe("RacSpeed Public & Authentication Workflows", () => {
  test("loads the login portal with District 3820 branding", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/RacSpeed/i);

    // Verify presence of login form fields
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test("loads the registration portal with applicant onboarding fields", async ({ page }) => {
    await page.goto("/register", { waitUntil: "domcontentloaded" });

    const emailInput = page.locator('input[type="email"]');
    const nameInput = page.locator('input[name="fullName"], input[placeholder*="Name"], input[type="text"]').first();

    await expect(emailInput).toBeVisible();
    await expect(nameInput).toBeVisible();
  });

  test("enforces Next.js 16 proxy authentication redirect on protected routes", async ({ page }) => {
    // Attempt to access protected dashboard without active session cookie
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Must be redirected to /login by src/proxy.ts
    await expect(page).toHaveURL(/.*login/);
  });

  test("exposes PWA Web App Manifest in document head", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute("href", "/manifest.webmanifest");
  });
});
