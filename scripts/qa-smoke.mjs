import { chromium } from 'playwright-core'

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true })
const page = await browser.newPage()
page.on('console', (msg) => console.log(`[console:${msg.type()}]`, msg.text()))
page.on('pageerror', (err) => console.log('[pageerror]', err.message))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
console.log('title:', await page.title())
await page.screenshot({ path: 'scripts/out/smoke.png' })
await browser.close()
console.log('OK')
