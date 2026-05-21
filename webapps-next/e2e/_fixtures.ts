import { test as base, expect, type Page } from "@playwright/test";

type Fixtures = {
  loginAs: (username: string, password: string) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  loginAs: async ({ page }: { page: Page }, use) => {
    await use(async (username: string, password: string) => {
      await page.goto("/login");
      await page.getByLabel(/^Username$/i).fill(username);
      await page.getByLabel(/^Password$/i).fill(password);
      await page.getByRole("button", { name: /^Login$/i }).click();
      // Wait until we leave /login. The middleware sends authenticated users
      // away from /login automatically.
      await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
        timeout: 10000,
      });
    });
  },
});

export { expect };
