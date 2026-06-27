import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("catchments map renders search, filters and an accessible group list", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("complementary", { name: /search, filters and results/i }),
  ).toBeVisible();
  await expect(page.getByPlaceholder(/search by name/i)).toBeVisible();
  await expect(page.getByRole("list", { name: "Matching groups" })).toBeVisible();
});

test("searching filters the group list", async ({ page }) => {
  await page.goto("/");
  const list = page.getByRole("list", { name: "Matching groups" });
  await page.getByPlaceholder(/search by name/i).fill("Pomahaka");
  await expect(list.getByRole("button")).toHaveCount(1);
  await expect(list).toContainText("Pomahaka");
});

test("@a11y home page has no critical accessibility violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(serious).toEqual([]);
});
