import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.VOLT_URL || 'http://127.0.0.1:5174'
const output = `output/dj-volt/${new Date().toISOString().replaceAll(':', '-')}`
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
const routines = ['groove', 'punch', 'duck', 'wave', 'bart', 'running', 'rabbit', 'cabbage', 'smurf', 'points', 'armwave', 'toprock', 'sixstep', 'freeze', 'backspin', 'windmill']
try {
  const context = await browser.newContext({ viewport: { width: 1040, height: 850 },
    recordVideo: { dir: output, size: { width: 1040, height: 850 } } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/character-preview.html`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.locator('.dj-volt[data-cel]').waitFor()
  const trace = await page.evaluate(() => window.voltFixture())
  assert.equal(trace.at(-1).state, 'idle')
  assert(trace.some(f => f.state === 'playing'))
  assert(trace.every(f => f.cel >= 0 && f.cel < 176))
  assert.deepEqual([...new Set(trace.filter(f => f.state === 'playing').map(f => f.routine))].sort(),
    [...routines].sort())
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].routine !== trace[i - 1].routine) {
      assert([24, 79].includes(trace[i - 1].cel), 'Leave a routine from a neutral drawing')
      assert([24, 72, 79].includes(trace[i].cel), 'Enter a routine through a neutral drawing')
    }
  }
  assert(trace.every((f, i) => !i || Math.abs(f.entry - trace[i - 1].entry) <= 1 / 6 + 1e-8))
  await fs.writeFile(`${output}/deterministic-trace.json`, JSON.stringify(trace))
  await page.screenshot({ path: `${output}/idle.png` })
  await page.evaluate(() => {
    window.presented = []
    let frames = 0
    const sample = time => {
      const el = document.querySelector('.dj-volt')
      window.presented.push({ time, cel: el.dataset.cel, state: el.dataset.motion,
        playing: el.dataset.playing, routine: el.dataset.routine })
      if (++frames < 1440) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.getByRole('button', { name: 'Play music', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'playing')
  for (const routine of routines) {
    await page.getByRole('combobox', { name: 'Routine', exact: true }).selectOption(routine)
    await page.waitForFunction(r => document.querySelector('.dj-volt').dataset.routine === r, routine)
    await page.waitForTimeout(routines.indexOf(routine) < 12 ? 550 : 1300)
    await page.screenshot({ path: `${output}/${routine}.png` })
  }
  await page.screenshot({ path: `${output}/playing.png` })
  await page.getByRole('button', { name: 'Pause music', exact: true }).click()
  await page.waitForTimeout(180)
  await page.getByRole('button', { name: 'Play music', exact: true }).click()
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: 'Pause music', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'idle')
  await page.getByRole('button', { name: 'Quarter speed' }).click()
  await page.getByRole('button', { name: 'Play music', exact: true }).click()
  await page.waitForTimeout(6500)
  const presented = await page.evaluate(() => window.presented)
  assert(presented.length >= 600)
  await fs.writeFile(`${output}/presented-frames.json`, JSON.stringify(presented))
  const gaps = presented.slice(1).map((f, i) => f.time - presented[i].time).sort((a, b) => a - b)
  const percentile = p => gaps[Math.floor((gaps.length - 1) * p)]
  results.push({ surface: 'isolated Chrome preview', frames: presented.length, medianMs: percentile(.5),
    p95Ms: percentile(.95), p99Ms: percentile(.99), maxMs: gaps.at(-1), gapsOver34ms: gaps.filter(x => x > 34).length })
  await page.getByRole('button', { name: 'Quarter speed' }).click()
  await page.getByRole('button', { name: 'Pause music', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'idle')
  for (const routine of routines) {
    await page.getByRole('combobox', { name: 'Routine', exact: true }).selectOption(routine)
    await page.getByRole('button', { name: 'Play music', exact: true }).click()
    await page.waitForFunction(r => {
      const el = document.querySelector('.dj-volt')
      return el.dataset.motion === 'playing' && el.dataset.routine === r
    }, routine)
    await page.waitForTimeout(routines.indexOf(routine) < 12 ? 550 : 1300)
    await page.getByRole('button', { name: 'Pause music', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'idle')
  }
  results.push({ interruptionRecovery: routines, result: 'pass' })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Play music', exact: true }).click()
  await page.waitForTimeout(100)
  const staticCel = await page.locator('.dj-volt').getAttribute('data-cel')
  await page.waitForTimeout(500)
  assert.equal(await page.locator('.dj-volt').getAttribute('data-cel'), staticCel)
  assert.deepEqual(errors, [])
  await context.close()
  console.log(JSON.stringify(results))
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
  console.log(output)
} finally { await browser.close() }
