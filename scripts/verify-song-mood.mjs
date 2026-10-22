import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.VOLT_URL || 'http://127.0.0.1:5191'
const output = `output/dj-volt/moods-${Date.now()}`
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/character-preview.html`)
  await page.locator('.dj-volt[data-cel]').waitFor()
  const coverage = await page.evaluate(async () => {
    const { MOOD_ROUTINES } = await import('/src/lib/songMood.ts')
    const { advanceVolt, newVoltMotion } = await import('/src/ui/voltAnimation.ts')
    return Object.entries(MOOD_ROUTINES).map(([mood, allowed]) => {
      const motion = newVoltMotion()
      const seen = new Set()
      for (let i = 0; i < 2000; i++) {
        const sample = advanceVolt(motion, 1 / 60, true, 'auto', allowed)
        if (sample.state === 'playing') seen.add(sample.routine)
      }
      for (let i = 0; i < 500; i++) advanceVolt(motion, 1 / 60, false, 'auto', allowed)
      return { mood, allowed, seen: [...seen], recovered: motion.entry === 0 }
    })
  })
  assert.equal(coverage.length, 17)
  for (const row of coverage) {
    assert.deepEqual(row.seen.sort(), [...row.allowed].sort())
    assert(row.recovered)
  }
  await page.getByRole('combobox', { name: 'Mood', exact: true }).selectOption('dreamy')
  await page.getByRole('button', { name: 'Play music', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.routine === 'armwave')
  await page.getByRole('combobox', { name: 'Mood', exact: true }).selectOption('joyful')
  await page.waitForFunction(() => ['rabbit', 'wave', 'cabbage'].includes(document.querySelector('.dj-volt').dataset.routine))
  await page.getByRole('button', { name: 'Pause music', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.dj-volt').dataset.motion === 'idle')
  await page.getByLabel('Song title', { exact: true }).fill('Example Song')
  await page.getByLabel('Artist', { exact: true }).fill('Example Artist')
  await page.getByLabel('Duration in seconds').fill('200')
  // This request exercises the real local endpoint without configuring a paid service.
  await page.getByRole('button', { name: 'Find song mood' }).click()
  await page.getByRole('status').filter({ hasText: 'Local setup needed' }).waitFor()
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true })
  await page.route('**/api/song-mood', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ status: 'classified',
      profile: { mood: 'funky', confidence: .9, probability: .8 } }),
  }))
  await page.getByRole('button', { name: 'Find song mood' }).click()
  await page.getByRole('status').filter({ hasText: 'Estimated mood: funky' }).waitFor()
  assert.equal(await page.getByRole('combobox', { name: 'Mood', exact: true }).inputValue(), 'funky')
  await page.setViewportSize({ width: 390, height: 800 })
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await page.screenshot({ path: `${output}/phone.png`, fullPage: true })
  assert.deepEqual(errors, [])
  await fs.writeFile(`${output}/results.json`, JSON.stringify({ coverage,
    liveJev: false, publicCatalog: 'mocked in unit tests; not requested without a key', errors }, null, 2))
  console.log(output)
} finally { await browser.close() }
