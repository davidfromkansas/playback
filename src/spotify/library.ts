import type { Disc, Track } from '../types'
import { allPages, spotify } from './api'

interface Image { url: string; width?: number | null }
interface Artist { name: string }
export interface ApiTrack {
  uri: string
  name: string
  artists: Artist[]
  duration_ms: number
  is_local?: boolean
  album?: { id: string; name: string; uri: string; images: Image[]; artists: Artist[]; external_urls: { spotify: string } }
  external_urls?: { spotify: string }
}
export interface ApiAlbum {
  id: string
  name: string
  uri: string
  artists: Artist[]
  images: Image[]
  total_tracks: number
  external_urls: { spotify: string }
  tracks?: { items: ApiTrack[]; next: string | null }
}
export interface ApiPlaylist {
  id: string
  name: string
  uri: string
  collaborative: boolean
  owner: { id: string; display_name?: string | null }
  images: Image[] | null
  external_urls: { spotify: string }
  // Spotify renamed "tracks" to "items" in 2026; accept either.
  items?: { total: number }
  tracks?: { total: number }
}

export interface Me {
  id: string
  display_name?: string | null
}

const CACHE_KEY = 'playback.library.v1'
const CACHE_MAX_AGE = 12 * 60 * 60 * 1000

export const bestImage = (images: Image[] | null | undefined) => images?.[0]?.url

export const toTrack = (t: ApiTrack): Track => ({
  uri: t.uri,
  name: t.name,
  artists: (t.artists ?? []).map((a) => a.name).join(', '),
  durationMs: t.duration_ms,
  imageUrl: bestImage(t.album?.images),
})

export async function fetchMe(): Promise<Me> {
  return spotify<Me>('/me')
}

export async function loadLibrary(me: Me, onProgress: (text: string) => void): Promise<Disc[]> {
  onProgress('Pulling your albums off the rack…')
  const albums = await allPages<{ added_at: string; album: ApiAlbum }>('/me/albums?limit=50', (n, total) =>
    onProgress(`Albums: ${n} of ${total}`),
  )
  onProgress('Grabbing your playlists…')
  const playlists = await allPages<ApiPlaylist>('/me/playlists?limit=50', (n, total) =>
    onProgress(`Playlists: ${n} of ${total}`),
  )
  const liked = await spotify<{ total: number }>('/me/tracks?limit=1')

  const discs: Disc[] = []
  if (liked.total > 0) {
    discs.push({
      id: 'liked',
      kind: 'liked',
      title: 'Liked Songs',
      subtitle: me.display_name ?? 'You',
      uri: `spotify:user:${me.id}:collection`,
      spotifyUrl: 'https://open.spotify.com/collection/tracks',
      trackCount: liked.total,
      tracksAvailable: true,
    })
  }
  for (const { added_at, album } of albums) {
    const tracks = album.tracks?.items.filter((t) => !t.is_local).map(toTrack)
    discs.push({
      id: album.id,
      kind: 'album',
      title: album.name,
      subtitle: album.artists.map((a) => a.name).join(', '),
      uri: album.uri,
      spotifyUrl: album.external_urls.spotify,
      imageUrl: bestImage(album.images),
      trackCount: album.total_tracks,
      addedAt: added_at,
      // Only keep the list if it's complete; long albums load the rest later.
      tracks: album.tracks?.next ? undefined : tracks,
      tracksAvailable: true,
    })
  }
  for (const p of playlists) if (p) discs.push(playlistDisc(p, me))
  saveCache(me.id, discs)
  return discs
}

export function playlistDisc(p: ApiPlaylist, me: Me): Disc {
  return {
    id: p.id,
    kind: 'playlist',
    title: p.name,
    subtitle: p.owner.display_name ?? p.owner.id,
    uri: p.uri,
    spotifyUrl: p.external_urls.spotify,
    imageUrl: bestImage(p.images),
    trackCount: p.items?.total ?? p.tracks?.total ?? 0,
    // Spotify only lists songs for playlists you own or co-edit.
    tracksAvailable: p.owner.id === me.id || p.collaborative,
  }
}

/** Loads the song list for a CD the first time it's opened. */
export async function loadTracks(disc: Disc): Promise<Track[]> {
  if (disc.tracks) return disc.tracks
  if (!disc.tracksAvailable) return []
  let tracks: Track[]
  if (disc.kind === 'album') {
    tracks = (await allPages<ApiTrack>(`/albums/${disc.id}/tracks?limit=50`)).map(toTrack)
  } else if (disc.kind === 'liked') {
    // Liked Songs can be thousands long; the first 200 is plenty for the case insert.
    const first = await spotify<{ items: { track: ApiTrack }[]; next: string | null }>('/me/tracks?limit=50')
    const items = [...first.items]
    let next = first.next
    while (next && items.length < 200) {
      const page = await spotify<{ items: { track: ApiTrack }[]; next: string | null }>(next)
      items.push(...page.items)
      next = page.next
    }
    tracks = items.map((i) => i.track).filter((t) => t && !t.is_local).map(toTrack)
  } else {
    const items = await allPages<{ item?: ApiTrack | null; track?: ApiTrack | null }>(
      `/playlists/${disc.id}/items?limit=50`,
    )
    tracks = items
      .map((i) => i.item ?? i.track)
      .filter((t): t is ApiTrack => !!t && !t.is_local && t.uri.startsWith('spotify:track:'))
      .map(toTrack)
  }
  disc.tracks = tracks
  return tracks
}

interface Cache { userId: string; savedAt: number; discs: Disc[] }

function saveCache(userId: string, discs: Disc[]): void {
  try {
    const slim = discs.map(({ tracks: _tracks, ...rest }) => rest)
    localStorage.setItem(CACHE_KEY, JSON.stringify({ userId, savedAt: Date.now(), discs: slim }))
  } catch {
    // Too big or storage blocked; we'll just reload next time.
  }
}

export function cachedLibrary(userId: string): Disc[] | null {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cache | null
    if (!cache || cache.userId !== userId || Date.now() - cache.savedAt > CACHE_MAX_AGE) return null
    return cache.discs
  } catch {
    return null
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}
