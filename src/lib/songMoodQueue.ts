import type { Track } from '../types'
import type { MoodResult } from './songMood'

export const UNRATED: MoodResult = { status: 'unrated', profile: null }
export const songMoodKey = (track: Pick<Track, 'name' | 'artists' | 'durationMs'>) =>
  JSON.stringify([track.name, track.artists, track.durationMs])

export function createSongMoodQueue(
  classify: (track: Track, signal: AbortSignal) => Promise<MoodResult>,
  delay = 2200,
) {
  const entries = new Map<string, MoodResult>()
  const waiting = new Map<string, Track>()
  const listeners = new Set<() => void>()
  let enabled = false
  let stopped = false
  let running: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const notify = () => listeners.forEach(listener => listener())
  const pump = async () => {
    if (!enabled || stopped || running || !waiting.size) return
    const [key, track] = waiting.entries().next().value!
    waiting.delete(key)
    const controller = new AbortController()
    running = controller
    entries.set(key, { status: 'loading', profile: null })
    notify()
    let result: MoodResult
    try { result = await classify(track, controller.signal) }
    catch { result = { status: 'unavailable', profile: null } }
    // Signing out can replace the queue while a provider request is finishing.
    if (running !== controller) return
    running = null
    entries.set(key, result)
    if (result.status === 'not-configured' || result.status === 'unsupported') {
      stopped = true
      for (const pendingKey of waiting.keys()) entries.set(pendingKey, result)
      waiting.clear()
    }
    notify()
    timer = setTimeout(() => { timer = undefined; void pump() }, delay)
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    get: (key: string) => entries.get(key) ?? UNRATED,
    setEnabled(value: boolean) {
      enabled = value
      if (!value) {
        clearTimeout(timer)
        timer = undefined
        running?.abort()
        running = null
        waiting.clear()
        entries.clear()
        stopped = false
        notify()
      }
    },
    enqueue(tracks: readonly Track[], priority = false) {
      if (!enabled) return
      for (const track of tracks) {
        if (track.uri.startsWith('sample:') || !track.name || !track.artists) continue
        const key = songMoodKey(track)
        if (priority && waiting.has(key)) {
          const remaining = [...waiting]
          waiting.clear()
          waiting.set(key, track)
          for (const [k, t] of remaining) waiting.set(k, t)
        }
        if (entries.has(key)) continue
        entries.set(key, { status: stopped ? 'not-configured' : 'queued', profile: null })
        if (!stopped) waiting.set(key, track)
      }
      notify()
      if (!timer) void pump()
    },
  }
}
