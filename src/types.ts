export type DiscKind = 'album' | 'playlist' | 'liked'

/** One CD on the shelf: an album, a playlist, or the Liked Songs collection. */
export interface Disc {
  id: string
  kind: DiscKind
  title: string
  /** Artist for albums, owner for playlists. */
  subtitle: string
  /** Spotify URI used to start playback (album or playlist context). */
  uri: string
  /** Link that opens this disc in the Spotify app or web player. */
  spotifyUrl: string
  imageUrl?: string
  trackCount: number
  /** ISO date the user saved it, when Spotify gives one. */
  addedAt?: string
  /** Tracks we already know (albums come with them). Others load on demand. */
  tracks?: Track[]
  /** False when Spotify won't list the songs (followed playlists). */
  tracksAvailable: boolean
}

export interface Track {
  uri: string
  name: string
  artists: string
  durationMs: number
  /** The song's own album cover, when Spotify gives one. */
  imageUrl?: string
}

export type SortKey = 'added' | 'title' | 'artist' | 'kind'
