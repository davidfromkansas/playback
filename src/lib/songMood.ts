import { useEffect, useSyncExternalStore } from 'react'
import type { Track } from '../types'
import type { VoltRoutine } from '../ui/voltAnimation'
import { createSongMoodQueue, songMoodKey } from './songMoodQueue'

export const MOOD_ROUTINES = {
  relaxed: ['groove', 'smurf', 'armwave'], dreamy: ['armwave', 'groove'],
  melancholic: ['groove', 'armwave'], romantic: ['armwave', 'groove', 'smurf'],
  joyful: ['rabbit', 'wave', 'cabbage'], playful: ['bart', 'cabbage', 'duck'],
  funky: ['smurf', 'cabbage', 'points'], confident: ['toprock', 'points', 'bart'],
  driving: ['running', 'toprock', 'groove'], defiant: ['punch', 'duck', 'toprock'],
  euphoric: ['wave', 'rabbit', 'running'], tense: ['toprock', 'groove'],
  nostalgic: ['smurf', 'groove', 'cabbage'], solemn: ['groove', 'armwave'],
  majestic: ['wave', 'armwave'], restless: ['bart', 'duck', 'running'],
  unknown: ['groove'],
} as const satisfies Record<string, readonly VoltRoutine[]>
export type SongMood = keyof typeof MOOD_ROUTINES
export interface MoodResult {
  status: string
  profile: { mood: SongMood; confidence: number; probability: number } | null
  source?: { sourceUrl: string; title: string; artists: string[] }
}
const unavailable: MoodResult = { status: 'unavailable', profile: null }

export async function classifyPublicSong(title: string, artist: string, durationMs: number,
  signal?: AbortSignal): Promise<MoodResult> {
  const response = await fetch('/api/song-mood', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, artist, durationMs }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
  })
  if (response.status === 404 || !response.headers.get('content-type')?.includes('application/json')) {
    return { status: 'unsupported', profile: null }
  }
  if (!response.ok) return unavailable
  const result = await response.json() as MoodResult
  if (typeof result.status !== 'string') return unavailable
  if (result.profile && (!Object.hasOwn(MOOD_ROUTINES, result.profile.mood)
    || !Number.isFinite(result.profile.confidence) || result.profile.confidence < 0.7
    || result.profile.confidence > 1)) return unavailable
  return result
}

export const songMoods = createSongMoodQueue((track, signal) =>
  classifyPublicSong(track.name, track.artists, track.durationMs, signal))

export function useLoadedSongMoods(tracks: readonly Track[], enabled: boolean) {
  useEffect(() => {
    songMoods.setEnabled(enabled)
    return () => songMoods.setEnabled(false)
  }, [enabled])
  useEffect(() => { if (enabled) songMoods.enqueue(tracks) }, [tracks, enabled])
}

export function useSongMoodResult(track: Track | null): MoodResult {
  const key = track ? songMoodKey(track) : ''
  return useSyncExternalStore(songMoods.subscribe, () => songMoods.get(key), () => songMoods.get(''))
}

export function useSongMood(track: Track | null, enabled: boolean): SongMood {
  const result = useSongMoodResult(track)
  const key = track ? songMoodKey(track) : ''
  useEffect(() => { if (enabled && track) songMoods.enqueue([track], true) }, [key, enabled, track])
  return enabled ? result.profile?.mood ?? 'unknown' : 'unknown'
}

export function moodLabel(result: MoodResult): { text: string; detail: string } {
  const mood = result.profile?.mood
  if (mood && mood !== 'unknown') return {
    text: mood[0].toUpperCase() + mood.slice(1), detail: `Estimated mood: ${mood}`,
  }
  if (result.status === 'queued' || result.status === 'loading') {
    return { text: '…', detail: 'Finding song mood' }
  }
  return { text: 'Unrated', detail: result.status === 'not-configured'
    ? 'Mood lookup is not configured yet' : 'No reliable mood estimate available' }
}
