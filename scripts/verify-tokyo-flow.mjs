import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  for (const phone of [false, true]) {
    const page = await browser.newPage({ viewport: phone ? { width: 390, height: 800 } : { width: 1280, height: 760 }, isMobile: phone, hasTouch: phone, deviceScaleFactor: phone ? 3 : 1 })
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${process.env.TOKYO_URL || 'http://127.0.0.1:4173'}/?sky=night&verifyTokyo=1&animateTrain=1`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Try it with sample CDs').click()
    await page.waitForFunction(() => window.__tokyo?.backdropCalls > 0, undefined, { timeout: 60000 })
    const streetPixelRatio = await page.evaluate(() => window.__tokyo.pixelRatio)
    assert.equal(streetPixelRatio, phone ? 1.5 : 2, 'Street keeps its quality render scale after Canvas updates')
    assert.equal(await page.evaluate(() => window.__tokyo.shadowSize), phone ? 2048 : 8192)
    const train = await page.evaluate(() => window.__tokyo.trainX)
    await page.waitForFunction((x) => window.__tokyo.trainX !== x, train, { timeout: 30000 })
    if (phone) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 280, y: 440 }] })
      for (let i = 1; i <= 8; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 280, y: 440 - i * 24 }] })
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } else await page.getByRole('button', { name: 'Row below' }).click()
    await page.waitForFunction(() => document.querySelector('.row-header')?.textContent.includes('Row 2'))
    await page.waitForTimeout(2200)
    if (phone) await page.touchscreen.tap(170, 355)
    else await page.mouse.click(600, 370)
    await page.getByText('Tap the case to open it', { exact: true }).waitFor({ timeout: 15000 })
    await page.waitForTimeout(1800)
    if (phone) await page.touchscreen.tap(195, 370)
    else await page.mouse.click(640, 360)
    await page.locator('.panel').waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Play CD', exact: false }).click()
    await page.locator('.nowbar').waitFor()
    assert.match(await page.locator('.nowbar').textContent(), /Liked|Paper|Intro/)
    await page.getByRole('button', { name: 'Put it back' }).click()
    await page.waitForTimeout(1500)
    await page.locator('.theme-toggle').click()
    await page.locator('main.paper').waitFor()
    assert.equal(await page.locator('main').getAttribute('data-sky'), null)
    await page.waitForTimeout(2000)
    const paperPixelRatio = await page.locator('canvas').evaluate((c) => c.width / c.clientWidth)
    const expectedPaperRatio = await page.evaluate(() => Math.min(2, Math.max(1, window.devicePixelRatio)))
    assert.equal(paperPixelRatio, expectedPaperRatio, 'Paper retains its original render scale')
    await page.screenshot({ path: `output/tokyo-verification/${phone ? 'phone' : 'desktop'}-paper-final.png` })
    await page.locator('.theme-toggle').click()
    await page.locator('main.street[data-sky="night"]').waitFor()
    await page.waitForTimeout(2000)
    assert.deepEqual(errors, [])
    results.push({ device: phone ? 'phone' : 'desktop', train: 'moves', navigation: phone ? 'touch swipe' : 'row button', pickOpenPlayReturn: 'pass', paperAndBack: 'pass', streetPixelRatio, paperPixelRatio, errors })
    console.log(results.at(-1))
    await page.close()
  }
} finally {
  await browser.close()
  await fs.writeFile('output/tokyo-verification/flows.json', JSON.stringify(results, null, 2))
}
