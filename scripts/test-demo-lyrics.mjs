import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchLyrics } from '../src/spotify/lyrics.ts'

test('demo tracks request lyrics with album metadata and reuse the cached result', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (url, options) => {
    calls++
    assert.equal(new URL(url).searchParams.get('album_name'), 'Test album')
    assert.ok(options.signal)
    return new Response(JSON.stringify({ syncedLyrics: '[00:00.00]Original test line', instrumental: false }))
  }
  try {
    const track = { uri: 'sample:lyrics-test', name: 'Test song', artists: 'Test artist', album: 'Test album', durationMs: 120000 }
    assert.equal((await fetchLyrics(track)).kind, 'synced')
    await fetchLyrics(track)
    assert.equal(calls, 1)
  } finally { globalThis.fetch = original }
})

test('lyrics failure leaves a usable fallback', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('offline') }
  try {
    assert.deepEqual(await fetchLyrics({ uri: 'sample:offline', name: 'Test', artists: 'Test', durationMs: 120000 }), { kind: 'none' })
  } finally { globalThis.fetch = original }
})
