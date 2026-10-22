import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Disc, Track } from '../types'
import { spotify } from '../spotify/api'
import { trackDisc, type ShelfRow } from '../spotify/rows'
import { MOOD_ROUTINES, songMoods, type MoodResult, type SongMood } from './songMood'
import { songMoodKey } from './songMoodQueue'
import { collectRemixMusic, emptyRemixCollection } from './remixCollection'

export const REMIX_MOODS = Object.keys(MOOD_ROUTINES).filter(mood => mood !== 'unknown') as SongMood[]
export const moodTitle = (mood: string) => mood[0].toUpperCase() + mood.slice(1)

export function useRemixCollection(enabled: boolean, library: Disc[], sample: boolean) {
  const [collection, setCollection] = useState(emptyRemixCollection)
  const [requestedLibrary, setRequestedLibrary] = useState<Disc[] | null>(null)
  useEffect(() => { if (enabled && !sample) setRequestedLibrary(library) }, [enabled, library, sample])
  useEffect(() => { setCollection(emptyRemixCollection()) }, [library, sample])
  useEffect(() => {
    if (requestedLibrary !== library || sample) return
    const controller = new AbortController()
    void collectRemixMusic(library, spotify, value => {
      if (!controller.signal.aborted) setCollection(value)
    }, controller.signal).catch(() => {
      if (!controller.signal.aborted) setCollection(value => ({ ...value, loading: false,
        issues: [...value.issues, 'Music loading stopped. Use Reload from Spotify to retry.'] }))
    })
    return () => controller.abort()
  }, [requestedLibrary, library, sample])
  return collection
}

export function groupRemixTracks(tracks: readonly Track[], get: (track: Track) => MoodResult, sample = false) {
  const buckets = new Map<string, Disc[]>(['pending', ...REMIX_MOODS, 'unrated'].map(id => [id, []]))
  const unique = new Set<string>()
  let classified = 0
  const outcomes = { unmatched: 0, uncertain: 0, unavailable: 0 }
  let setup = false
  let unsupported = false
  for (const track of tracks) {
    if (unique.has(track.uri)) continue
    unique.add(track.uri)
    const result = get(track)
    // Fake sample songs use explicitly labelled demo assignments, never Jev claims.
    const demoIndex = [...track.uri].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) >>> 0, 0) % REMIX_MOODS.length
    const mood = sample ? (track.demoMood as SongMood | undefined) ?? REMIX_MOODS[demoIndex] : result.profile?.mood
    const reliable = mood && mood !== 'unknown' && buckets.has(mood)
    const pending = !sample && ['unrated', 'queued', 'loading'].includes(result.status)
    const id = reliable ? mood : pending ? 'pending' : 'unrated'
    if (reliable) classified++
    if (!sample && result.status === 'no-match') outcomes.unmatched++
    if (!sample && result.status === 'uncertain') outcomes.uncertain++
    if (!sample && ['unavailable', 'busy'].includes(result.status)) outcomes.unavailable++
    setup ||= result.status === 'not-configured'
    unsupported ||= result.status === 'unsupported'
    buckets.get(id)!.push(trackDisc(track))
  }
  const rows: ShelfRow[] = [...buckets].map(([id, discs]) => ({
    id: `remix:${id}`, title: id === 'pending' ? 'Finding a mood' : id === 'unrated' ? 'Unrated' : moodTitle(id), discs,
    note: discs.length ? undefined : id === 'pending' ? 'All loaded songs checked' : 'No songs in this mood yet',
  }))
  return { rows, classified, total: unique.size, pending: buckets.get('pending')!.length, setup, unsupported, outcomes }
}

export function useRemixRows(tracks: readonly Track[], sample: boolean) {
  const revision = useSyncExternalStore(songMoods.subscribe, songMoods.revision, songMoods.revision)
  return useMemo(() => groupRemixTracks(tracks, track => songMoods.get(songMoodKey(track)), sample), [tracks, sample, revision])
}
