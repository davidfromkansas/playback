import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const out = process.env.TOKYO_OUTPUT || 'output/tokyo-verification/round-1'
await fs.mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.CHROME_CHANNEL || 'chrome' })
const results = []
try {
  for (const [device, width, height] of [['desktop', 1280, 760], ['phone', 390, 800]]) {
    for (const sky of (process.env.TOKYO_SKIES || 'day,sunset,night').split(',')) {
      const page = await browser.newPage({ viewport: { width, height }, isMobile: device === 'phone', hasTouch: device === 'phone' })
      const errors = []
      page.on('pageerror', (e) => errors.push(e.message))
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()) })
      await page.goto(`${process.env.TOKYO_URL || 'http://127.0.0.1:5173'}/?sky=${sky}&verifyTokyo=1`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.getByText('Try it with sample CDs').waitFor({ timeout: 60000 })
      await page.screenshot({ path: `${out}/${device}-${sky}-welcome.png` })
      await page.getByText('Try it with sample CDs').click()
      await page.waitForFunction(() => window.__tokyo?.backdropCalls > 0, undefined, { timeout: 60000 })
      await page.waitForTimeout(7000)
      await page.screenshot({ path: `${out}/${device}-${sky}.png` })
      const stats = await page.evaluate(() => window.__tokyo)
      const failures = []
      const diagnostics = []
      if (stats.backdropCalls >= 120) diagnostics.push('Above former draw-call target')
      if (stats.backdropTriangles >= (device === 'phone' ? 80000 : 150000)) diagnostics.push('Above former triangle target')
      if (!stats.names.some((n) => n.startsWith('Train'))) failures.push('Missing train')
      if (!stats.names.some((n) => n.startsWith('Sign_'))) failures.push('Missing signs')
      if (!stats.names.some((n) => n.startsWith('Billboard_'))) failures.push('Missing screens')
      for (const role of ['WindowsLit', 'NeonGlow', 'VendGlow', 'TrainWindow', 'TowerLight']) {
        if (!stats.roles.includes(role)) failures.push(`Missing ${role}`)
      }
      if (errors.length) failures.push('Browser console errors')
      results.push({ device, sky, stats, errors, failures, diagnostics })
      console.log(JSON.stringify({ device, sky, calls: stats.backdropCalls, triangles: stats.backdropTriangles, errors, failures }))
      if (device === 'desktop' && sky === 'day') {
        const signs = await page.evaluate(() => window.__tokyoSigns?.() || [])
        for (const [i, url] of signs.entries()) await fs.writeFile(`${out}/sign-${i}.png`, Buffer.from(url.split(',')[1], 'base64'))
        assert(signs.length >= 8, 'All eight signs must have loaded textures')
      }
      if (device === 'desktop') {
        await page.evaluate(() => window.__tokyoCloseup?.())
        await page.waitForTimeout(1000)
        await page.screenshot({ path: `${out}/closeup-${sky}.png` })
      }
      await page.close()
    }
  }
} finally {
  await browser.close()
  await fs.writeFile(`${out}/checks.json`, JSON.stringify(results, null, 2))
}
const model = await fs.stat('public/models/rooftop.glb')
console.log('Model bytes:', model.size)
let textureBytes = 0
for (const name of await fs.readdir('public/textures/street')) {
  if (/\.(webp|png)$/.test(name)) textureBytes += (await fs.stat(`public/textures/street/${name}`)).size
}
console.log('Texture bytes:', textureBytes)
assert(results.every((r) => r.failures.length === 0), 'See checks.json for failures')
