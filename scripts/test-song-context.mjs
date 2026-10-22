import assert from 'node:assert/strict'
import { test } from 'node:test'
import { linkedItems, claimIds, songContext } from '../server/song-context.mjs'
import { jevRequest, parseMood } from '../server/song-mood.mjs'
const claim = id => ({ mainsnak: { datavalue: { value: { id } } } })
test('only explicit Wikidata links are fetched; arbitrary hosts and relations are excluded', () => {
  assert.deepEqual(linkedItems({ relations: [
    { type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q1' } },
    { type: 'wikidata', url: { resource: 'https://evil.example/wiki/Q2' } },
    { type: 'wikipedia', url: { resource: 'https://www.wikidata.org/wiki/Q3' } },
  ] }), ['Q1'])
  assert.deepEqual(claimIds({ claims: { P136: [claim('Q2'), { ...claim('Q3'), rank: 'deprecated' }] } }, 'P136'), ['Q2'])
})
test('context carries licensed genre and instrumentation facts, not arbitrary descriptions', async () => {
  const result = await songContext({ relations: [{ type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q1' } }] }, async url => ({
    ok: true, json: async () => ({ entities: url.includes('ids=Q1&')
      ? { Q1: { id: 'Q1', claims: { P136: [claim('Q2')], P870: [claim('Q3')] }, description: 'injected text' } }
      : { Q2: { labels: { en: { value: 'funk' } } }, Q3: { labels: { en: { value: 'piano' } } } } }),
  }))
  assert.equal(result[0].genres[0].name, 'funk')
  assert.equal(result[0].license, 'CC0-1.0')
  assert.equal(result[0].instruments[0].name, 'piano')
  assert(!JSON.stringify(result).includes('injected'))
  const request = jevRequest({ recordingId: 'x', title: 'Song', artists: ['Artist'] }, result)
  assert(request.questions.evidence)
  assert(!request.questions.recognition)
})
test('sparse evidence cannot become a confident mood, even when mood answer is confident', () => {
  const answers = { mood: { choice: 'funky', confidence: .9, probabilities: { funky: .8 } },
    evidence: { choice: 'insufficient', confidence: .95 } }
  assert.equal(parseMood({ answers }, true), null)
  answers.evidence = { choice: 'sufficient', confidence: .9 }
  assert.equal(parseMood({ answers }, true).energy, 'unknown')
})
test('missing links cost no enrichment requests', async () => {
  assert.deepEqual(await songContext({}, () => { throw Error('must not call') }), [])
})

test('enriched service skips Jev without evidence and uses the evidence gate with linked facts', async () => {
  const { createMoodService } = await import('../server/song-mood.mjs')
  const id = '01234567-0123-4123-8123-0123456789ab'
  const recording = { id, title: 'Song', length: 100000, 'artist-credit': [{ name: 'Artist' }] }
  let jevCalls = 0
  const fetcher = async (url, options) => ({ ok: true, json: async () => {
    if (url.includes('typesafe')) {
      jevCalls++
      const body = JSON.parse(options.body)
      assert.equal(body.state.musicalContext[0].genres[0].name, 'funk')
      assert(!JSON.stringify(body).includes('spotify:'))
      return { answers: { mood: { choice: 'funky', confidence: .9, probabilities: { funky: .8 } },
        evidence: { choice: 'sufficient', confidence: .9 } } }
    }
    if (url.includes('wikidata')) return { entities: url.includes('ids=Q1&')
      ? { Q1: { id: 'Q1', claims: { P136: [claim('Q2')] } } }
      : { Q2: { labels: { en: { value: 'funk' } } } } }
    return url.includes('query=') ? { recordings: [recording] } : recording
  } })
  const query = { title: 'Song', artist: 'Artist', durationMs: 100000, spotifyUri: 'spotify:private' }
  const empty = createMoodService({ apiKey: 'fixture', fetcher, wait: async () => {}, enrichment: true })
  assert.equal((await empty(query)).status, 'insufficient-context')
  assert.equal(jevCalls, 0)
  recording.relations = [{ type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q1' } }]
  const service = createMoodService({ apiKey: 'fixture', fetcher, wait: async () => {}, enrichment: true })
  assert.equal((await service(query)).profile.mood, 'funky')
  assert.equal((await service({ ...query, title: 'song' })).profile.mood, 'funky')
  assert.equal(jevCalls, 1)
})

test('composition context stays explicitly scoped and medleys are not collapsed', async () => {
  const { createMoodService } = await import('../server/song-mood.mjs')
  const id = '01234567-0123-4123-8123-0123456789ab'
  const workId = '11234567-0123-4123-8123-0123456789ab'
  const recording = { id, title: 'Cover', length: 100000, 'artist-credit': [{ name: 'Artist' }],
    relations: [{ type: 'performance', work: { id: workId } }] }
  let calls = 0
  const fetcher = async (url, options) => ({ ok: true, json: async () => {
    if (url.includes('typesafe')) {
      calls++
      assert.match(JSON.parse(options.body).state.musicalContext[0].scope, /not recording-specific/)
      return { answers: { mood: { choice: 'unknown' }, evidence: { choice: 'insufficient' } } }
    }
    if (url.includes('wikidata')) return { entities: url.includes('ids=Q1&')
      ? { Q1: { id: 'Q1', claims: { P136: [claim('Q2')] } } }
      : { Q2: { labels: { en: { value: 'folk music' } } } } }
    if (url.includes('work/')) return { id: workId,
      relations: [{ type: 'wikidata', url: { resource: 'https://www.wikidata.org/wiki/Q1' } }] }
    return url.includes('query=') ? { recordings: [recording] } : recording
  } })
  const options = { apiKey: 'fixture', fetcher, wait: async () => {}, enrichment: true }
  const query = { title: 'Cover', artist: 'Artist', durationMs: 100000 }
  assert.equal((await createMoodService(options)(query)).status, 'uncertain')
  assert.equal(calls, 1)
  recording.relations.push({ type: 'performance', work: { id: '21234567-0123-4123-8123-0123456789ab' } })
  assert.equal((await createMoodService(options)(query)).status, 'insufficient-context')
  assert.equal(calls, 1)
})
