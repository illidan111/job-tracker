import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signup } from './helpers'

const routes = ['/', '/applications', '/kanban', '/analytics', '/journey', '/settings']

for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
  for (const theme of ['light', 'dark']) {
    test(`all pages and forms fit ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      const data = await signup(page)
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()) })
      await page.setViewportSize({ width, height: 960 })
      await page.goto('/settings')
      await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true }).click()
      for (const route of [...routes, `/applications/${data.applications.find(app => app.company === 'Linear')!.id}`]) {
        await page.goto(route)
        await expect(page.locator('h1')).toBeVisible()
        await page.locator('.app-loading').waitFor({ state: 'detached' })
        const overflow = await page.evaluate(() => ({ viewport: innerWidth, body: document.documentElement.scrollWidth }))
        expect(overflow.body, `${route} at ${width}px`).toBeLessThanOrEqual(overflow.viewport)
        if ([375, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`${route.replaceAll('/', '-') || 'overview'}-${theme}.png`), fullPage: true })
      }
      await page.getByRole('button', { name: 'Edit application', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Edit application', exact: true })
      await expect(dialog).toBeVisible()
      const bounds = await dialog.boundingBox()
      expect(bounds!.width).toBeLessThanOrEqual(width)
      expect(bounds!.height).toBeLessThanOrEqual(960)
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      if ([375, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`form-${theme}.png`) })
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
      for (const name of ['Schedule', 'Add contact']) {
        await page.getByRole('button', { name, exact: true }).click()
        const modal = page.getByRole('dialog')
        const bounds = await modal.boundingBox()
        expect(bounds!.width).toBeLessThanOrEqual(width)
        expect(bounds!.height).toBeLessThanOrEqual(960)
        expect(await modal.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
        if ([375, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`${name.replaceAll(' ', '-')}-${theme}.png`) })
        await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
      }
      await page.getByRole('button', { name: /Notifications/ }).click()
      if ([375, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`notifications-${theme}.png`) })
      await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
      expect(errors).toEqual([])
      await page.context().clearCookies()
      await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' })
      for (const route of ['/login', '/signup']) {
        await page.goto(route)
        await expect(page.locator('.auth-form-wrap h2')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        if ([375, 1440].includes(width)) await page.screenshot({ path: testInfo.outputPath(`${route.slice(1)}-${theme}.png`), fullPage: true })
      }
    })
  }
}

for (const width of [375, 1440]) {
  for (const theme of ['light', 'dark']) {
    test(`accessibility review at ${width}px in ${theme} mode`, async ({ page }) => {
      test.setTimeout(120000)
      const data = await signup(page)
      await page.setViewportSize({ width, height: 960 })
      await page.goto('/settings')
      await page.getByRole('button', { name: theme === 'dark' ? 'Dark' : 'Light', exact: true }).click()
      for (const route of [...routes, `/applications/${data.applications.find(app => app.company === 'Linear')!.id}`]) {
        await page.goto(route)
        await expect(page.locator('h1')).toBeVisible()
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        expect(results.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), `Accessibility on ${route}`).toEqual([])
      }
      await page.getByRole('button', { name: 'Edit application', exact: true }).click()
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
      expect(results.violations).toEqual([])
      await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
      for (const name of ['Schedule', 'Add contact']) {
        await page.getByRole('button', { name, exact: true }).click()
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
        await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
      }
      await page.getByRole('button', { name: /Notifications/ }).click()
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
      await page.context().clearCookies()
      await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' })
      for (const route of ['/login', '/signup']) {
        await page.goto(route)
        await expect(page.locator('.auth-form-wrap h2')).toBeVisible()
        expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
      }
    })
  }
}
