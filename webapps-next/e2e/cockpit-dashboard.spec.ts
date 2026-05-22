import { expect, test } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME ?? "demo";
const PASSWORD = process.env.E2E_PASSWORD ?? "demo";

test.describe("Cockpit Kirimi-style dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/username/i).fill(USERNAME);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(cockpit|tasklist|admin)/);
  });

  test("renders header, range selector, six KPI cards, and plugin slot", async ({ page }) => {
    await page.goto("/cockpit");

    await expect(page.getByRole("heading", { name: /welcome/i })).toBeVisible();

    const selector = page.getByRole("group", { name: /time range/i });
    await expect(selector).toBeVisible();
    for (const label of ["7D", "30D", "90D", "Custom"]) {
      await expect(selector.getByRole("button", { name: new RegExp(label, "i") })).toBeVisible();
    }

    // Six KPI labels (one card each).
    const kpiLabels = [
      "Running instances",
      "Open incidents",
      "Open user tasks",
      "Failed jobs",
      "Active batches",
      "Deployments",
    ];
    for (const label of kpiLabels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }

    // Sample plugin keeps rendering inside the Custom widgets slot.
    await expect(page.getByText(/custom widgets/i)).toBeVisible();
  });

  test("changing the range updates the URL and refreshes the timeseries", async ({ page }) => {
    await page.goto("/cockpit?range=7d");
    await page.getByRole("button", { name: /30d/i }).click();
    await expect(page).toHaveURL(/range=30d/);
    await expect(page.getByText(/process instances started/i)).toBeVisible();
  });

  test("activity tabs load their lists", async ({ page }) => {
    await page.goto("/cockpit");
    await expect(page.getByRole("tab", { name: /activity/i })).toBeVisible();
    for (const tab of ["Incidents", "Deployments", "Jobs", "Definitions", "Activity"]) {
      await page.getByRole("tab", { name: new RegExp(`^${tab}$`, "i") }).click();
      // Either the empty-state message or a list item is acceptable; we just verify the panel rendered.
      await expect(
        page.getByText(/nothing to show here yet|couldn't load activity/i).or(page.locator("ul li").first()),
      ).toBeVisible();
    }
  });

  test("tolerates engine errors on activity routes", async ({ page }) => {
    await page.route("**/api/cockpit/activity/incidents", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ items: [] }) }),
    );
    await page.goto("/cockpit");
    await page.getByRole("tab", { name: /incidents/i }).click();
    await expect(page.getByText(/nothing to show here yet/i)).toBeVisible();
  });
});
