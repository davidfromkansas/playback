// Song lyrics from LRCLIB (https://lrclib.net), a free, open lyrics database that browsers can call
// directly (no key, CORS allowed). Spotify's own API doesn't offer lyrics.
import type { Track } from '../types'

export interface LyricLine {
  /** When the line starts, in ms from the start of the song. */
  timeMs: number
  text: string
}

export type Lyrics =
  | { kind: 'synced'; lines: LyricLine[] }
  | { kind: 'plain'; lines: string[] }
  | { kind: 'instrumental' }
  | { kind: 'none' }

interface LrclibRecord {
  trackName: string
  artistName: string
  duration: number
  instrumental: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

const API = 'https://lrclib.net/api'
const cache = new Map<string, Promise<Lyrics>>()

/** Lyrics for a song. Never rejects: network trouble or no match comes back as `none`. */
export function fetchLyrics(track: Track, album?: string): Promise<Lyrics> {
  const key = track.uri || `${track.artists}/${track.name}`
  let found = cache.get(key)
  if (!found) {
    found = lookup(track, album).catch(() => ({ kind: 'none' }) as const)
    cache.set(key, found)
  }
  return found
}

async function lookup(track: Track, album?: string): Promise<Lyrics> {
  // Spotify lists every artist ("A, B"); LRCLIB usually files songs under the first one.
  const artist = track.artists.split(',')[0].trim()
  const seconds = Math.round(track.durationMs / 1000)
  // An exact match on name, artist, album and length is best...
  const exact = new URLSearchParams({ track_name: track.name, artist_name: artist, duration: String(seconds) })
  if (album) exact.set('album_name', album)
  const hit = await get<LrclibRecord>(`${API}/get?${exact}`)
  if (hit && hasLyrics(hit)) return toLyrics(hit)
  // ...otherwise search, and take the closest length that has lyrics.
  const results = (await get<LrclibRecord[]>(`${API}/search?${new URLSearchParams({ track_name: track.name, artist_name: artist })}`)) ?? []
  const best = results
    .filter((r) => hasLyrics(r) && Math.abs(r.duration - seconds) <= 5)
    .sort((a, b) => Math.abs(a.duration - seconds) - Math.abs(b.duration - seconds))[0]
  return best ? toLyrics(best) : { kind: 'none' }
}

async function get<T>(url: string): Promise<T | null> {
  const res = await fetch(url)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`LRCLIB ${res.status}`)
  return (await res.json()) as T
}

const hasLyrics = (r: LrclibRecord) => r.instrumental || !!r.syncedLyrics || !!r.plainLyrics

function toLyrics(r: LrclibRecord): Lyrics {
  if (r.syncedLyrics) {
    const lines = parseLrc(r.syncedLyrics)
    if (lines.length) return { kind: 'synced', lines }
  }
  if (r.plainLyrics) return { kind: 'plain', lines: r.plainLyrics.split('\n').map((l) => l.trim()) }
  return r.instrumental ? { kind: 'instrumental' } : { kind: 'none' }
}

/** Reads LRC text: "[01:23.45] words". A line can carry several time stamps. */
export function parseLrc(text: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of text.split('\n')) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    if (!stamps.length) continue
    const words = raw.replace(/\[[^\]]*\]/g, '').trim()
    for (const s of stamps) lines.push({ timeMs: (Number(s[1]) * 60 + Number(s[2])) * 1000, text: words })
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs)
}
