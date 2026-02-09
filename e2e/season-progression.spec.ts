import { expect, test } from '@playwright/test'

test('season lifecycle progresses from auction to complete', async ({ page }) => {
  test.setTimeout(120_000)

  await page.goto('/')
  await page.getByRole('button', { name: 'Create League' }).click()

  await page.getByRole('link', { name: 'Auction' }).click()
  await page.getByRole('button', { name: 'Auto Complete Auction' }).click()

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByText('Phase: regular-season')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Sim Full Season' }).click()

  await expect(page.getByText('Phase: complete')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('Remaining Matches: 0')).toBeVisible()
})
