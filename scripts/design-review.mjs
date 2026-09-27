import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

// Isolated, disposable account on the dedicated visual-review service.
const baseURL = 'http://127.0.0.1:5197'
const pass = process.argv[2] || 'review'
const output = `test-results/design-${pass}`
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL })
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()) })
const headers = { Origin: baseURL }
const signup = await context.request.post('/api/auth/signup', { headers, data: { name: 'Alex Morgan', email: `design-${crypto.randomUUID()}@example.test`, password: 'A thoughtful test passphrase' } })
if (signup.status() !== 201) throw new Error(`Signup failed: ${signup.status()}`)
const seed = await context.request.post('/api/workspace/demo', { headers, data: {} })
if (!seed.ok()) throw new Error(`Seed failed: ${seed.status()}`)
const workspace = await seed.json()
const detail = workspace.applications.find(app => app.company === 'Linear')
for (const theme of ['light', 'dark']) {
  await page.goto('/settings')
  await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true }).click()
  await page.locator(`html[data-theme="${theme}"]`).waitFor()
  for (const width of pass === 'final' ? [1440, 1024, 768, 375, 320] : [1440, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const [name, route] of [['applications', '/applications'], ['overview', '/'], ['kanban', '/kanban'], ['analytics', '/analytics'], ['settings', '/settings'], ['details', `/applications/${detail.id}`]]) {
      await page.goto(route)
      await page.locator('h1').waitFor()
      await page.locator('.app-loading').waitFor({ state: 'detached' })
      await page.screenshot({ path: `${output}/${name}-${width}-${theme}.png`, fullPage: true })
    }
    await page.getByRole('button', { name: 'Edit application', exact: true }).click()
    await page.getByRole('dialog').waitFor()
    await page.screenshot({ path: `${output}/form-${width}-${theme}.png` })
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    if (pass === 'final') {
      await page.goto('/applications')
      await page.getByRole('button', { name: 'Filters', exact: true }).click()
      await page.getByLabel('Location', { exact: true }).selectOption('Remote')
      await page.screenshot({ path: `${output}/filters-${width}-${theme}.png`, fullPage: true })
      if (width === 375) {
        await page.getByRole('button', { name: 'Open navigation' }).click()
        await page.screenshot({ path: `${output}/navigation-${theme}.png` })
        await page.getByRole('button', { name: 'Close dialog' }).click()
      }
    }
  }
}
if (pass === 'final') {
  await context.clearCookies()
  for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ colorScheme: theme })
    for (const width of [1440, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const route of ['login', 'signup']) {
        await page.goto(`/${route}`)
        await page.locator('.auth-form-wrap h2').waitFor()
        await page.screenshot({ path: `${output}/${route}-${width}-${theme}.png`, fullPage: true })
      }
    }
  }
  await context.request.post('/api/auth/signup', { headers, data: { name: 'Empty Workspace', email: `design-empty-${crypto.randomUUID()}@example.test`, password: 'A thoughtful test passphrase' } })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/applications')
  await page.getByRole('heading', { name: 'Applications', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'No applications yet' }).waitFor()
  await page.screenshot({ path: `${output}/empty-320-light.png`, fullPage: true })
  await page.getByRole('button', { name: 'Add application', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Add application', exact: true }).click()
  await page.getByText('Company is required').waitFor()
  await page.screenshot({ path: `${output}/validation-320-light.png` })
}
console.log(JSON.stringify({ output, errors }))
await browser.close()
