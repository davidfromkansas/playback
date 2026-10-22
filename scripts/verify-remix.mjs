import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const base = process.env.VOLT_URL || 'http://127.0.0.1:5191'
const output = `output/remix/${Date.now()}`
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  for (const phone of [false, true]) {
    const page = await browser.newPage({ viewport: phone ? { width: 390, height: 800 } : { width: 1280, height: 760 }, isMobile: phone, hasTouch: phone })
    const errors = []
    const requests = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('request', r => { if (r.url().includes('/api/song-mood')) requests.push(r.url()) })
    await page.goto(base)
    await page.getByText('Try it with sample CDs').click()
    await page.locator('.row-header').waitFor()
    await page.getByRole('button', { name: 'Row below' }).click()
    const original = await page.locator('.row-header strong').textContent()
    await page.getByRole('switch', { name: /Remix/ }).click()
    await page.getByRole('combobox', { name: 'Mood row' }).waitFor()
    assert.match(await page.locator('.remix-status').textContent(), /Demo moods/)
    await page.getByRole('combobox', { name: 'Mood row' }).selectOption('5')
    await page.waitForTimeout(5000)
    const bounds = await page.locator('.topbar > *, .row-header').evaluateAll(nodes => nodes.map(n => {
      const b = n.getBoundingClientRect(); return { x: b.x, right: b.right, width: b.width }
    }))
    assert(bounds.every(b => b.width === 0 || b.x >= 0 && b.right <= (phone ? 390 : 1280)), JSON.stringify(bounds))
    await page.screenshot({ path: `${output}/${phone ? 'phone' : 'desktop'}-remix.png` })
    await page.locator('.theme-toggle').click()
    await page.locator('main.paper').waitFor()
    assert.equal(await page.getByRole('switch', { name: /Remix/ }).count(), 0)
    await page.locator('.theme-toggle').click()
    await page.getByRole('switch', { name: /Remix/ }).click()
    assert.equal(await page.locator('.row-header strong').textContent(), original)
    assert.equal(requests.length, 0, 'Demo moods must never call Jev')
    assert.deepEqual(errors, [])
    results.push({ phone, sample: 'demo rows, picker, theme switching, original row restored, zero classifier calls' })
    await page.close()
  }
  for (const configured of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } })
    const errors = []
    const moodRequests = []
    page.on('pageerror', e => errors.push(e.message))
    await page.addInitScript(() => {
      localStorage.setItem('playback.auth', JSON.stringify({ accessToken: 'fixture-token', refreshToken: 'fixture-refresh', expiresAt: Date.now() + 3600000 }))
    })
    const track = (n, name) => ({ uri: `spotify:track:${n}`, name, duration_ms: 200000, artists: [{ name: 'Fixture Artist' }],
      album: { id: 'a', uri: 'spotify:album:a', name: 'Fixture Album', images: [], artists: [{ name: 'Fixture Artist' }], external_urls: {} } })
    const recent = track(1, 'Recent Song')
    const liked = track(2, 'Liked Song')
    const top = track(3, 'Top Song')
    await page.route('https://sdk.scdn.co/**', r => r.fulfill({ contentType: 'application/javascript', body: '' }))
    await page.route('https://api.spotify.com/**', async route => {
      const url = new URL(route.request().url())
      let body = { items: [], total: 0, next: null }
      if (url.pathname === '/v1/me') body = { id: 'fixture', display_name: 'Fixture' }
      else if (url.pathname.endsWith('/recently-played')) body = { items: url.searchParams.has('before') ? [] : [{ track: recent, played_at: '2026-10-21T01:00:00Z', context: null }] }
      else if (url.pathname === '/v1/me/tracks') body = { items: [{ track: liked }], total: 1, next: null }
      else if (url.pathname === '/v1/me/top/tracks') body = { items: [top], next: null }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
    })
    await page.route('**/api/song-mood', async route => {
      const body = route.request().postDataJSON()
      moodRequests.push(body)
      const result = !configured ? { status: 'not-configured', profile: null }
        : body.title === 'Top Song' ? { status: 'uncertain', profile: null }
        : { status: 'classified', profile: { mood: body.title === 'Recent Song' ? 'joyful' : 'relaxed', confidence: .9, probability: .8 } }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) })
    })
    await page.goto(base)
    await page.getByRole('switch', { name: /Remix/ }).waitFor()
    await page.getByRole('switch', { name: /Remix/ }).click()
    if (configured) {
      await page.waitForFunction(() => document.querySelector('.remix-status')?.textContent.includes('2 of 3 sorted · 0 waiting'))
      const options = await page.getByRole('combobox', { name: 'Mood row' }).locator('option').allTextContents()
      assert(options.includes('Joyful · 1') && options.includes('Relaxed · 1') && options.includes('Unrated · 1'))
      assert.equal(moodRequests.length, 3)
      assert(moodRequests.every(r => Object.keys(r).sort().join(',') === 'artist,durationMs,title'))
      await page.getByRole('combobox', { name: 'Mood row' }).selectOption('5')
      await page.waitForTimeout(3000)
      await page.screenshot({ path: `${output}/classified-fixture.png` })
      // Search temporarily replaces Remix, and Back restores the selected mood row.
      await page.locator('.search').fill('fixture')
      await page.locator('.search').press('Enter')
      await page.getByRole('button', { name: '← Back' }).click()
      assert.equal(await page.getByRole('combobox', { name: 'Mood row' }).inputValue(), '5')
    } else {
      await page.waitForFunction(() => document.querySelector('.remix-status')?.textContent.includes("Jev isn't connected"))
      assert.equal(moodRequests.length, 1)
      await page.screenshot({ path: `${output}/not-configured.png` })
    }
    await page.getByRole('button', { name: 'Sign out' }).click()
    await page.getByText('Try it with sample CDs').waitFor()
    assert.deepEqual(errors, [])
    results.push({ configured, fixture: 'Spotify and Jev responses mocked', moodRequests: moodRequests.length, errors })
    await page.close()
  }
} finally {
  await browser.close()
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2))
  console.log(JSON.stringify({ output, results }, null, 2))
}
