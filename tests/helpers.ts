import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Workspace } from '../src/types/application'
export const origin = 'http://127.0.0.1:5187'
export async function signup(page: Page, seed = true) {
  const email = `test-${crypto.randomUUID()}@example.test`
  const response = await page.request.post('/api/auth/signup', { headers: { Origin: origin }, data: { name: 'Alex Morgan', email, password: 'A thoughtful test passphrase' } })
  expect(response.status()).toBe(201)
  if (seed) expect((await page.request.post('/api/workspace/demo', { headers: { Origin: origin }, data: {} })).status()).toBe(200)
  return await workspace(page)
}
export async function workspace(page: Page): Promise<Workspace> {
  const response = await page.request.get('/api/workspace')
  expect(response.status()).toBe(200)
  return await response.json() as Workspace
}
export async function addApplication(page: Page, company = 'Aurora Labs') {
  await page.getByRole('button', { name: 'Add application', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add application' })
  await dialog.getByLabel('Company *', { exact: true }).fill(company)
  await dialog.getByLabel('Position *', { exact: true }).fill('Frontend Engineer')
  await dialog.getByRole('button', { name: 'Add application', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  return (await workspace(page)).applications.find(app => app.company === company)!
}
