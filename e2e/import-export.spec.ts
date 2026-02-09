import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

test('export succeeds and invalid import rolls back current save', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create League' }).click()

  await page.getByRole('link', { name: 'Settings' }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Save' }).click()
  const download = await downloadPromise

  expect(download.suggestedFilename()).toBe('cricket-gm-save.json')
  await expect(page.getByText('Exported save successfully.')).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'corrupt-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{invalid-json', 'utf8'),
  })

  await expect(page.getByText('Import rejected: invalid JSON')).toBeVisible()

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page.getByText('Season Status')).toBeVisible()
})
