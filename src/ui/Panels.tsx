import { TextLoader } from 'generative-loaders'
import type { Disc, Track } from '../types'

const time = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface TrackPanelProps {
  disc: Disc
  tracks: Track[] | null
  error: string | null
  nowUri: string | null
  onPlay: (index: number) => void
  onClose: () => void
}

/** The case insert: song list for the open CD. */
export function TrackPanel({
  disc, tracks, error, nowUri, onPlay, onClose,
}: TrackPanelProps) {
  return (
    <aside className="panel" id="case-tracks" aria-label="Track list">
      <header>
        <div>
          <h2>{disc.title}</h2>
          <p>{disc.subtitle}</p>
        </div>
        <button className="chip" onClick={onClose}>
          Close tracks
        </button>
      </header>
      {error && <p className="note">{error}</p>}
      {!disc.tracksAvailable && (
        <p className="note">
          Spotify only shares the song list for playlists you made or help edit. You can still play the whole thing.
        </p>
      )}
      {!tracks && !error && disc.tracksAvailable && (
        <p className="note">
          <TextLoader text="Reading the song list…" variant="skeleton" color="currentColor" />
        </p>
      )}
      {tracks && tracks.length > 0 && (
        <ol className="tracks">
          {tracks.map((t, i) => (
            <li key={t.uri + i} className={t.uri === nowUri ? 'now' : ''}>
              <button onClick={() => onPlay(i)}>
                <span className="num">{t.uri === nowUri ? '♪' : i + 1}</span>
                <span className="name">
                  {t.name}
                  <small>{t.artists}</small>
                </span>
                <span className="dur">{time(t.durationMs)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <footer>
        <a className="spotify-link" href={disc.spotifyUrl} target="_blank" rel="noreferrer">
          Open in Spotify
        </a>
      </footer>
    </aside>
  )
}
