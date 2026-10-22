import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.VOLT_URL || 'http://127.0.0.1:5191'
const output = `output/dj-volt/labels-${Date.now()}`
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  for (const phone of [false, true]) {
    const width = phone ? 390 : 1280
    const page = await browser.newPage({ viewport: { width, height: phone ? 800 : 760 }, isMobile: phone, hasTouch: phone })
    const errors = []
    const requests = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/api/song-mood', async route => {
      requests.push(route.request().postDataJSON())
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'classified',
        profile: { mood: requests.length === 1 ? 'dreamy' : 'funky', confidence: .9, probability: .8 } }) })
    })
    await page.goto(base)
    await page.getByText('Try it with sample CDs', { exact: true }).click()
    await page.locator('.row-header').waitFor()
    await page.getByRole('button', { name: 'Row below' }).click()
    await page.waitForTimeout(7000)
    assert.equal(await page.locator('.focus-label .song-mood').textContent(), 'Unrated')
    if (phone) await page.touchscreen.tap(170, 355)
    else await page.mouse.click(600, 370)
    await page.getByText('Tap the case to open it', { exact: true }).waitFor()
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${output}/${phone ? 'phone' : 'desktop'}-cover-street.png` })
    await page.locator('.theme-toggle').click()
    await page.locator('main.paper').waitFor()
    await page.waitForTimeout(800)
    await page.screenshot({ path: `${output}/${phone ? 'phone' : 'desktop'}-cover-paper.png` })
    await page.locator('.theme-toggle').click()
    await page.locator('main.street').waitFor()
    await page.waitForTimeout(800)
    if (phone) await page.touchscreen.tap(195, 370)
    else await page.mouse.click(640, 360)
    await page.locator('.tracks .song-mood').first().waitFor()
    assert.equal(await page.locator('.tracks li.now').count(), 0)
    assert.equal(await page.locator('.nowbar').count(), 0)
    assert.equal(requests.length, 0, 'Sample tracks do not hit the classifier')
    assert.equal(await page.locator('.tracks .song-mood').count(), await page.locator('.tracks li').count())
    // Fixture: inject a matching non-sample identity through the real queue. No song is played.
    await page.evaluate(async () => {
      // Vite may timestamp this module after HMR; use the app's exact module instance.
      const moduleUrl = performance.getEntriesByType('resource').map(entry => entry.name)
        .find(url => /\/src\/lib\/songMood\.ts(?:\?|$)/.test(url))
      if (!moduleUrl) throw Error('Mood store module not loaded')
      const { songMoods } = await import(moduleUrl)
      const { sampleLibrary } = await import('/src/data/sample.ts')
      const name = document.querySelector('.tracks .name').firstChild.textContent
      const artist = document.querySelector('.tracks .track-detail small').textContent
      const track = sampleLibrary().flatMap(d => d.tracks ?? []).find(t => t.name === name && t.artists === artist)
      if (!track) throw Error('Fixture track not found')
      songMoods.setEnabled(true)
      songMoods.enqueue([{ ...track, uri: 'fixture:unplayed-song' }, { ...track, uri: 'fixture:duplicate' }])
    })
    await page.locator('.tracks .song-mood').first().filter({ hasText: 'Dreamy' }).waitFor()
    assert.equal(await page.locator('.nowbar').count(), 0)
    assert.equal(requests.length, 1)
    for (const theme of ['street', 'paper']) {
      if (theme === 'paper') await page.locator('.theme-toggle').click()
      await page.locator(`main.${theme}`).waitFor()
      await page.waitForTimeout(700)
      const labels = await page.locator('.tracks .song-mood').evaluateAll(nodes => nodes.map(node => {
        const box = node.getBoundingClientRect()
        return { left: box.left, right: box.right, width: box.width }
      }))
      await page.screenshot({ path: `${output}/${phone ? 'phone' : 'desktop'}-${theme}.png` })
      assert(labels.every(box => box.width > 0 && box.left >= 0 && box.right <= width), JSON.stringify({ phone, theme, labels }))
    }
    await page.getByRole('button', { name: 'Play CD', exact: false }).click()
    await page.locator('.nowbar .song-mood').filter({ hasText: 'Dreamy' }).waitFor()
    assert.deepEqual(errors, [])
    results.push({ phone, labeledBeforePlayback: true, duplicateRequests: 0, errors })
    await page.close()
  }
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
  console.log(output)
} finally { await browser.close() }
