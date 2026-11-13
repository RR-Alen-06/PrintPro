import { test, expect } from '@playwright/test';

test.describe('PrintPro POS smoke flows', () => {
  test('loads main pages without runtime errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    for (const route of ['/', '/billing', '/bills', '/customers', '/accounting', '/settings']) {
      await page.goto(route);
      await expect(page.locator('body')).toBeVisible();
    }

    expect(errors).toEqual([]);
  });
});

