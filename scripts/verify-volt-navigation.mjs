import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { newVoltNavigation, readVoltNavigation, advanceVoltNavigation } from '../src/ui/voltNavigation.ts'

const output = `output/dj-volt/navigation-${Date.now()}`
await fs.mkdir(output, { recursive: true })
const results = []
for (const hz of [60, 120]) {
  const motion = newVoltNavigation()
  const input = { horizontal: { current: 0 }, vertical: { current: NaN }, enabled: true }
  const trace = []
  for (let tick = 0; tick < hz * 7; tick++) {
    const time = tick / hz
    if (time > .2 && time < 1.2) input.horizontal.current += 1 / hz
    if (time >= 1.2 && time < 2.2) input.horizontal.current -= 1 / hz
    if (time >= 3 && time < 4) { input.vertical.current ||= 0; input.vertical.current += 1 / hz }
    if (time >= 4 && time < 5) input.vertical.current -= 1 / hz
    readVoltNavigation(motion, input, 1 / hz)
    const reaction = advanceVoltNavigation(motion, 1 / hz, true)
    trace.push({ tick, time, ...reaction, age: motion.age, direction: motion.direction })
  }
  assert.equal(motion.pose, null)
  assert.equal(motion.direction, null)
  assert(trace.some(f => f.cel === 179) && trace.some(f => f.cel === 183))
  assert(trace.some(f => f.cel === 187) && trace.some(f => f.cel === 191))
  for (let i = 1; i < trace.length; i++) assert(Math.abs(trace[i].age - trace[i - 1].age) <= 12 / hz + 1e-8)
  input.horizontal = { current: 90 }
  readVoltNavigation(motion, input, 1 / hz)
  assert.equal(motion.direction, null, 'Restoring a row must not invent horizontal movement')
  input.enabled = false
  input.horizontal.current += 1
  readVoltNavigation(motion, input, 1 / hz)
  assert.equal(motion.direction, null)
  await fs.writeFile(`${output}/fixture-${hz}hz.json`, JSON.stringify(trace))
  results.push({ fixtureHz: hz, directions: 4, reversal: 'via neutral', disabled: 'pass', rowRestore: 'pass' })
}

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const base = process.env.VOLT_URL || 'http://127.0.0.1:5191'
try {
  const context = await browser.newContext({ viewport: { width: 1040, height: 850 }, recordVideo: { dir: output } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(`${base}/character-preview.html`)
  await page.locator('.dj-volt[data-cel]').waitFor()
  await page.evaluate(() => {
    window.navigationTrace = []
    const sample = time => {
      const el = document.querySelector('.dj-volt')
      window.navigationTrace.push({ time, ...el.dataset })
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  for (const slow of [false, true]) {
    if (slow) await page.getByRole('button', { name: 'Quarter speed' }).click()
    for (const direction of ['left', 'right', 'up', 'down']) {
      const button = page.getByRole('button', { name: `Hold ${direction}`, exact: true })
      await button.focus()
      await page.keyboard.down('Space')
      await page.waitForFunction(d => document.querySelector('.dj-volt').dataset.direction === d, direction)
      await page.waitForTimeout(slow ? 1900 : 600)
      await page.locator('.candidate .stage').screenshot({ path: `${output}/${slow ? 'slow' : 'normal'}-${direction}.png` })
      await page.keyboard.up('Space')
      await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'idle')
      await page.waitForTimeout(180)
    }
  }
  await page.getByRole('button', { name: 'Quarter speed' }).click()
  await page.getByRole('button', { name: 'Play music', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'playing')
  await page.getByRole('button', { name: 'Hold down', exact: true }).focus()
  await page.keyboard.down('Space')
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.direction === 'down')
  await page.keyboard.up('Space')
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'idle')
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'playing')
  await page.getByRole('combobox', { name: 'Routine', exact: true }).selectOption('windmill')
  await page.waitForFunction(() => {
    const el = document.querySelector('.dj-volt')
    return el.dataset.motion === 'playing' && el.dataset.routine === 'windmill'
  })
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Hold right', exact: true }).focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(100)
  await page.keyboard.up('Space')
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'idle')
  await page.waitForTimeout(600)
  assert.equal(await page.locator('.dj-volt').getAttribute('data-motion'), 'idle', 'A brief swipe during a floor move must reach idle before restarting music')
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'playing')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Hold left', exact: true }).focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(500)
  assert.equal(await page.locator('.dj-volt').getAttribute('data-cel'), '24')
  assert.equal(await page.locator('.dj-volt').getAttribute('data-direction'), 'none')
  await page.keyboard.up('Space')
  const frames = await page.evaluate(() => window.navigationTrace)
  await fs.writeFile(`${output}/presented.json`, JSON.stringify(frames))
  const gaps = frames.slice(1).map((f, i) => f.time - frames[i].time).sort((a, b) => a - b)
  results.push({ preview: 'four directions, normal / quarter speed, music recovery, reduced motion',
    medianMs: gaps[Math.floor(gaps.length * .5)], p95Ms: gaps[Math.floor(gaps.length * .95)],
    p99Ms: gaps[Math.floor(gaps.length * .99)], maxMs: gaps.at(-1), gapsOver34ms: gaps.filter(g => g > 34).length })
  assert.deepEqual(errors, [])
  await context.close()

  for (const phone of [false, true]) {
    const app = await browser.newPage({ viewport: phone ? { width: 390, height: 800 } : { width: 1280, height: 760 }, hasTouch: phone, isMobile: phone })
    await app.goto(base)
    await app.getByText('Try it with sample CDs').click()
    await app.locator('.row-header').waitFor()
    await app.waitForTimeout(5000)
    await app.evaluate(() => {
      window.seenDirections = []
      const sample = () => {
        const el = document.querySelector('.dj-volt')
        if (el) window.seenDirections.push(el.dataset.direction)
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    if (phone) {
      const cdp = await app.context().newCDPSession(app)
      const swipe = async (dx, dy) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 220, y: 400 }] })
        for (let i = 1; i <= 12; i++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 220 + dx * i / 12, y: 400 + dy * i / 12 }] })
          await app.waitForTimeout(50)
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await app.waitForTimeout(1100)
      }
      await swipe(0, -170)
      await swipe(-150, 0)
      await swipe(150, 0)
      await swipe(0, 170)
    } else {
      for (const key of ['ArrowDown', 'ArrowRight', 'ArrowLeft', 'ArrowUp']) {
        await app.keyboard.press(key)
        await app.waitForTimeout(1400)
      }
      await app.mouse.move(700, 400)
      await app.mouse.wheel(0, 140)
      await app.waitForTimeout(1400)
      await app.mouse.wheel(140, 0)
    }
    await app.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'idle')
    const seen = await app.evaluate(() => [...new Set(window.seenDirections)].filter(x => x !== 'none').sort())
    assert.deepEqual(seen, ['down', 'left', 'right', 'up'])
    await app.screenshot({ path: `${output}/${phone ? 'phone' : 'desktop'}-settled.png` })
    results.push({ app: phone ? 'touch swipes' : 'keyboard and wheel', seen, final: 'idle' })
    await app.close()
  }
} finally {
  await browser.close()
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ output, results }, null, 2))
}
