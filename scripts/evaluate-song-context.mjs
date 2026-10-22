import { writeFile, mkdir } from 'node:fs/promises'
import { createMoodService } from '../server/song-mood.mjs'

// Fixed evaluation queries, independent of a user's Spotify account/history.
const songs = [
  ['September', 'Earth, Wind & Fire', 215080], ['Billie Jean', 'Michael Jackson', 294227],
  ['Dancing Queen', 'ABBA', 230400], ['Smells Like Teen Spirit', 'Nirvana', 301920],
  ['Take Five', 'The Dave Brubeck Quartet', 324000], ['Blue in Green', 'Miles Davis', 337000],
  ['Teardrop', 'Massive Attack', 330773], ['Royals', 'Lorde', 190185],
  ['Get Lucky', 'Daft Punk', 369626], ['One More Time', 'Daft Punk', 320357],
  ['No Surprises', 'Radiohead', 229120], ['Hurt', 'Johnny Cash', 216560],
  ['Hurt', 'Nine Inch Nails', 373000], ['Jolene', 'Dolly Parton', 161040],
  ['Three Little Birds', 'Bob Marley & The Wailers', 180000],
  ['B.Y.O.B.', 'System of a Down', 255466], ['Bad Guy', 'Billie Eilish', 194088],
  ['Hyperballad', 'Björk', 321000], ['Clair de lune', 'Claude Debussy', 300000],
  ['September (Live)', 'Earth, Wind & Fire', 215080],
]
if (!process.env.TYPESAFE_API_KEY) throw Error('Set TYPESAFE_API_KEY before the bounded pilot')
const classify = createMoodService({ apiKey: process.env.TYPESAFE_API_KEY, enrichment: true })
const results = []
await mkdir('docs/song-context', { recursive: true })
for (const [title, artist, durationMs] of songs) {
  const result = await classify({ title, artist, durationMs })
  results.push({ query: { title, artist, durationMs }, ...result })
  await writeFile('docs/song-context/evaluation.json', JSON.stringify({
    evaluatedAt: new Date().toISOString(), planned: songs.length, completed: results.length,
    note: 'Coverage/behavior pilot, not ground-truth accuracy. No Spotify account data. No genre-based labels forced.', results,
  }, null, 2) + '\n')
  console.log(`${results.length}/${songs.length}: ${title}: ${result.status}, ${result.context?.length ?? 0} context sources`)
  // Do not keep testing against an unavailable provider. Unattempted songs stay untested.
  if (result.status === 'unavailable') break
}
