import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const output = `output/dj-volt/app-${Date.now()}`
await fs.mkdir(output, { recursive: true })
const results = []
try {
  for (const phone of [false, true]) {
    const page = await browser.newPage({ viewport: phone ? { width: 390, height: 800 } : { width: 1280, height: 760 }, isMobile: phone, hasTouch: phone })
    const device = phone ? 'phone' : 'desktop'
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(process.env.VOLT_APP_URL || 'http://127.0.0.1:4191', { waitUntil: 'domcontentloaded' })
    await page.locator('.dj-volt[data-cel]').waitFor()
    await page.screenshot({ path: `${output}/${device}-welcome.png` })
    await page.getByText('Try it with sample CDs').click()
    await page.locator('.row-header').waitFor()
    await page.waitForTimeout(6000)
    await page.screenshot({ path: `${output}/${device}-street-idle.png` })
    if (phone) {
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 280, y: 440 }] })
      for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 280, y: 440 - i * 24 }] })
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    } else await page.getByRole('button', { name: 'Row below' }).click()
    await page.waitForFunction(() => document.querySelector('.row-header')?.textContent.includes('Row 2'))
    await page.waitForTimeout(2200)
    if (phone) await page.touchscreen.tap(170, 355)
    else await page.mouse.click(600, 370)
    await page.getByText('Tap the case to open it', { exact: true }).waitFor()
    await page.waitForTimeout(1800)
    if (phone) await page.touchscreen.tap(195, 370)
    else await page.mouse.click(640, 360)
    await page.locator('.panel').waitFor()
    await page.getByRole('button', { name: 'Play CD', exact: false }).click()
    await page.locator('.nowbar').waitFor()
    await page.waitForFunction(() => document.querySelector('.dj-volt')?.dataset.motion === 'playing')
    await page.getByRole('button', { name: 'Put it back' }).click()
    await page.waitForTimeout(2400)
    await page.screenshot({ path: `${output}/${device}-street-playing.png` })
    const box = await page.locator('.dj-volt').boundingBox()
    assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= (phone ? 390 : 1280))
    if (phone) {
      const hint = await page.locator('.hint').boundingBox()
      assert(hint && box.y + box.height <= hint.y, 'The swipe hint must not cover his skates')
    }
    await page.locator('.theme-toggle').click()
    await page.locator('main.paper').waitFor()
    await page.waitForTimeout(2000)
    assert.equal(await page.locator('.dj-volt').count(), 0)
    assert.equal(await page.locator('.host svg').count(), 1)
    await page.screenshot({ path: `${output}/${device}-paper.png` })
    await page.locator('.theme-toggle').click()
    await page.waitForFunction(() => document.querySelector('.dj-volt')?.dataset.motion === 'playing')
    assert.deepEqual(errors, [])
    results.push({ device, sampleFlow: 'welcome / swipe / pick / open / play / return', themes: 'Street / Paper / Street', errors })
    console.log(results.at(-1))
    await page.close()
  }
} finally {
  await browser.close()
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
  console.log(output)
}
