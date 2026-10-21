import { Canvas } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { sampleLibrary } from './data/sample'
import { restartBeat } from './lib/beat'
import { CAMERA_Z, ROWS, slot } from './scene/layout'
import { PulledCD, type CaseStage } from './scene/PulledCD'
import { Shelf, type ScrollState } from './scene/Shelf'
import * as auth from './spotify/auth'
import { cachedLibrary, clearCache, fetchMe, loadLibrary, loadTracks, type Me } from './spotify/library'
import * as player from './spotify/player'
import type { Disc, SortKey, Track } from './types'
import { Host, rhymes } from './ui/Host'
import { MoodMeter, NowPlayingBar, TrackPanel } from './ui/Panels'
import { RhythmBar, type Hit } from './ui/RhythmBar'

type Phase = 'welcome' | 'loading' | 'shelf'

interface Pulled {
  disc: Disc
  from: THREE.Vector3
  stage: CaseStage
}

const KIND_ORDER = { liked: 0, album: 1, playlist: 2 }

function sortDiscs(discs: Disc[], key: SortKey): Disc[] {
  const list = [...discs]
  const byText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  switch (key) {
    case 'title':
      return list.sort((a, b) => byText(a.title, b.title))
    case 'artist':
      return list.sort((a, b) => byText(a.subtitle, b.subtitle) || byText(a.title, b.title))
    case 'kind':
      return list.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byText(a.title, b.title))
    case 'added':
      return list.sort(
        (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (b.addedAt ?? '').localeCompare(a.addedAt ?? ''),
      )
  }
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('welcome')
  const [me, setMe] = useState<Me | null>(null)
  const [library, setLibrary] = useState<Disc[]>([])
  const [sortKey, setSortKey] = useState<SortKey>('added')
  const [query, setQuery] = useState('')
  const [pulled, setPulled] = useState<Pulled | null>(null)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const [trackError, setTrackError] = useState<string | null>(null)
  const [line, setLine] = useState(rhymes.welcome())
  const [notice, setNotice] = useState<{ text: string; openUrl?: string } | null>(null)
  const [mood, setMood] = useState(50)
  const scroll = useRef<ScrollState>({ target: -Infinity, current: NaN, max: 0 }).current
  const rows = ROWS
  const { mode, now } = useSyncExternalStore(player.playerStore.subscribe, player.playerStore.get)
  const playing = !!now.disc && !now.paused

  const discs = useMemo(() => sortDiscs(library, sortKey), [library, sortKey])

  // ---- Sign-in and loading -------------------------------------------------

  const startShelf = useCallback(async (signedIn: boolean, list: Disc[]) => {
    await document.fonts?.ready
    player.initPlayer(signedIn)
    setLibrary(list)
    scroll.target = -Infinity
    setPhase('shelf')
    setLine(rhymes.welcome())
  }, [scroll])

  const loadFromSpotify = useCallback(
    async (force = false) => {
      setPhase('loading')
      try {
        const user = await fetchMe()
        setMe(user)
        const cached = force ? null : cachedLibrary(user.id)
        const list = cached ?? (await loadLibrary(user, setLine))
        await startShelf(true, list)
      } catch (e) {
        const err = e as Error & { status?: number }
        setPhase('welcome')
        setNotice({
          text:
            err.status === 403
              ? "Spotify blocked this account. Playback is invite-only for now, so ask the owner to add your Spotify email."
              : `Couldn't load your library: ${err.message}`,
        })
      }
    },
    [startShelf],
  )

  useEffect(() => {
    void (async () => {
      const error = await auth.handleRedirect()
      if (error) setNotice({ text: error })
      if (auth.isLoggedIn()) void loadFromSpotify()
    })()
  }, [loadFromSpotify])

  const trySample = () => void startShelf(false, sampleLibrary())

  const signOut = () => {
    player.stop()
    auth.logout()
    clearCache()
    setPulled(null)
    setMe(null)
    setPhase('welcome')
  }

  // ---- Shelf interactions ----------------------------------------------------

  const highlightId = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return discs.find((d) => d.title.toLowerCase().includes(q) || d.subtitle.toLowerCase().includes(q))?.id ?? null
  }, [query, discs])

  useEffect(() => {
    if (!highlightId) return
    const index = discs.findIndex((d) => d.id === highlightId)
    scroll.target = slot(index, rows).x
  }, [highlightId, discs, rows, scroll])

  const pick = useCallback(
    (disc: Disc, from: THREE.Vector3) => {
      if (pulled) return
      setPulled({ disc, from, stage: 'out' })
      setTracks(disc.tracks ?? null)
      setTrackError(null)
      setLine(rhymes.pulled(disc.title))
      loadTracks(disc)
        .then(setTracks)
        .catch((e: Error) => setTrackError(`Couldn't read the song list: ${e.message}`))
    },
    [pulled],
  )

  const toggleOpen = () => {
    if (!pulled) return
    const stage = pulled.stage === 'open' ? 'out' : 'open'
    setPulled({ ...pulled, stage })
    if (stage === 'open') setLine(rhymes.opened())
  }

  const putBack = () => {
    if (pulled) setPulled({ ...pulled, stage: 'returning' })
  }

  const playIndex = async (index: number) => {
    if (!pulled) return
    if (pulled.stage !== 'open') setPulled({ ...pulled, stage: 'open' })
    const list = tracks ?? []
    const result = await player.play(pulled.disc, list, index)
    if (result.ok) {
      restartBeat()
      setLine(rhymes.playing(list[index]?.name ?? pulled.disc.title))
      setNotice(null)
    } else {
      setNotice({ text: result.message ?? 'Something went wrong.', openUrl: result.openUrl })
      if (result.openUrl && player.playerStore.get().mode === 'link') window.open(result.openUrl, '_blank')
    }
  }

  const onHit = useCallback((hit: Hit) => {
    setMood((m) => {
      const next = Math.max(0, Math.min(100, m + (hit === 'perfect' ? 7 : hit === 'good' ? 3 : -6)))
      if (m < 75 && next >= 75) setLine(rhymes.cool())
      if (m >= 40 && next < 40) setLine(rhymes.bad())
      return next
    })
  }, [])

  const skip = (dir: 1 | -1) => {
    void player.skip(dir)
    if (dir > 0) setMood((m) => Math.max(0, m - 8))
  }

  // Keyboard: arrows scroll the shelf, Escape puts the CD back.
  useEffect(() => {
    if (phase !== 'shelf') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'Escape') putBack()
      if (pulled) return
      if (e.key === 'ArrowRight') scroll.target += 1.2
      if (e.key === 'ArrowLeft') scroll.target -= 1.2
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  // Mouse wheel and drag (or swipe) slide along the shelf.
  const drag = useRef<{ x: number; target: number } | null>(null)
  const onWheel = (e: React.WheelEvent) => {
    if (pulled) return
    scroll.target += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.006
  }
  const worldPerPixel = () => (2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(20))) / innerHeight
  const onPointerDown = (e: React.PointerEvent) => {
    if (!pulled) drag.current = { x: e.clientX, target: scroll.target }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    scroll.target = drag.current.target - (e.clientX - drag.current.x) * worldPerPixel() * 1.4
  }
  const endDrag = () => {
    drag.current = null
  }

  // ---- Screens ---------------------------------------------------------------

  if (phase !== 'shelf') {
    return (
      <main className="welcome">
        <h1 className="logo">
          <span>P</span>
          <span>L</span>
          <span>A</span>
          <span>Y</span>
          <span>B</span>
          <span>A</span>
          <span>C</span>
          <span>K</span>
        </h1>
        <p className="tagline">Your whole Spotify library, as a shelf of CDs.</p>
        <Host line={line} bouncing />
        {phase === 'welcome' && (
          <div className="actions">
            <button className="big spotify" disabled={!auth.isConfigured()} onClick={() => void auth.login()}>
              Sign in with Spotify
            </button>
            <button className="big" onClick={trySample}>
              Try it with sample CDs
            </button>
            {!auth.isConfigured() && (
              <p className="note">Spotify sign-in isn't set up on this copy yet. See the README to add a Client ID.</p>
            )}
            <p className="fine">Playback is invite-only for now (Spotify allows 5 testers). Playing songs inside the app needs Spotify Premium.</p>
          </div>
        )}
        {notice && <p className="note">{notice.text}</p>}
      </main>
    )
  }

  return (
    <main className={`room ${playing ? 'grooving' : ''}`}>
      <div
        className="stage"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
      >
        <Canvas
          camera={{ position: [0, 0, CAMERA_Z], fov: 40 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          onPointerMissed={() => {
            // Tapping empty space puts a closed CD back; an open one stays until "Put it back".
            if (pulled?.stage === 'out') putBack()
          }}
        >
          <Shelf
            discs={discs}
            rows={rows}
            scroll={scroll}
            selectedId={pulled?.disc.id ?? null}
            highlightId={highlightId}
            playing={playing}
            onPick={pick}
          />
          {pulled && (
            <PulledCD
              key={pulled.disc.id}
              disc={pulled.disc}
              from={pulled.from}
              stage={pulled.stage}
              playing={playing && now.disc?.id === pulled.disc.id}
              onToggleOpen={toggleOpen}
              onReturned={() => {
                setPulled(null)
                setLine(rhymes.returned())
              }}
            />
          )}
        </Canvas>
      </div>

      <header className="topbar">
        <div className="brand">PLAYBACK</div>
        <input
          className="search"
          placeholder="Find a CD…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort">
          <option value="added">Recently added</option>
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="kind">Type</option>
        </select>
        {me ? (
          <>
            <button className="chip" onClick={() => void loadFromSpotify(true)} title="Reload from Spotify">
              ↻
            </button>
            <button className="chip" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <button className="chip" onClick={() => setPhase('welcome')}>
            Exit
          </button>
        )}
      </header>

      {playing && <RhythmBar onHit={onHit} />}
      {now.disc && <MoodMeter score={mood} />}

      <Host line={line} bouncing={playing} />

      {pulled && pulled.stage === 'open' && (
        <TrackPanel
          disc={pulled.disc}
          tracks={tracks}
          error={trackError}
          nowUri={now.disc?.id === pulled.disc.id ? (now.track?.uri ?? null) : null}
          onPlay={(i) => void playIndex(i)}
          onClose={putBack}
        />
      )}
      {pulled && pulled.stage === 'out' && <p className="hint">Tap the case to open it</p>}
      {!pulled && <p className="hint">Scroll or swipe along the shelf · tap a CD to pull it out</p>}

      {notice && (
        <div className="toast">
          <span>{notice.text}</span>
          {notice.openUrl && (
            <a href={notice.openUrl} target="_blank" rel="noreferrer">
              Open in Spotify
            </a>
          )}
          <button aria-label="Dismiss" onClick={() => setNotice(null)}>
            ✕
          </button>
        </div>
      )}

      <NowPlayingBar
        now={now}
        mode={mode}
        onToggle={() => void player.togglePause()}
        onSkip={skip}
        onEnded={() => void player.skip(1)}
      />
    </main>
  )
}
