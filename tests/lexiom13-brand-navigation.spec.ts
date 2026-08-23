import { expect, test } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:8081/gt2/Lexiom_1_3/index.html?welcome=1';
const BRAND_ROOT_ID = 'GT_Philosophy.BrandLexiom.a1000005.osn';
const DEEPEST_FIRST_BRANCH_ID =
  'GT_Philosophy.BrandLexiom.BrandStrategy.MarketPositioning.CategoryDefinition.PrimaryCategory.CategoryStatement.a1000036.osn';

test.use({ channel: 'chrome', video: 'off' });

test('BrandLexiom is navigable through five descendant generations', async ({ page }) => {
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await page.locator('#lexiom-welcome-modal-dismiss').click();

  await page
    .locator('.lexiom-osn-node-main[data-osn-id="GT_Philosophy.a1000001.osn"]')
    .click();
  await page.locator(`.lexiom-osn-node-main[data-osn-id="${BRAND_ROOT_ID}"]`).click();

  await expect(
    page.locator(`.lexiom-osn-node-main.is-selected[data-osn-id="${BRAND_ROOT_ID}"]`)
  ).toBeVisible();
  await expect(page.locator('.lexiom-osn-node-label', { hasText: 'BrandStrategy' })).toBeVisible();
  await expect(page.locator('.lexiom-osn-node-label', { hasText: 'BrandExpression' })).toBeVisible();

  for (let generation = 0; generation < 5; generation += 1) {
    await page.keyboard.press('ArrowDown');
  }

  await expect(
    page.locator(
      `.lexiom-osn-node-main.is-selected[data-osn-id="${DEEPEST_FIRST_BRANCH_ID}"]`
    )
  ).toBeVisible();
});
