import { expect, test } from "@playwright/test";

test("홈 화면이 열리고 제목이 보인다", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("MP3 정리");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("MP3 정리");
});
