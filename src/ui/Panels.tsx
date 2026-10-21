import { useEffect, useState } from 'react'
import { livePosition, type NowPlaying, type PlayerMode } from '../spotify/player'
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
export function TrackPanel({ disc, tracks, error, nowUri, onPlay, onClose }: TrackPanelProps) {
  return (
    <aside className="panel">
      <header>
        <div>
          <h2>{disc.title}</h2>
          <p>{disc.subtitle}</p>
        </div>
        <button className="chip" onClick={onClose}>
          Put it back
        </button>
      </header>
      {error && <p className="note">{error}</p>}
      {!disc.tracksAvailable && (
        <p className="note">
          Spotify only shares the song list for playlists you made or help edit. You can still play the whole thing.
        </p>
      )}
      {!tracks && !error && disc.tracksAvailable && <p className="note">Reading the song list…</p>}
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
        <button className="big" onClick={() => onPlay(0)}>
          ▶ Play CD
        </button>
        <a className="spotify-link" href={disc.spotifyUrl} target="_blank" rel="noreferrer">
          Open in Spotify
        </a>
      </footer>
    </aside>
  )
}

const MODE_NOTE: Record<PlayerMode, string> = {
  sample: 'Sample mode: pretend playback',
  browser: 'Playing in this browser',
  phone: "Playing in your Spotify app",
  link: 'Opens in Spotify',
}

interface NowBarProps {
  now: NowPlaying
  mode: PlayerMode
  onToggle: () => void
  onSkip: (dir: 1 | -1) => void
  onEnded: () => void
}

export function NowPlayingBar({ now, mode, onToggle, onSkip, onEnded }: NowBarProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [])
  const pos = livePosition(now)
  const pct = now.durationMs ? (pos / now.durationMs) * 100 : 0
  useEffect(() => {
    if (mode === 'sample' && !now.paused && now.durationMs && pos >= now.durationMs) onEnded()
  })
  if (!now.disc) return null
  return (
    <div className="nowbar">
      <div className="now-text">
        <strong>{now.track?.name ?? now.disc.title}</strong>
        <span>
          {now.track?.artists ?? now.disc.subtitle} · {MODE_NOTE[mode]}
        </span>
        <div className="progress">
          <div style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="now-buttons">
        <button aria-label="Previous" onClick={() => onSkip(-1)}>
          ⏮
        </button>
        <button aria-label={now.paused ? 'Play' : 'Pause'} className="play" onClick={onToggle}>
          {now.paused ? '▶' : '❚❚'}
        </button>
        <button aria-label="Next" onClick={() => onSkip(1)}>
          ⏭
        </button>
      </div>
    </div>
  )
}

export function MoodMeter({ score }: { score: number }) {
  const label = score >= 75 ? 'COOL' : score >= 40 ? 'GOOD' : 'BAD'
  return (
    <div className="mood" aria-label={`Mood: ${label}`}>
      <span className="mood-title">U R Groovin'</span>
      {(['BAD', 'GOOD', 'COOL'] as const).map((l) => (
        <span key={l} className={`mood-step ${l.toLowerCase()} ${l === label ? 'on' : ''}`}>
          {l}
        </span>
      ))}
    </div>
  )
}
