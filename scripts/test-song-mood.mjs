import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMoodService, jevRequest, matchRecording, parseMood, publicFacts } from '../server/song-mood.mjs'

const id = '01234567-0123-4123-8123-0123456789ab'
const query = { title: 'Example Song', artist: 'Example Artist', durationMs: 200000 }
const recording = { id, title: 'Example Song', length: 200000,
  'artist-credit': [{ name: 'Example Artist' }], tags: [{ name: 'do not send' }], annotation: 'private text' }
const recognized = { model: 'fixture', answers: {
  mood: { choice: 'dreamy', confidence: .9, probabilities: { dreamy: .8 } },
  recognition: { choice: 'known', confidence: .9 },
} }

test('only canonical core facts reach Jev, even when the input includes extra fields', () => {
  const facts = publicFacts(recording, id)
  assert(facts)
  const state = jevRequest({ ...facts, spotifyUri: 'secret', lyrics: 'secret' }).state
  assert.deepEqual(Object.keys(state).sort(), ['artists', 'recordingId', 'source', 'title'])
  assert(!JSON.stringify(state).includes('secret'))
  assert(!JSON.stringify(facts).includes('do not send'))
  assert.equal(publicFacts(recording, 'invalid'), null)
})

test('mismatched versions, duration, credits, and ambiguous recordings stay unknown', () => {
  assert.equal(matchRecording(query, [recording]), id)
  assert.equal(matchRecording({ ...query, title: 'Example Song (Live)' }, [recording]), null)
  assert.equal(matchRecording({ ...query, durationMs: 230000 }, [recording]), null)
  assert.equal(matchRecording({ ...query, artist: 'Other Artist' }, [recording]), null)
  assert.equal(matchRecording(query, [recording, { ...recording, id: '11234567-0123-4123-8123-0123456789ab' }]), null)
})

test('uncertain or malformed classifier answers cannot choose choreography', () => {
  assert.equal(parseMood(recognized).mood, 'dreamy')
  for (const choice of ['unknown', 'not-a-mood', '__proto__']) {
    assert.equal(parseMood({ answers: { ...recognized.answers, mood: { ...recognized.answers.mood, choice } } }), null)
  }
  assert.equal(parseMood({ answers: { ...recognized.answers, recognition: { choice: 'unknown', confidence: 1 } } }), null)
  assert.equal(parseMood({ answers: { ...recognized.answers, mood: { choice: 'dreamy', confidence: .1 } } }), null)
  assert.equal(parseMood(null), null)
})

test('service resolves canonical public facts, deduplicates, and caches without forwarding lookup inputs', async () => {
  const calls = []
  const service = createMoodService({ apiKey: 'test-key', wait: async () => {}, fetcher: async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => url.includes('typesafe') ? recognized
      : url.includes('query=') ? { recordings: [recording] } : recording }
  } })
  const [a, b] = await Promise.all([service(query), service(query)])
  assert.deepEqual(a, b)
  assert.equal(a.status, 'classified')
  assert.equal(calls.length, 3)
  await service(query)
  assert.equal(calls.length, 3)
  const body = JSON.parse(calls[2].options.body)
  assert.equal(body.state.recordingId, id)
  assert(!JSON.stringify(body).includes('durationMs'))
  assert(!JSON.stringify(body).includes('tags'))
})

test('missing credentials, missing matches, and upstream failures leave playback independent', async () => {
  let calls = 0
  const fetcher = async () => { calls++; throw Error('offline') }
  assert.equal((await createMoodService({ fetcher })(query)).status, 'not-configured')
  assert.equal(calls, 0)
  assert.equal((await createMoodService({ apiKey: 'test', fetcher, wait: async () => {} })(query)).status, 'unavailable')
  assert.equal((await createMoodService({ apiKey: 'test' })({ title: 'bad' })).status, 'invalid-query')
  const noMatch = createMoodService({ apiKey: 'test', wait: async () => {}, fetcher: async () => {
    calls++; return { ok: true, json: async () => ({ recordings: [] }) }
  } })
  calls = 0
  assert.equal((await noMatch(query)).status, 'no-match')
  assert.equal(calls, 1)
})
