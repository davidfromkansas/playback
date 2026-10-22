import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const engines = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const engine = process.env.BROWSER || 'chromium'
const browser = await engines[engine].launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}), ...(engine === 'chromium' ? { channel: 'chrome' } : {}) })
const errors = []
const samples = []
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('crash', () => errors.push('Page crashed'))
  await page.goto(`${process.env.TOKYO_URL || 'http://127.0.0.1:4173'}/?sky=night&verifyTokyo=1&animateTrain=1`)
  await page.getByText('Try it with sample CDs').click()
  await page.locator('canvas').evaluate((canvas) => {
    window.__contextLosses = 0
    canvas.addEventListener('webglcontextlost', () => window.__contextLosses++)
  })
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const viewport of [{ width: 390, height: 800 }, { width: 800, height: 390 }]) {
      await page.setViewportSize(viewport)
      await page.waitForFunction(() => window.__tokyo?.shadowSize === 2048 && window.__tokyo?.pixelRatio === 1.5, undefined, { timeout: 60000 })
      // Cross two billboard refreshes to catch retained textures after rotation/remount.
      await page.waitForTimeout(25000)
      const stats = await page.evaluate(() => ({ ...window.__tokyo, losses: window.__contextLosses }))
      assert.equal(stats.bloom, false)
      assert.equal(stats.shadowSize, 2048)
      assert.equal(stats.pixelRatio, 1.5)
      assert.equal(stats.losses, 0)
      samples.push({ cycle, viewport, textures: stats.textures, shadowSize: stats.shadowSize, pixelRatio: stats.pixelRatio })
      console.log(samples.at(-1))
    }
    if (cycle < 2) {
      await page.locator('.theme-toggle').click()
      await page.locator('main.paper').waitFor()
      await page.waitForTimeout(1500)
      await page.locator('.theme-toggle').click()
      await page.locator('main.street').waitFor()
    }
  }
  assert.deepEqual(errors, [])
  // Equivalent orientations should release their old GPU textures after remounts.
  assert(samples.at(-1).textures <= samples[1].textures + 2, 'GPU textures grow across theme switches')
} finally {
  await browser.close()
  await fs.writeFile(`output/tokyo-verification/mobile-memory-${engine}.json`, JSON.stringify({ engine, samples, errors }, null, 2))
}
