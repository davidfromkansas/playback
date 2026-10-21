// The Street look's rows of CDs, top to bottom:
//   1. Recently Played: what you listened to lately, newest first. Songs played from an album or
//      playlist show as that album or playlist; anything else shows as the song itself.
//   2. Liked Songs, one CD per song.
//   3-12. Your ten most recently played albums and playlists, one CD per song. If you haven't
//      played ten lately, the rest are your most recently saved ones.
import type { Disc, Track } from '../types'
import { spotify, SpotifyError } from './api'
import { bestImage, loadTracks, playlistDisc, toTrack, type ApiAlbum, type ApiPlaylist, type ApiTrack, type Me } from './library'

export interface ShelfRow {
  id: string
  title: string
  discs: Disc[]
  loading?: boolean
  /** Shown on the row when it has nothing (or not everything) to show. */
  note?: string
}

const CONTEXT_ROWS = 10

interface RecentItem {
  track: ApiTrack
  played_at: string
  context: { type: string; uri: string } | null
}

/** One song as its own CD. */
export function trackDisc(track: Track, opts: { contextUri?: string; image?: string; spotifyUrl?: string } = {}): Disc {
  return {
    id: `track:${track.uri}:${opts.contextUri ?? ''}`,
    kind: 'track',
    title: track.name,
    subtitle: track.artists,
    uri: track.uri,
    spotifyUrl: opts.spotifyUrl ?? `https://open.spotify.com/track/${track.uri.split(':').pop()}`,
    imageUrl: track.imageUrl ?? opts.image,
    trackCount: 1,
    tracks: [{ ...track, imageUrl: track.imageUrl ?? opts.image }],
    tracksAvailable: true,
    contextUri: opts.contextUri,
  }
}

/** A row holding every song of an album or playlist (or Liked Songs) as separate CDs. */
export async function songsRow(disc: Disc, id = `songs:${disc.id}`): Promise<ShelfRow> {
  if (!disc.tracksAvailable) {
    // Spotify won't list the songs of playlists you only follow, but the whole playlist still plays.
    return { id, title: disc.title, discs: [disc], note: "Spotify doesn't share the songs in playlists you don't own" }
  }
  const tracks = await loadTracks(disc)
  return {
    id,
    title: disc.title,
    discs: tracks.map((t) => trackDisc(t, { contextUri: disc.uri, image: disc.imageUrl })),
    note: tracks.length ? undefined : 'No songs here yet',
  }
}

/** The first rows, ready to show while the album and playlist rows load. */
export function startingRows(): ShelfRow[] {
  return [
    { id: 'recent', title: 'Recently Played', discs: [], loading: true },
    { id: 'liked', title: 'Liked Songs', discs: [], loading: true },
  ]
}

/**
 * Loads every row for a signed-in listener. Calls `update` as rows fill in, so the first ones
 * appear before all the album and playlist songs have loaded.
 */
export async function loadRows(me: Me, library: Disc[], update: (rows: ShelfRow[]) => void): Promise<void> {
  let rows = startingRows()
  const put = (row: ShelfRow) => {
    const i = rows.findIndex((r) => r.id === row.id)
    rows = i < 0 ? [...rows, row] : rows.map((r, j) => (j === i ? row : r))
    update(rows)
  }

  // 1. Recently played
  let recent: RecentItem[] = []
  let recentNote: string | undefined
  try {
    recent = (await spotify<{ items: RecentItem[] }>('/me/player/recently-played?limit=50')).items
  } catch (e) {
    recentNote =
      e instanceof SpotifyError && (e.status === 401 || e.status === 403)
        ? 'Sign out and back in to let Playback see what you played'
        : "Couldn't load what you played lately"
  }
  const contexts: Disc[] = []
  const recentDiscs: Disc[] = []
  const seen = new Set<string>()
  for (const { track, context } of recent) {
    if (!track || track.is_local) continue
    const ctx = context && (context.type === 'album' || context.type === 'playlist') ? context : null
    const key = ctx?.uri ?? track.uri
    if (seen.has(key)) continue
    seen.add(key)
    if (!ctx) {
      recentDiscs.push(trackDisc(toTrack(track), { contextUri: track.album?.uri, spotifyUrl: track.external_urls?.spotify }))
      continue
    }
    const disc = await contextDisc(ctx, track, library, me)
    if (!disc) continue
    recentDiscs.push(disc)
    contexts.push(disc)
  }
  put({ id: 'recent', title: 'Recently Played', discs: recentDiscs, note: recentNote ?? (recentDiscs.length ? undefined : 'Nothing played lately') })

  // 2. Liked Songs
  const liked = library.find((d) => d.kind === 'liked')
  if (liked) {
    const row = await songsRow(liked, 'liked').catch(() => ({ id: 'liked', title: 'Liked Songs', discs: [], note: "Couldn't load your Liked Songs" }))
    put({ ...row, title: 'Liked Songs' })
  } else put({ id: 'liked', title: 'Liked Songs', discs: [], note: 'No liked songs yet' })

  // 3-12. Recently played albums and playlists, topped up with recently saved ones.
  for (const d of library) {
    if (contexts.length >= CONTEXT_ROWS) break
    if (d.kind !== 'liked' && !contexts.some((c) => c.uri === d.uri)) contexts.push(d)
  }
  const picks = contexts.slice(0, CONTEXT_ROWS)
  picks.forEach((d) => put({ id: `songs:${d.id}`, title: d.title, discs: [], loading: true }))
  await Promise.all(
    picks.map((d) =>
      songsRow(d)
        .catch(() => ({ id: `songs:${d.id}`, title: d.title, discs: [d], note: "Couldn't load the songs" }))
        .then(put),
    ),
  )
}

/** The album or playlist a song was played from, as a CD. */
async function contextDisc(ctx: { type: string; uri: string }, track: ApiTrack, library: Disc[], me: Me): Promise<Disc | null> {
  const saved = library.find((d) => d.uri === ctx.uri)
  if (saved) return saved
  const id = ctx.uri.split(':').pop()!
  if (ctx.type === 'album' && track.album) {
    const a = track.album
    return {
      id: a.id,
      kind: 'album',
      title: a.name,
      subtitle: a.artists.map((x) => x.name).join(', '),
      uri: a.uri,
      spotifyUrl: a.external_urls.spotify,
      imageUrl: bestImage(a.images),
      trackCount: 0,
      tracksAvailable: true,
    }
  }
  try {
    return playlistDisc(await spotify<ApiPlaylist>(`/playlists/${id}?fields=id,name,uri,collaborative,owner,images,external_urls`), me)
  } catch {
    return null
  }
}

/** Made-up rows for sample mode, built from the sample library. */
export function sampleRows(library: Disc[]): ShelfRow[] {
  const albums = library.filter((d) => d.kind === 'album')
  const playlists = library.filter((d) => d.kind === 'playlist')
  const liked = library.find((d) => d.kind === 'liked')
  const recentContexts = [albums[3], playlists[1], albums[0], albums[7], playlists[4], albums[12], albums[2], playlists[0], albums[20], albums[5]]
  const singles = [albums[30], albums[41], playlists[6], albums[9]].map((d, i) => trackDisc(d.tracks![i % d.tracks!.length], { contextUri: d.uri, image: d.imageUrl }))
  const recent: Disc[] = []
  recentContexts.forEach((d, i) => {
    recent.push(d)
    if (i % 3 === 1 && singles.length) recent.push(singles.shift()!)
  })
  const songs = (d: Disc, id = `songs:${d.id}`): ShelfRow => ({
    id,
    title: d.title,
    discs: (d.tracks ?? []).map((t) => trackDisc(t, { contextUri: d.uri, image: d.imageUrl })),
  })
  return [
    { id: 'recent', title: 'Recently Played', discs: [...recent, ...singles] },
    liked ? { ...songs(liked, 'liked'), title: 'Liked Songs' } : { id: 'liked', title: 'Liked Songs', discs: [] },
    ...recentContexts.map((d) => songs(d)),
  ]
}

/**
 * The search results page: everything on Spotify matching `query`, as rows of Songs, Albums and
 * Playlists (best match first). In sample mode it searches the sample CDs instead.
 */
export async function searchRows(query: string, me: Me | null, library: Disc[]): Promise<ShelfRow[]> {
  let songs: Disc[], albums: Disc[], playlists: Disc[]
  if (!me) ({ songs, albums, playlists } = sampleSearch(query, library))
  else {
    const q = new URLSearchParams({ q: query, type: 'track,album,playlist', limit: '10' })
    const found = await spotify<{
      tracks?: { items: (ApiTrack | null)[] }
      albums?: { items: (ApiSearchAlbum | null)[] }
      playlists?: { items: (ApiPlaylist | null)[] }
    }>(`/search?${q}`)
    // Spotify sometimes leaves gaps (null) in the results.
    songs = (found.tracks?.items ?? [])
      .filter((t): t is ApiTrack => !!t && !t.is_local)
      .map((t) => trackDisc(toTrack(t), { contextUri: t.album?.uri, spotifyUrl: t.external_urls?.spotify }))
    albums = (found.albums?.items ?? []).filter((a): a is ApiSearchAlbum => !!a).map((a) => albumDisc(a, library))
    playlists = (found.playlists?.items ?? [])
      .filter((p): p is ApiPlaylist => !!p)
      .map((p) => library.find((d) => d.uri === p.uri) ?? playlistDisc(p, me))
  }
  const rows = [
    { id: 'search:songs', title: 'Songs', discs: songs },
    { id: 'search:albums', title: 'Albums', discs: albums },
    { id: 'search:playlists', title: 'Playlists', discs: playlists },
  ].filter((r) => r.discs.length)
  return rows.length ? rows : [{ id: 'search:none', title: 'No results', discs: [], note: `Nothing found for "${query}"` }]
}

type ApiSearchAlbum = Omit<ApiAlbum, 'tracks'>

function albumDisc(a: ApiSearchAlbum, library: Disc[]): Disc {
  return (
    library.find((d) => d.uri === a.uri) ?? {
      id: a.id,
      kind: 'album',
      title: a.name,
      subtitle: a.artists.map((x) => x.name).join(', '),
      uri: a.uri,
      spotifyUrl: a.external_urls.spotify,
      imageUrl: bestImage(a.images),
      trackCount: a.total_tracks,
      tracksAvailable: true,
    }
  )
}

function sampleSearch(query: string, library: Disc[]) {
  const q = query.toLowerCase()
  const has = (s: string) => s.toLowerCase().includes(q)
  const match = (kind: Disc['kind']) => library.filter((d) => d.kind === kind && (has(d.title) || has(d.subtitle)))
  const songs = library
    .filter((d) => d.kind === 'album')
    .flatMap((d) =>
      (d.tracks ?? [])
        .filter((t) => has(t.name) || has(t.artists))
        .map((t) => trackDisc(t, { contextUri: d.uri, image: d.imageUrl })),
    )
  return { songs: songs.slice(0, 10), albums: match('album').slice(0, 10), playlists: match('playlist').slice(0, 10) }
}
