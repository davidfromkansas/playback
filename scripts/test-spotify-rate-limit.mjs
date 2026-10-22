import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage()
  await page.addInitScript(() => localStorage.setItem('playback.auth', JSON.stringify({
    accessToken: 'fixture', refreshToken: 'fixture', expiresAt: Date.now() + 3600000,
  })))
  await page.goto(`${process.env.VOLT_URL || 'http://127.0.0.1:5191'}/character-preview.html`)
  const result = await page.evaluate(async () => {
    const { spotify } = await import('/src/spotify/api.ts')
    const fetchOriginal = window.fetch
    let calls = 0
    window.fetch = async () => ++calls === 1
      ? new Response('', { status: 429, headers: { 'Retry-After': '0.03' } })
      : new Response('{"ok":true}', { status: 200 })
    const start = performance.now()
    const response = await spotify('/fixture')
    const waited = performance.now() - start
    const retryCalls = calls
    calls = 0
    window.fetch = async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '60' } }) }
    const controller = new AbortController()
    const work = spotify('/fixture', { signal: controller.signal }).then(() => 'unexpected', e => e.name)
    setTimeout(() => controller.abort(), 20)
    const cancelled = await work
    window.fetch = fetchOriginal
    return { response, waited, retryCalls, cancelled, cancelledCalls: calls }
  })
  assert.equal(result.response.ok, true)
  assert.equal(result.retryCalls, 2)
  assert(result.waited >= 28)
  assert.equal(result.cancelled, 'AbortError')
  assert.equal(result.cancelledCalls, 1)
  console.log(result)
} finally { await browser.close() }
