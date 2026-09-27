import { test, expect } from '@playwright/test'
import { addApplication, origin, signup, workspace } from './helpers'

test.beforeEach(async ({ page }) => { await signup(page) })

test('a rejected drag rolls back the optimistic board and keeps persisted history intact', async ({ page }) => {
  const before = await workspace(page)
  const app = before.applications.find(item => item.company === 'Vercel')!
  await page.goto('/kanban')
  let release!: () => void
  const response = new Promise<void>(resolve => { release = resolve })
  await page.route('**/api/applications/*/status', async route => {
    await response
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Could not save this move. Please try again.' }) })
  })
  const handle = page.getByTestId(`card-${app.id}`).getByRole('button', { name: /Drag Vercel/ })
  const target = page.getByTestId('column-SCREENING')
  const from = (await handle.boundingBox())!, to = (await target.boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + 10, from.y + 12, { steps: 5 })
  await page.mouse.move(to.x + to.width / 2, to.y + 70, { steps: 20 })
  await page.mouse.up()
  await expect(target.getByTestId(`card-${app.id}`)).toBeVisible()
  release()
  await expect(page.getByTestId('column-APPLIED').getByTestId(`card-${app.id}`)).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Could not save this move')
  const saved = (await workspace(page)).applications.find(item => item.id === app.id)!
  expect(saved.status).toBe(app.status)
  expect(saved.timeline).toEqual(app.timeline)
})

test('a failed create keeps the draft and succeeds after retry', async ({ page }) => {
  await page.goto('/applications')
  await page.route('**/api/applications', route => route.abort('failed'))
  await page.getByRole('button', { name: 'Add application', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add application' })
  await dialog.getByLabel('Company *', { exact: true }).fill('Retry Company')
  await dialog.getByLabel('Position *', { exact: true }).fill('Product Engineer')
  await dialog.getByRole('button', { name: 'Add application', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('Check your connection')
  await expect(dialog.getByLabel('Company *', { exact: true })).toHaveValue('Retry Company')
  expect((await workspace(page)).applications).toHaveLength(24)
  await page.unroute('**/api/applications')
  await dialog.getByRole('button', { name: 'Add application', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  expect((await workspace(page)).applications).toHaveLength(25)
})

test('stale edits are rejected, keep the draft, and allow an explicit retry', async ({ page }) => {
  const app = (await workspace(page)).applications[0]
  await page.goto(`/applications/${app.id}`)
  await page.getByRole('button', { name: 'Edit application', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit application' })
  await dialog.getByLabel('Position *', { exact: true }).fill('Staff Product Engineer')
  const changed = await page.request.patch(`/api/applications/${app.id}/status`, { headers: { Origin: origin }, data: { version: app.version, status: 'OFFER' } })
  expect(changed.status()).toBe(200)
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('changed in another window')
  await expect(dialog.getByLabel('Position *', { exact: true })).toHaveValue('Staff Product Engineer')
  expect((await workspace(page)).applications.find(item => item.id === app.id)?.status).toBe('OFFER')
  await dialog.getByLabel('Status', { exact: true }).selectOption('OFFER')
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Staff Product Engineer' })).toBeVisible()
})

test('an expired session clears private state and offers sign-in', async ({ page }) => {
  await page.goto('/applications')
  await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible()
  await page.context().clearCookies()
  await page.getByRole('button', { name: 'Add application', exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add application' })
  await dialog.getByLabel('Company *', { exact: true }).fill('Expired Session')
  await dialog.getByLabel('Position *', { exact: true }).fill('Engineer')
  await dialog.getByRole('button', { name: 'Add application', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toContainText('session has ended')
  await expect(page.getByText('Linear', { exact: true })).not.toBeVisible()
})

test('database saves work when browser storage is unavailable', async ({ page }) => {
  await page.goto('/applications')
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage full', 'QuotaExceededError') } })
  await addApplication(page, 'Persistent Company')
  await page.reload()
  await expect(page.getByRole('link', { name: 'Persistent Company', exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('malformed imports leave the entire existing workspace unchanged', async ({ page }) => {
  await page.goto('/settings')
  const before = (await workspace(page)).applications
  const backups = [
    { version: 2, applications: [before[0], before[0]] },
    { version: 2, applications: [{ ...before[0], status: 'INVALID' }] },
    { version: 99, applications: before },
    { version: 2, applications: [{ ...before[0], interviews: [{ ...before[0].interviews[0], meetingUrl: 'javascript:alert(1)' }] }] },
  ]
  for (const invalid of backups) {
    await page.getByLabel('Import applications file').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) })
    await expect(page.getByRole('alert')).toContainText('Your existing data is unchanged')
    expect((await workspace(page)).applications).toEqual(before)
  }
})

test('a saved board move survives a failed reminder refresh and retry clears the error', async ({ page }) => {
  const app = (await workspace(page)).applications.find(item => item.company === 'Vercel')!
  await page.goto('/kanban')
  await expect(page.getByLabel('Move Vercel to status')).toBeVisible()
  await page.route('**/api/notifications', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Workspace refresh unavailable' }) }))
  await page.getByLabel('Move Vercel to status').selectOption('SCREENING')
  await expect(page.getByTestId('column-SCREENING').getByText('Vercel')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Workspace refresh unavailable')
  expect((await workspace(page)).applications.find(item => item.id === app.id)?.status).toBe('SCREENING')
  await page.unroute('**/api/notifications')
  await page.getByRole('button', { name: 'Refresh workspace' }).click()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('column-SCREENING').getByText('Vercel')).toBeVisible()
})

test('an unavailable backend during bootstrap offers a working retry', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.abort('failed'))
  await page.goto('/applications')
  await expect(page.getByRole('heading', { name: 'Your workspace is taking a moment' })).toBeVisible()
  await page.unroute('**/api/auth/session')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible()
})
