import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

test('ODD-E2E-001 single flow', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/GT1/ODD/index.html');

  await expect(
    page.getByRole('heading', { name: 'Outcome Driven Development' })
  ).toBeVisible();
  await expect(page.getByText('inferred output')).toBeVisible();
  await expect(page.getByText('inferred visual')).toBeVisible();

  const userInput = page.locator('#userIn');
  await expect(userInput).toHaveValue(
    'e.g., in 50 words, who are you vs. who am I ?'
  );
  await expect(userInput).toBeFocused();

  const busy = page.locator('#busy');
  const reply = page.locator('#reply');

  const firstInference = page.waitForResponse(
    r =>
      r.url().includes('/inference') &&
      r.request().method() === 'POST' &&
      r.status() < 500
  );
  const secondInference = page.waitForResponse(
    r =>
      r.url().includes('/inference') &&
      r.request().method() === 'POST' &&
      r.status() < 500
  );

  await userInput.press('Enter');

  await expect(busy).toBeVisible();
  await expect(busy).toContainText('inferring GT3');

  await firstInference;

  await expect(reply).not.toBeEmpty();

  await secondInference;

  const oddVisual = page.locator('#oddVisual img.odd-visual-img');
  await expect(oddVisual).toBeVisible({ timeout: 45_000 });
  await expect(oddVisual).toHaveAttribute('width', '128');
  await expect(oddVisual).toHaveAttribute('height', '128');
  await expect(reply).not.toContainText('Could not load system prompt from');
  await expect(reply).not.toContainText('System prompt is not loaded yet.');
  await expect(reply).not.toContainText('Enter a non-empty message.');

  const capture = {
    flow_id: 'ODD-E2E-001',
    captured_at: new Date().toISOString(),
    page_url: 'http://localhost:8080/GT1/ODD/index.html',
    prompt_text: await userInput.inputValue(),
    inferred_output: (await reply.innerText()).trim()
  };

  const outDir = path.join(process.cwd(), 'test-results');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, 'odd-inference-capture.json'),
    JSON.stringify(capture, null, 2),
    'utf-8'
  );
});
