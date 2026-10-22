import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'

async function load(file, replacements) {
  let source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8')
  for (const [from, to] of replacements) source = source.replace(from, to)
  return import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source, { mode: 'transform' })).toString('base64'))
}

test('phone polling is idle until playback, single-flight, and stops when entering demo', async () => {
  const timers = new Map()
  let timerId = 0
  globalThis.window = { setInterval: fn => { timers.set(++timerId, fn); return timerId }, clearInterval: id => timers.delete(id) }
  globalThis.document = { visibilityState: 'visible' }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'iPhone', maxTouchPoints: 1 } })
  const calls = []
  let finishPoll
  globalThis.fixtureRequest = async (path, init) => {
    calls.push(path)
    if (path === '/me/player') return new Promise(resolve => { finishPoll = resolve })
  }
  const player = await load('spotify/player.ts', [
    ["import { spotify, SpotifyError } from './api'", "const spotify = globalThis.fixtureRequest; class SpotifyError extends Error {}"],
    ["import { accessToken } from './auth'", "const accessToken = async () => 'fixture'"],
  ])
  player.initPlayer(true)
  for (const tick of timers.values()) tick()
  assert.equal(calls.length, 0)
  const track = { uri: 'spotify:track:test', name: 'Test', artists: 'Test', durationMs: 200000 }
  await player.play({ id: 'test', kind: 'track', uri: track.uri, tracks: [track] }, [track])
  for (const tick of timers.values()) tick()
  assert.equal(calls.filter(p => p === '/me/player').length, 1)
  await player.play({ id: 'test', kind: 'track', uri: track.uri, tracks: [track] }, [track])
  assert.equal(calls.filter(p => p === '/me/player').length, 1)
  player.initPlayer(false)
  assert.equal(timers.size, 0)
  finishPoll({ is_playing: true, progress_ms: 1234, item: { uri: 'stale', name: 'stale', artists: [], duration_ms: 200000 } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(player.playerStore.get().mode, 'sample')
  assert.equal(player.playerStore.get().now.track, null)
})

test('429 preserves Spotify quota reason rather than claiming a short reset', async () => {
  const api = await load('spotify/api.ts', [
    ["import { accessToken } from './auth'", "const accessToken = async () => 'fixture'"],
    ["import { cooldownRemaining, recordCooldown, cooldownMessage } from './cooldown'", "const cooldownRemaining = () => 0; const recordCooldown = () => 60; const cooldownMessage = () => 'rate limited'"],
  ])
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { reason: 'QUOTA_EXCEEDED' } }), { status: 429 })
  try { await assert.rejects(api.spotify('/me'), error => error.reason === 'QUOTA_EXCEEDED' && error.message.includes('shared across apps')) }
  finally { globalThis.fetch = original }
})

test('concurrent track opens share one fetch and cached library retains tracks', async () => {
  let calls = 0
  let release
  globalThis.fixturePages = () => { calls++; return new Promise(resolve => { release = resolve }) }
  const library = await load('spotify/library.ts', [
    ["import { allPages, spotify } from './api'", "const allPages = globalThis.fixturePages; const spotify = async () => ({})"],
  ])
  const disc = { id: 'album', kind: 'album', tracksAvailable: true }
  const a = library.loadTracks(disc)
  const b = library.loadTracks(disc)
  assert.equal(calls, 1)
  release([{ uri: 'spotify:track:test', name: 'Test', artists: [], duration_ms: 10000 }])
  assert.deepEqual(await a, await b)
  const storage = new Map()
  globalThis.localStorage = { setItem: (k, v) => storage.set(k, v), getItem: k => storage.get(k) ?? null }
  library.saveCache('test-user', [disc])
  assert.equal(library.cachedLibrary('test-user')[0].tracks.length, 1)
})

test('demo audio follows media time, pauses, seeks, replaces tracks, and cleans up', async () => {
  const elements = []
  class AudioFixture extends EventTarget {
    dataset = {}; currentTime = 0; duration = 30; paused = true; ended = false; error = null
    play() { this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve() }
    pause() { this.paused = true; this.dispatchEvent(new Event('pause')) }
    removeAttribute() {}; load() {}; remove() { this.removed = true }
  }
  globalThis.window = { clearInterval() {} }
  globalThis.document = { createElement: () => { const audio = new AudioFixture(); elements.push(audio); return audio }, body: { appendChild() {} } }
  const player = await load('spotify/player.ts', [
    ["import { spotify, SpotifyError } from './api'", "const spotify = () => { throw Error('Demo must not call Spotify') }; class SpotifyError extends Error {}"],
    ["import { accessToken } from './auth'", "const accessToken = () => { throw Error('No demo token') }"],
  ])
  player.initPlayer(false)
  const tracks = [1, 2].map(id => ({ uri: `sample:${id}`, name: `Song ${id}`, artists: 'Test', durationMs: 180000, previewUrl: `https://example.test/${id}.m4a` }))
  const disc = { id: 'demo', tracks }
  assert.equal((await player.play(disc, tracks)).ok, true)
  assert.equal(player.playerStore.get().now.durationMs, 30000)
  elements[0].currentTime = 5
  assert.equal(player.livePosition(player.playerStore.get().now), 5000)
  await player.togglePause()
  assert.equal(player.playerStore.get().now.paused, true)
  await player.seek(12000)
  assert.equal(elements[0].currentTime, 12)
  await player.togglePause()
  assert.equal(player.playerStore.get().now.paused, false)
  await player.skip(1)
  assert.equal(elements[0].removed, true)
  assert.equal(player.playerStore.get().now.track.uri, 'sample:2')
  elements[0].dispatchEvent(new Event('error'))
  assert.equal(player.playerStore.get().now.error, undefined)
  elements[1].ended = true
  elements[1].dispatchEvent(new Event('ended'))
  assert.equal(player.playerStore.get().now.paused, true)
  const missing = await player.play(disc, [{ ...tracks[0], previewUrl: undefined }])
  assert.equal(missing.ok, false)
  assert.equal(player.playerStore.get().now.paused, true)
  assert.match(player.playerStore.get().now.error, /No audio preview/)
  await player.play(disc, tracks)
  player.disconnectPlayer()
  assert.equal(elements[2].removed, true)
  assert.equal(player.playerStore.get().now.track, null)
})
