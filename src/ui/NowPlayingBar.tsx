import { useEffect, useRef, useState } from 'react'
import { livePosition, type NowPlaying, type PlayerMode } from '../spotify/player'
import { Visualizer } from './Visualizer'
import './player.css'

const time = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
const SOURCE: Record<PlayerMode, string> = {
  sample: 'SAMPLE · NO AUDIO', browser: 'SPOTIFY · BROWSER', phone: 'SPOTIFY · CONNECT', link: 'SPOTIFY',
}
interface Props {
  now: NowPlaying
  mode: PlayerMode
  onToggle: () => void
  onSkip: (direction: 1 | -1) => void
  onEnded: () => void
  onSeek: (position: number) => Promise<void>
}

export function NowPlayingBar({ now, mode, onToggle, onSkip, onEnded, onSeek }: Props) {
  const [, setTick] = useState(0)
  const [compact, setCompact] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ended = useRef<string | null>(null)
  const trackKey = now.track?.uri ?? now.disc?.id ?? ''
  useEffect(() => {
    if (!now.disc || now.paused) return
    const id = setInterval(() => setTick(t => t + 1), 250)
    return () => clearInterval(id)
  }, [now.disc, now.paused])
  useEffect(() => { setScrub(null); setError(null); ended.current = null }, [trackKey])
  const position = livePosition(now)
  useEffect(() => {
    if (mode !== 'sample' || now.paused || !now.durationMs || position < now.durationMs) {
      ended.current = null
      return
    }
    if (ended.current === trackKey) return
    ended.current = trackKey
    onEnded()
  }, [mode, now.paused, now.durationMs, position, trackKey, onEnded])
  if (!now.disc) return null
  const title = now.track?.name ?? now.disc.title
  const shown = scrub ?? position
  const commitSeek = () => {
    if (scrub === null) return
    setScrub(null)
    setError(null)
    void onSeek(scrub).catch(() => setError('Could not seek. Try again.'))
  }
  return (
    <section className={`nowbar miniamp${compact ? ' is-compact' : ''}`} aria-label="Playback mini player">
      <header className="deck-header">
        <span className="deck-brand">PLAYBACK <b>MINIAMP</b></span>
        {compact && <span className="deck-compact-title">{title}</span>}
        <span className="deck-source">{SOURCE[mode]}</span>
        {compact && <button className="deck-mini-play" aria-label={now.paused ? 'Play' : 'Pause'} onClick={onToggle}>
          {now.paused ? '▶' : 'Ⅱ'}
        </button>}
        <button className="deck-collapse" aria-label={compact ? 'Expand player' : 'Collapse player'}
          aria-expanded={!compact} onClick={() => setCompact(value => !value)}>{compact ? '+' : '−'}</button>
      </header>
      {!compact && <>
        <div className="deck-body">
          <div className="deck-info">
            <div className="deck-state"><i className={now.paused ? '' : 'lit'} />{now.paused ? 'PAUSED' : 'PLAYING'}</div>
            <strong className="deck-title" title={title}>{title}</strong>
            <span className="deck-artist" title={now.track?.artists ?? now.disc.subtitle}>
              {now.track?.artists ?? now.disc.subtitle}
            </span>
          </div>
          <figure className="deck-visual" aria-label="Decorative visualizer, not audio analysis">
            <figcaption><span>VISUAL MODE</span><span>{now.paused ? 'HOLD' : 'AMBIENT'}</span></figcaption>
            <Visualizer playing={!now.paused} trackKey={trackKey} />
            <span className="deck-disclaimer">Animation · not audio analysis</span>
          </figure>
          <div className="deck-controls">
            <div className="deck-clock"><span>{time(shown)}</span><small>/ {time(now.durationMs)}</small></div>
            <div className="deck-transport">
              <button aria-label="Previous" onClick={() => onSkip(-1)}>⏮</button>
              <button aria-label={now.paused ? 'Play' : 'Pause'} className="deck-play" onClick={onToggle}>
                {now.paused ? '▶' : 'Ⅱ'}
              </button>
              <button aria-label="Next" onClick={() => onSkip(1)}>⏭</button>
            </div>
          </div>
        </div>
        <div className="deck-timeline">
          <span>{time(shown)}</span>
          <input type="range" aria-label="Playback position" aria-valuetext={`${time(shown)} of ${time(now.durationMs)}`}
            min={0} max={Math.max(1, now.durationMs)} step={1000} value={Math.min(shown, now.durationMs || 1)}
            disabled={!now.durationMs || mode === 'link'}
            style={{ '--played': `${now.durationMs ? Math.min(100, shown / now.durationMs * 100) : 0}%` } as React.CSSProperties}
            onChange={event => setScrub(Number(event.target.value))}
            onPointerUp={commitSeek} onKeyUp={commitSeek} onBlur={commitSeek}
            onPointerCancel={() => setScrub(null)} />
          <span>−{time(Math.max(0, now.durationMs - shown))}</span>
        </div>
        {error && <p className="deck-error" role="status">{error}</p>}
      </>}
    </section>
  )
}
