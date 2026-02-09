import { expect, test } from '@playwright/test'

test('can create league and navigate core views', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create League' }).click()

  await expect(page.getByText('Season Status')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Season' })).toBeVisible()
  await page.getByRole('link', { name: 'Auction' }).click()
  await expect(page).toHaveURL(/\/roster$/)
})
