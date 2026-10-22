import type { Disc, Track } from '../types'
import type { ApiTrack } from '../spotify/library'

export interface RemixCollection {
  tracks: Track[]
  loading: boolean
  source: string
  recentCount: number
  issues: string[]
}
export const emptyRemixCollection = (): RemixCollection => ({ tracks: [], loading: false, source: '', recentCount: 0, issues: [] })
type Request = <T>(path: string, init?: RequestInit) => Promise<T>
interface Page<T> { items: T[]; next?: string | null }
interface Recent { track: ApiTrack; played_at: string }

// Spotify's data stays in the browser. Only song identity goes to the separate
// public-catalog resolver; listening history never enters Jev's payload.
export async function collectRemixMusic(
  library: Disc[], request: Request, update: (state: RemixCollection) => void, signal: AbortSignal,
) {
  const found = new Map<string, Track>()
  const issues = new Set<string>()
  let source = 'Recently played'
  let recentCount = 0
  const publish = (loading = true) => {
    signal.throwIfAborted()
    update({ tracks: [...found.values()], loading, source, recentCount, issues: [...issues] })
  }
  const add = (track: ApiTrack | null | undefined, image?: string) => {
    if (!track?.uri?.startsWith('spotify:track:') || track.is_local || !track.name) return
    if (!found.has(track.uri)) found.set(track.uri, {
      uri: track.uri, name: track.name, artists: (track.artists ?? []).map(a => a.name).join(', '),
      durationMs: track.duration_ms, imageUrl: track.album?.images?.[0]?.url ?? image,
    })
  }
  const get = <T,>(path: string) => {
    signal.throwIfAborted()
    return request<T>(path, { signal })
  }
  const safely = async (label: string, work: () => Promise<void>) => {
    try { await work() } catch (error) {
      signal.throwIfAborted()
      const status = (error as { status?: number }).status
      issues.add(status === 403 ? `${label}: sign out and back in to grant access, or Spotify may restrict this source`
        : `${label}: couldn't load everything; use Reload from Spotify to retry`)
      publish()
    }
  }
  const pages = async <T,>(path: string, consume: (item: T) => void) => {
    const visited = new Set<string>()
    let next: string | null | undefined = path
    while (next) {
      if (visited.has(next)) { issues.add(`${source}: Spotify repeated a page`); break }
      visited.add(next)
      const page: Page<T> = await get<Page<T>>(next)
      if (!page.items?.length) break
      page.items.forEach(consume)
      publish()
      next = page.next
    }
  }

  publish()
  await safely(source, async () => {
    let before = Infinity
    const plays = new Set<string>()
    while (true) {
      const page = await get<Page<Recent>>(`/me/player/recently-played?limit=50${Number.isFinite(before) ? `&before=${before}` : ''}`)
      let oldest = before
      let fresh = 0
      for (const item of page.items ?? []) {
        const time = Date.parse(item.played_at)
        if (Number.isFinite(time)) oldest = Math.min(oldest, time - 1)
        const key = `${item.track?.uri}:${item.played_at}`
        if (plays.has(key)) continue
        plays.add(key)
        fresh++
        add(item.track)
      }
      recentCount = found.size
      publish()
      if (!fresh || !page.items?.length || !Number.isFinite(oldest) || oldest >= before) break
      before = oldest
    }
  })
  source = 'Liked Songs'
  await safely(source, () => pages<{ track: ApiTrack }>('/me/tracks?limit=50', item => add(item.track)))
  for (const range of ['short_term', 'medium_term', 'long_term']) {
    source = 'Top tracks'
    let forbidden = false
    await safely(source, async () => {
      try { await pages<ApiTrack>(`/me/top/tracks?limit=50&time_range=${range}`, add) }
      catch (error) { forbidden = (error as { status?: number }).status === 403; throw error }
    })
    if (forbidden) break
  }
  // Read every accessible saved album/playlist, not just the ten visible rows.
  // Sequential pages keep large libraries from flooding Spotify with requests.
  let restricted = 0
  for (const disc of library) {
    if (disc.kind === 'liked' || disc.kind === 'track') continue
    if (!disc.tracksAvailable) { restricted++; continue }
    source = disc.title
    await safely(source, async () => {
      if (disc.tracks) {
        for (const track of disc.tracks) if (!found.has(track.uri)) found.set(track.uri, { ...track, imageUrl: track.imageUrl ?? disc.imageUrl })
        publish()
      } else if (disc.kind === 'album') {
        await pages<ApiTrack>(`/albums/${disc.id}/tracks?limit=50`, track => add(track, disc.imageUrl))
      } else {
        await pages<{ item?: ApiTrack; track?: ApiTrack }>(`/playlists/${disc.id}/items?limit=50`, item => add(item.item ?? item.track))
      }
    })
  }
  if (restricted) issues.add(`${restricted} followed playlists couldn't be expanded because Spotify doesn't share their tracks`)
  source = ''
  publish(false)
}
