import assert from 'node:assert/strict'
import { test } from 'node:test'
import { collectRemixMusic } from '../src/lib/remixCollection.ts'
import { createSongMoodQueue, songMoodKey } from '../src/lib/songMoodQueue.ts'

const song = id => ({ uri: `spotify:track:${id}`, name: `Song ${id}`, artists: [{ name: 'Artist' }], duration_ms: 200000 })
const disc = (id, available = true) => ({ id, title: id, kind: 'album', tracksAvailable: available })

test('recent pages come first, all liked pages and all saved collections load, duplicates appear once', async () => {
  const calls = []
  const updates = []
  let recent = 0
  const request = async path => {
    calls.push(path)
    if (path.startsWith('/me/player/recently-played')) {
      recent++
      if (recent > 2) return { items: [] }
      return { items: Array.from({ length: 50 }, (_, i) => ({ track: song((recent - 1) * 50 + i), played_at: new Date(1700000000000 - ((recent - 1) * 50 + i) * 1000).toISOString() })) }
    }
    if (path.startsWith('/me/tracks')) {
      const page = Number(new URL(path, 'https://api.spotify.com').searchParams.get('page') ?? 0)
      return { items: Array.from({ length: 50 }, (_, i) => ({ track: song(page * 50 + i) })), next: page < 5 ? `/me/tracks?page=${page + 1}` : null }
    }
    if (path.startsWith('/me/top')) return { items: [song(400)] }
    if (path.startsWith('/albums')) return { items: [song(path.split('/')[2])] }
    if (path.startsWith('/playlists')) return { items: [{ item: song(500) }, { track: song(501) }, { item: { ...song(502), is_local: true } }] }
    throw Error(path)
  }
  await collectRemixMusic([...Array.from({ length: 12 }, (_, i) => disc(`album${i}`)),
    { ...disc('owned'), kind: 'playlist' }, { ...disc('followed', false), kind: 'playlist' }], request, s => updates.push(s), new AbortController().signal)
  const final = updates.at(-1)
  assert.equal(final.loading, false)
  assert.equal(final.recentCount, 100)
  assert.equal(final.tracks.length, 315)
  assert.equal(final.tracks[0].uri, 'spotify:track:0')
  assert.equal(calls.filter(c => c.startsWith('/me/top')).length, 3)
  assert.equal(calls.filter(c => c.startsWith('/albums')).length, 12)
  assert(final.issues.some(i => i.includes('1 followed playlists')))
  assert(calls[1].includes('before='))
})

test('repeating recent history terminates and missing top scope does not block albums', async () => {
  const calls = []
  let final
  await collectRemixMusic([disc('a')], async path => {
    calls.push(path)
    if (path.startsWith('/me/player')) return { items: [{ track: song(1), played_at: '2026-10-21T01:00:00Z' }] }
    if (path.startsWith('/me/top')) throw Object.assign(new Error('scope'), { status: 403 })
    return { items: [path.startsWith('/albums') ? song(2) : { track: song(1) }] }
  }, s => { final = s }, new AbortController().signal)
  assert.equal(calls.filter(p => p.startsWith('/me/player')).length, 2)
  assert.equal(calls.filter(p => p.startsWith('/me/top')).length, 1)
  assert.equal(final.tracks.length, 2)
  assert(final.issues.some(i => i.includes('sign out and back in')))
})

test('cancelled loading never publishes a stale page', async () => {
  const controller = new AbortController()
  let resolve
  const updates = []
  const promise = collectRemixMusic([], () => new Promise(r => { resolve = r }), value => updates.push(value), controller.signal)
  controller.abort()
  resolve({ items: [{ track: song(1), played_at: '2026-10-21T01:00:00Z' }] })
  await assert.rejects(promise, { name: 'AbortError' })
  assert.equal(updates.length, 1)
  assert.equal(updates[0].tracks.length, 0)
})

test('priority preserves newest-first order and duplicate enqueue does not loop notifications', async () => {
  const calls = []
  const releases = []
  const queue = createSongMoodQueue(track => { calls.push(track.uri); return new Promise(resolve => releases.push(resolve)) }, 0)
  const track = id => ({ uri: `spotify:track:${id}`, name: String(id), artists: 'a', durationMs: 200000 })
  queue.setEnabled(true)
  queue.enqueue([track(0), track(1), track(2)])
  queue.enqueue([track(9), track(8)], true)
  const revision = queue.revision()
  queue.enqueue([track(0), track(9), track(8)])
  assert.equal(queue.revision(), revision)
  releases.shift()({ status: 'uncertain', profile: null })
  await new Promise(r => setTimeout(r, 5))
  assert.equal(calls[1], 'spotify:track:9')
  releases.shift()({ status: 'uncertain', profile: null })
  await new Promise(r => setTimeout(r, 5))
  assert.equal(calls[2], 'spotify:track:8')
  assert.equal(queue.get(songMoodKey(track(1))).status, 'queued')
  queue.setEnabled(false)
})
