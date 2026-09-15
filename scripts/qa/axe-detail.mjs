import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BASE = 'http://localhost:5173'
const AXE_SRC = fs.readFileSync(path.resolve('node_modules/axe-core/axe.min.js'), 'utf8')

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
await page.fill('input[type="email"]', 'aisha@loopwavedemo.com')
await page.fill('input[type="password"]', 'Demo1234!')
await page.click('button[type="submit"]')
await page.waitForURL('**/app/dashboard', { timeout: 15000 })

const pages = ['/app/contacts', '/app/pipeline', '/app/inbox']
for (const p of pages) {
  await page.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.addScriptTag({ content: AXE_SRC })
  const results = await page.evaluate(async () => {
    // eslint-disable-next-line no-undef
    return await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })
  })
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  console.log(`\n=== ${p} ===`)
  for (const v of serious) {
    console.log(`\n-- ${v.id} (${v.impact}) --`)
    for (const node of v.nodes) {
      console.log('HTML:', node.html)
      console.log('target:', JSON.stringify(node.target))
    }
  }
}

await browser.close()
