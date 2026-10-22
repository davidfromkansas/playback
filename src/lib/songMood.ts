import { useEffect, useState } from 'react'
import type { Track } from '../types'
import type { VoltRoutine } from '../ui/voltAnimation'

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
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return unavailable
  const result = await response.json() as MoodResult
  if (typeof result.status !== 'string') return unavailable
  if (result.profile && (!Object.hasOwn(MOOD_ROUTINES, result.profile.mood)
    || !Number.isFinite(result.profile.confidence) || result.profile.confidence < 0.7
    || result.profile.confidence > 1)) return unavailable
  return result
}

export function useSongMood(track: Track | null, enabled: boolean): SongMood {
  const [resolved, setResolved] = useState<{ key: string; mood: SongMood } | null>(null)
  const title = track?.name ?? ''
  const artist = track?.artists ?? ''
  const duration = track?.durationMs ?? 0
  const key = JSON.stringify([title, artist, duration])
  useEffect(() => {
    if (!enabled || !title || !artist) return
    const controller = new AbortController()
    // Brief track skips should not create catalog requests.
    const timer = setTimeout(() => {
      void classifyPublicSong(title, artist, duration, controller.signal).then(result => {
        if (!controller.signal.aborted) setResolved({ key, mood: result.profile?.mood ?? 'unknown' })
      }).catch(() => {})
    }, 1200)
    return () => { clearTimeout(timer); controller.abort() }
  }, [title, artist, duration, key, enabled])
  return enabled && resolved?.key === key ? resolved.mood : 'unknown'
}
