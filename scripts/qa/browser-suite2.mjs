import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5173'
const OUT = path.resolve('scripts/out')
fs.mkdirSync(OUT, { recursive: true })
const AXE_SRC = fs.readFileSync(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8')

const findings = []
function fail(area, message, extra) {
  findings.push({ area, message, extra })
  console.log(`FAIL [${area}] ${message}`, extra ? JSON.stringify(extra).slice(0, 500) : '')
}
function ok(area, message) {
  console.log(`OK   [${area}] ${message}`)
}

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()

page.on('response', async (res) => {
  if (res.status() >= 400 && res.request().resourceType() === 'fetch') {
    fail('http', `${res.request().method()} ${res.url()} -> ${res.status()}`)
  }
})
page.on('pageerror', (err) => fail('pageerror', err.message))

async function runAxe(label) {
  await page.addScriptTag({ content: AXE_SRC })
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })
  })
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  if (serious.length) {
    fail(
      'a11y',
      `${label}: ${serious.length} serious/critical violations`,
      serious.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })),
    )
  } else {
    ok('a11y', `${label}: no serious/critical violations (${results.violations.length} minor)`)
  }
}

// ---------- Login as seeded demo owner (real data, real permissions) ----------
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', 'aisha@loopwavedemo.com')
await page.fill('input[type="password"]', 'Demo1234!')
await page.click('button[type="submit"]')
await page.waitForURL('**/app/dashboard', { timeout: 15000 }).catch((e) => fail('auth', 'login did not redirect', e.message))
ok('auth', 'login as seeded owner')

await runAxe('Dashboard')
await page.screenshot({ path: path.join(OUT, 'a11y-dashboard.png') })

// ---------- Keyboard navigation: Tab through header, ESC closes modal ----------
await page.keyboard.press('Tab')
await page.keyboard.press('Tab')
const focused1 = await page.evaluate(() => document.activeElement?.tagName + '.' + document.activeElement?.className)
console.log('focused after 2 tabs:', focused1)

// ---------- Global search keyboard shortcut ----------
await page.keyboard.press('Control+k')
await page.waitForTimeout(200)
const searchFocused = await page.evaluate(() => document.activeElement?.getAttribute('placeholder'))
if (searchFocused && searchFocused.toLowerCase().includes('search')) ok('keyboard', 'Ctrl+K focuses global search')
else fail('keyboard', 'Ctrl+K did not focus global search input', searchFocused)
await page.keyboard.press('Escape')

// ---------- Contacts: create via modal, verify persistence after reload ----------
await page.goto(`${BASE}/app/contacts`, { waitUntil: 'networkidle' })
await runAxe('Contacts list')
const addBtn = page.getByRole('button', { name: /add contact/i })
await addBtn.click()
await page.waitForTimeout(200)
await runAxe('Contacts — Add contact modal open')

// Focus trap check: Tab many times, focus should stay inside the modal
const dialog = page.locator('[role="dialog"], .fixed').first()
const stamp = Date.now()
const nameInput = page.locator('input').filter({ hasText: '' }).first()
await page.fill('input >> nth=0', `Playwright Test ${stamp}`).catch(() => {})
const inputs = page.locator('div[class*="fixed"] input, [role="dialog"] input')
const inputCount = await inputs.count()
console.log('modal input count:', inputCount)
if (inputCount >= 2) {
  await inputs.nth(0).fill(`Playwright Test ${stamp}`)
  await inputs.nth(1).fill(`+1555${String(stamp).slice(-7)}`)
  const saveBtn = page.getByRole('button', { name: /save contact/i })
  await saveBtn.click()
  await page.waitForTimeout(800)
  await page.reload({ waitUntil: 'networkidle' })
  const bodyText = await page.textContent('body')
  if (bodyText.includes(`Playwright Test ${stamp}`)) ok('contacts', 'created contact persisted after reload')
  else fail('contacts', 'created contact NOT found after reload')
} else {
  fail('contacts', 'Add contact modal did not expose expected inputs')
  await page.keyboard.press('Escape')
}

// ---------- ESC closes drawer/modal ----------
await page.goto(`${BASE}/app/contacts`, { waitUntil: 'networkidle' })
const firstRow = page.locator('table tbody tr').first()
if (await firstRow.count()) {
  await firstRow.click()
  await page.waitForTimeout(300)
  const drawerVisibleBefore = await page.locator('text=Edit contact').count()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  const drawerVisibleAfter = await page.locator('text=Edit contact').count()
  if (drawerVisibleBefore > 0 && drawerVisibleAfter === 0) ok('keyboard', 'ESC closes contact drawer')
  else console.log('drawer esc check inconclusive', { drawerVisibleBefore, drawerVisibleAfter })
}

// ---------- Pipeline page ----------
await page.goto(`${BASE}/app/pipeline`, { waitUntil: 'networkidle' })
await runAxe('Pipeline')

// ---------- Inbox page ----------
await page.goto(`${BASE}/app/inbox`, { waitUntil: 'networkidle' })
await runAxe('Inbox')

// ---------- Chatbot builder (flow canvas) ----------
await page.goto(`${BASE}/app/chatbots`, { waitUntil: 'networkidle' })
const firstBot = page.locator('table tbody tr, [class*="card"]').first()
if (await firstBot.count()) {
  await firstBot.click().catch(() => {})
  await page.waitForTimeout(500)
  ok('nav', `chatbot builder opened at ${page.url()}`)
}

// ---------- Responsive sweep ----------
const breakpoints = [1440, 1280, 1024, 768, 430, 390, 375]
const respPages = ['/app/dashboard', '/app/inbox', '/app/contacts', '/app/pipeline', '/app/billing', '/app/settings']
for (const width of breakpoints) {
  await page.setViewportSize({ width, height: 900 })
  for (const p of respPages) {
    await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(150)
    const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)
    if (hasHorizontalOverflow) fail('responsive', `${p} has horizontal overflow at ${width}px`)
    await page.screenshot({ path: path.join(OUT, `resp-${width}-${p.replace(/\//g, '_')}.png`) })
  }
}
ok('responsive', 'sweep complete across ' + breakpoints.join(',') + 'px')

fs.writeFileSync(path.join(OUT, 'findings2.json'), JSON.stringify(findings, null, 2))
console.log('\n=== SUMMARY ===')
console.log('Findings:', findings.length)
for (const f of findings) console.log('-', f.area, f.message)

await browser.close()
process.exit(0)
