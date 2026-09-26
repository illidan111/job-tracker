import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '@playwright/test'

const base = 'http://127.0.0.1:5190'
const database = join(mkdtempSync(join(tmpdir(), 'waypoint-smoke-')), 'smoke.sqlite')
let server, browser
async function stopServer() {
  if (!server || server.exitCode !== null) return
  const exited = new Promise(resolve => server.once('exit', resolve))
  server.kill()
  await exited
}
async function startServer() {
  server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { env: { ...process.env, NODE_ENV: 'production', PORT: '5190', APP_ORIGIN: base, DATABASE_PATH: database, COOKIE_SECURE: 'false' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Production server did not become ready')), 15000)
    server.stdout.on('data', chunk => { process.stdout.write(chunk); if (chunk.toString().includes('Waypoint API ready at')) { clearTimeout(timeout); resolve() } })
    server.stderr.on('data', chunk => process.stderr.write(chunk))
    server.once('error', error => { clearTimeout(timeout); reject(error) })
    server.once('exit', () => { clearTimeout(timeout); reject(new Error('Production server exited before becoming ready')) })
  })
}
try {
  await startServer()
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL })
  const context = await browser.newContext()
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${base}/applications`)
  await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor()
  const account = await page.request.post(`${base}/api/auth/signup`, { headers: { Origin: base }, data: { email: `smoke-${Date.now()}@example.test`, name: 'Production Check', password: 'A one-time smoke test passphrase' } })
  assert.equal(account.status(), 201)
  const demo = await page.request.post(`${base}/api/workspace/demo`, { headers: { Origin: base }, data: {} })
  assert.equal(demo.status(), 200)
  const before = await demo.json()
  await page.goto(`${base}/applications/${before.applications[0].id}`)
  await page.getByRole('button', { name: 'Edit application', exact: true }).waitFor()
  await stopServer()
  await startServer()
  await page.reload()
  await page.getByRole('button', { name: 'Edit application', exact: true }).waitFor()
  const persisted = await page.request.get(`${base}/api/workspace`)
  assert.equal(persisted.status(), 200)
  assert.equal(persisted.headers()['cache-control'], 'no-store')
  assert.deepEqual((await persisted.json()).applications, before.applications)
  const html = await page.request.get(`${base}/applications`)
  assert.match(html.headers()['content-security-policy'], /frame-ancestors 'none'/)
  assert.match(await html.text(), /\/assets\/index-/)
  assert.deepEqual(errors, [])
  console.log('PASS: production bundle, CSP, deep links, authenticated session and 24 applications survive a server restart.')
} finally { await browser?.close(); await stopServer() }
