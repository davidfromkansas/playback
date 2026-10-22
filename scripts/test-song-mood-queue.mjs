import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createSongMoodQueue, songMoodKey } from '../src/lib/songMoodQueue.ts'

const track = n => ({ uri: `spotify:track:${n}`, name: `Song ${n}`, artists: 'Artist', durationMs: 200000 })
const result = { status: 'classified', profile: { mood: 'joyful', confidence: .9, probability: .8 } }
const tick = () => new Promise(resolve => setTimeout(resolve, 5))

test('loaded, unplayed songs are serialized and duplicates share results', async () => {
  const calls = []
  const releases = []
  const queue = createSongMoodQueue(t => { calls.push(t.uri); return new Promise(resolve => releases.push(resolve)) }, 0)
  queue.setEnabled(true)
  queue.enqueue([track(1), track(2), track(1)])
  assert.equal(calls.length, 1)
  assert.equal(queue.get(songMoodKey(track(2))).status, 'queued')
  releases.shift()(result)
  await tick()
  assert.equal(calls.length, 2)
  releases.shift()(result)
  await tick()
  queue.enqueue([track(1), track(2)])
  assert.equal(calls.length, 2)
  assert.equal(queue.get(songMoodKey(track(2))).profile.mood, 'joyful')
  queue.setEnabled(false)
})

test('missing setup stops a loaded library from making repeated requests', async () => {
  let calls = 0
  const queue = createSongMoodQueue(async () => { calls++; return { status: 'not-configured', profile: null } }, 0)
  queue.setEnabled(true)
  queue.enqueue(Array.from({ length: 100 }, (_, n) => track(n)))
  await tick()
  queue.enqueue([track(101)])
  assert.equal(calls, 1)
  assert.equal(queue.get(songMoodKey(track(99))).status, 'not-configured')
  assert.equal(queue.get(songMoodKey(track(101))).status, 'not-configured')
  queue.setEnabled(false)
})

test('disabling clears queued work and ignores stale responses', async () => {
  let release
  let signal
  const queue = createSongMoodQueue((_, s) => { signal = s; return new Promise(resolve => { release = resolve }) }, 0)
  queue.setEnabled(true)
  queue.enqueue([track(1), track(2)])
  queue.setEnabled(false)
  assert(signal.aborted)
  release(result)
  await tick()
  assert.equal(queue.get(songMoodKey(track(1))).status, 'unrated')
  assert.equal(queue.get(songMoodKey(track(2))).status, 'unrated')
})

test('sample songs make no requests and unknown results remain cached', async () => {
  let calls = 0
  const queue = createSongMoodQueue(async () => { calls++; return { status: 'uncertain', profile: null } }, 0)
  queue.setEnabled(true)
  queue.enqueue([{ ...track(1), uri: 'sample:1' }, track(2)])
  await tick()
  queue.enqueue([track(2)])
  assert.equal(calls, 1)
  assert.equal(queue.get(songMoodKey(track(2))).profile, null)
  queue.setEnabled(false)
})
