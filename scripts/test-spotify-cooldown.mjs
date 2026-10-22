import assert from 'node:assert/strict'
import { test } from 'node:test'
const stored = new Map()
globalThis.localStorage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) }
const { cooldownRemaining, recordCooldown, cooldownMessage } = await import('../src/spotify/cooldown.ts')
test('server cooldown is retained, expires, and shorter responses cannot shorten it', () => {
  assert.equal(recordCooldown('120', 1000), 120)
  assert.equal(recordCooldown('2', 2000), 119)
  assert.equal(cooldownRemaining(121000), 0)
  assert.equal(recordCooldown(null, 200000), 30)
  assert.equal(recordCooldown('invalid', 300000), 30)
  assert.match(cooldownMessage(120), /2 minutes/)
  assert.match(cooldownMessage(12), /12 seconds/)
})
test('a new module instance respects the stored deadline after reload', async () => {
  const fresh = await import('../src/spotify/cooldown.ts?reload')
  assert.equal(fresh.cooldownRemaining(310000), 20)
})
test('429 stops retries and blocks another endpoint without another network request', async () => {
  const { readFile } = await import('node:fs/promises')
  const { stripTypeScriptTypes } = await import('node:module')
  const apiSource = (await readFile(new URL('../src/spotify/api.ts', import.meta.url), 'utf8'))
    .replace("import { accessToken } from './auth'", "const accessToken = async () => 'fixture'")
    .replace("from './cooldown'", `from '${new URL('../src/spotify/cooldown.ts', import.meta.url).href}'`)
  const compiled = stripTypeScriptTypes(apiSource, { mode: 'transform' })
  const { spotify } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => { calls++; return new Response('', { status: 429, headers: { 'Retry-After': '120' } }) }
  try {
    await assert.rejects(spotify('/me'), error => error.status === 429 && error.message.includes('2 minutes'))
    await assert.rejects(spotify('/me/albums'), error => error.status === 429)
    assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})
