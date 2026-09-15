import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5173'
const OUT = path.resolve('scripts/out')
fs.mkdirSync(OUT, { recursive: true })

const findings = []
function fail(area, message, extra) {
  findings.push({ area, message, extra })
  console.log(`FAIL [${area}] ${message}`, extra ?? '')
}
function ok(area, message) {
  console.log(`OK   [${area}] ${message}`)
}

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push({ url: page.url(), text: msg.text() })
})
page.on('pageerror', (err) => consoleErrors.push({ url: page.url(), text: `pageerror: ${err.message}` }))
page.on('response', async (res) => {
  if (res.status() >= 400) {
    let body = ''
    try {
      body = (await res.text()).slice(0, 300)
    } catch {
      /* ignore */
    }
    consoleErrors.push({ url: page.url(), text: `HTTP ${res.status()} ${res.request().method()} ${res.url()} :: ${body}` })
  }
})

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false })
}

async function gotoAndCheck(pathName, label) {
  const res = await page.goto(`${BASE}${pathName}`, { waitUntil: 'networkidle', timeout: 15000 }).catch((e) => ({ error: e }))
  if (res?.error) {
    fail('nav', `${label} (${pathName}) failed to load`, res.error.message)
    return false
  }
  await page.waitForTimeout(300)
  const bodyText = await page.textContent('body').catch(() => '')
  if (!bodyText || bodyText.trim().length === 0) {
    fail('nav', `${label} (${pathName}) rendered empty body`)
    return false
  }
  ok('nav', `${label} loaded`)
  return true
}

// ---------- 1. Public site ----------
await gotoAndCheck('/', 'Home')
await shot('01-home')
await gotoAndCheck('/pricing', 'Pricing')
await gotoAndCheck('/features', 'Features')

// ---------- 2. Signup a fresh QA tenant (avoids polluting seeded demo data) ----------
const stamp = Date.now()
await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
await page.fill('input[type="text"]', `Browser QA Co ${stamp}`).catch(() => {})
const labels = await page.locator('label').allTextContents()
console.log('signup labels:', labels)

// Fill by placeholder-less Input components: find inputs in order.
const inputs = page.locator('form input')
const count = await inputs.count()
console.log('signup input count:', count)
if (count >= 4) {
  await inputs.nth(0).fill(`Browser QA Co ${stamp}`)
  await inputs.nth(1).fill('QA Tester')
  await inputs.nth(2).fill(`qa-browser-${stamp}@test.loopwave.internal`)
  await inputs.nth(3).fill('TestPass123')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/app/dashboard', { timeout: 15000 }).catch((e) => fail('auth', 'signup did not redirect to dashboard', e.message))
  ok('auth', 'signup + redirect to dashboard')
  await shot('02-dashboard')
} else {
  fail('auth', 'signup form did not have expected 4 inputs')
}

// ---------- 3. Walk every main app page ----------
const appPages = [
  ['/app/dashboard', 'Dashboard'],
  ['/app/inbox', 'Inbox'],
  ['/app/contacts', 'Contacts'],
  ['/app/pipeline', 'Pipeline'],
  ['/app/campaigns', 'Campaigns'],
  ['/app/templates', 'Templates'],
  ['/app/chatbots', 'Chatbots'],
  ['/app/ai-agents', 'AI Agents'],
  ['/app/automations', 'Automations'],
  ['/app/forms', 'Forms'],
  ['/app/analytics', 'Analytics'],
  ['/app/team', 'Team'],
  ['/app/whatsapp', 'WhatsApp'],
  ['/app/integrations', 'Integrations'],
  ['/app/billing', 'Billing'],
  ['/app/settings', 'Settings'],
]

for (const [p, label] of appPages) {
  const before = consoleErrors.length
  await gotoAndCheck(p, label)
  await shot(`page-${label.replace(/\s+/g, '-').toLowerCase()}`)
  const newErrors = consoleErrors.slice(before)
  if (newErrors.length) fail('console', `${label} produced console errors`, newErrors.map((e) => e.text).join(' | '))
}

fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 2))
fs.writeFileSync(path.join(OUT, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2))

console.log('\n=== SUMMARY ===')
console.log('Findings:', findings.length)
console.log('Console errors total:', consoleErrors.length)

await browser.close()
process.exit(findings.length ? 1 : 0)
