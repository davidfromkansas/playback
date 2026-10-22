import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { sampleLibrary } from './data/sample'
import { restartBeat } from './lib/beat'
import { renderBudget } from './lib/renderBudget'
import { useTimeOfDay } from './lib/timeOfDay'
import { loadThemeFonts, useTheme } from './lib/theme'
import { cameraFor, CameraRig } from './scene/CameraRig'
import { RowStack, type StackState } from './scene/RowStack'
import { LINE_STEP, ROWS, slot } from './scene/layout'
import { DiscLighting } from './scene/Disc3D'
import { PulledCD, type CaseStage } from './scene/PulledCD'
import { Shelf, type ScrollState } from './scene/Shelf'
import { StreetBackdrop } from './scene/StreetBackdrop'
import * as auth from './spotify/auth'
import { cachedLibrary, clearCache, fetchMe, loadLibrary, loadTracks, type Me } from './spotify/library'
import { loadRows, sampleRows, searchRows, songsRow, startingRows, type ShelfRow } from './spotify/rows'
import * as player from './spotify/player'
import type { Disc, SortKey, Track } from './types'
import { Host, rhymesFor } from './ui/Host'
import { MoodMeter, NowPlayingBar, TrackPanel } from './ui/Panels'
import { RhythmBar, type Hit } from './ui/RhythmBar'
import { LoadingCard, SceneLoading } from './ui/Loading'
import { SpeedLines } from './ui/SpeedLines'

type Phase = 'welcome' | 'loading' | 'shelf'

interface Pulled {
  disc: Disc
  from: THREE.Vector3
  fromRy?: number
  stage: CaseStage
}

const KIND_ORDER = { liked: 0, album: 1, playlist: 2, track: 3 }

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
  const [budget] = useState(renderBudget)
  const [theme, setTheme] = useTheme()
  const sky = useTimeOfDay()
  const rhymes = rhymesFor(theme)
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
  const [starting, setStarting] = useState(false)
  const shelfScroll = useRef<ScrollState>({ target: -Infinity, current: NaN, max: 0 }).current
  const rows = ROWS
  const street = theme === 'street'

  // Street: rows of CDs stacked top to bottom, each remembering how far along it you've scrolled.
  const [rowList, setRowList] = useState<ShelfRow[]>([])
  // The search results page: its own rows (Songs, Albums, Playlists) shown instead of yours.
  const [results, setResults] = useState<{ query: string; rows: ShelfRow[] } | null>(null)
  const homeRow = useRef(0) // the row you were on before searching, to come back to
  const shownRows = results?.rows ?? rowList
  const [activeRow, setActiveRow] = useState(0)
  const stack = useRef<StackState>({ target: 0, current: NaN }).current
  const rowScrolls = useRef(new Map<string, ScrollState>()).current
  const scrollFor = useCallback(
    (id: string) => {
      let s = rowScrolls.get(id)
      if (!s) rowScrolls.set(id, (s = { target: 0, current: NaN, max: 0 }))
      return s
    },
    [rowScrolls],
  )
  const currentRow = street ? shownRows[activeRow] : undefined
  // Whatever the arrows, wheel and swipes move: the row you're on, or the Paper shelf.
  const scroll = currentRow ? scrollFor(currentRow.id) : shelfScroll
  const goToRow = useCallback(
    (k: number) => {
      const next = Math.max(0, Math.min(shownRows.length - 1, k))
      setActiveRow(next)
      stack.target = next
    },
    [shownRows.length, stack],
  )
  const { mode, now } = useSyncExternalStore(player.playerStore.subscribe, player.playerStore.get)
  const playing = !!now.disc && !now.paused

  const discs = useMemo(() => sortDiscs(library, sortKey), [library, sortKey])

  // ---- Sign-in and loading -------------------------------------------------

  const startShelf = useCallback(
    async (user: Me | null, list: Disc[]) => {
      await Promise.all([document.fonts?.ready, loadThemeFonts()])
      player.initPlayer(!!user)
      setLibrary(list)
      shelfScroll.target = -Infinity
      rowScrolls.clear()
      setResults(null)
      setActiveRow(0)
      stack.target = 0
      if (user) {
        setRowList(startingRows())
        // Whatever goes wrong, no row should be left saying it's loading forever.
        void loadRows(user, list, setRowList).catch(() =>
          setRowList((rows) => rows.map((r) => (r.loading ? { ...r, loading: false, note: "Couldn't load this row" } : r))),
        )
      } else setRowList(sampleRows(list))
      setPhase('shelf')
      setLine(rhymes.welcome())
    },
    [shelfScroll, rowScrolls, stack, rhymes],
  )

  const loadFromSpotify = useCallback(
    async (force = false) => {
      setPhase('loading')
      try {
        const user = await fetchMe()
        setMe(user)
        const cached = force ? null : cachedLibrary(user.id)
        const list = cached ?? (await loadLibrary(user, setLine))
        await startShelf(user, list)
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

  const trySample = () => void startShelf(null, sampleLibrary())

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
    if (!highlightId || street) return
    shelfScroll.target = slot(discs.findIndex((d) => d.id === highlightId), rows).x
  }, [highlightId, discs, rows, shelfScroll, street])

  // Street: pressing Enter in the search box opens the results page.
  const runSearch = useCallback(
    (raw: string) => {
      const q = raw.trim()
      if (!q) return
      if (!results) homeRow.current = activeRow
      for (const id of [...rowScrolls.keys()]) if (id.startsWith('search:') || id.startsWith('open:')) rowScrolls.delete(id)
      setResults({ query: q, rows: [{ id: 'search:loading', title: 'Searching Spotify…', discs: [], loading: true }] })
      setActiveRow(0)
      stack.target = stack.current = 0
      void searchRows(q, me, library)
        .catch(() => [{ id: 'search:error', title: 'Search', discs: [], note: "Couldn't reach Spotify. Try again." }])
        .then((rows) => setResults((r) => (r?.query === q ? { query: q, rows } : r)))
    },
    [results, activeRow, rowScrolls, stack, me, library],
  )

  const closeSearch = useCallback(() => {
    setResults(null)
    setQuery('')
    setActiveRow(homeRow.current)
    stack.target = stack.current = homeRow.current
  }, [stack])

  // Switching looks starts the Paper shelf from the beginning again.
  useEffect(() => {
    shelfScroll.target = -Infinity
    shelfScroll.current = NaN
  }, [theme, shelfScroll])

  // Street: the CD at the front of the line, named in a label above it.
  const [focused, setFocused] = useState<Disc | null>(null)

  const pick = useCallback(
    (disc: Disc, from: THREE.Vector3, fromRy?: number) => {
      if (pulled) return
      setPulled({ disc, from, fromRy, stage: 'out' })
      setTracks(disc.tracks ?? null)
      setTrackError(null)
      setLine(rhymes.pulled(disc.title))
      loadTracks(disc)
        .then(setTracks)
        .catch((e: Error) => setTrackError(`Couldn't read the song list: ${e.message}`))
    },
    [pulled],
  )

  // Tapping an album or playlist in Recently Played or in search results opens its songs as a new
  // row just below it.
  const openRow = useCallback(
    (fromId: string, disc: Disc) => {
      const id = `open:${disc.id}`
      const setShown = results ? (f: (rows: ShelfRow[]) => ShelfRow[]) => setResults((r) => r && { ...r, rows: f(r.rows) }) : setRowList
      const rest = shownRows.filter((r) => !r.id.startsWith('open:'))
      const at = rest.findIndex((r) => r.id === fromId) + 1
      setShown(() => [...rest.slice(0, at), { id, title: disc.title, discs: [], loading: true }, ...rest.slice(at)])
      setActiveRow(at)
      stack.target = at
      void songsRow(disc, id)
        .catch(() => ({ id, title: disc.title, discs: [disc], note: "Couldn't load the songs" }))
        .then((row) => setShown((list) => list.map((r) => (r.id === id ? row : r))))
    },
    [stack, results, shownRows],
  )

  const tapRowDisc = useCallback(
    (row: ShelfRow, disc: Disc, from: THREE.Vector3, fromRy: number) => {
      const opens = row.id === 'recent' || row.id.startsWith('search:')
      if (opens && (disc.kind === 'album' || disc.kind === 'playlist')) openRow(row.id, disc)
      else pick(disc, from, fromRy)
    },
    [openRow, pick],
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
    if (!pulled || starting) return
    if (pulled.stage !== 'open') setPulled({ ...pulled, stage: 'open' })
    const list = tracks ?? []
    // Spotify can take a few seconds to start, especially on another device.
    setStarting(true)
    const result = await player.play(pulled.disc, list, index).finally(() => setStarting(false))
    if (result.ok) {
      restartBeat()
      setLine(rhymes.playing(list[index]?.name ?? pulled.disc.title))
      setNotice(null)
    } else {
      setNotice({ text: result.message ?? 'Something went wrong.', openUrl: result.openUrl })
      if (result.openUrl && player.playerStore.get().mode === 'link') window.open(result.openUrl, '_blank')
    }
  }

  const onHit = useCallback(
    (hit: Hit) => {
      setMood((m) => {
        const next = Math.max(0, Math.min(100, m + (hit === 'perfect' ? 7 : hit === 'good' ? 3 : -6)))
        if (m < 75 && next >= 75) setLine(rhymes.cool())
        if (m >= 40 && next < 40) setLine(rhymes.bad())
        return next
      })
    },
    [rhymes],
  )

  const skip = (dir: 1 | -1) => {
    void player.skip(dir)
    if (dir > 0) setMood((m) => Math.max(0, m - 8))
  }

  // Keyboard: arrows scroll the shelf, Escape puts the CD back.
  useEffect(() => {
    if (phase !== 'shelf') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'Escape') {
        if (pulled) putBack()
        else if (results) closeSearch()
      }
      if (pulled) return
      const step = street ? LINE_STEP : 1.2
      if (e.key === 'ArrowRight') scroll.target += step
      if (e.key === 'ArrowLeft') scroll.target -= step
      if (street && e.key === 'ArrowDown') goToRow(activeRow + 1)
      if (street && e.key === 'ArrowUp') goToRow(activeRow - 1)
      if (currentRow && e.key === 'Enter' && focused) {
        // Same as tapping the front CD, without a 3D position: it flies out from the middle.
        tapRowDisc(currentRow, focused, new THREE.Vector3(0, -0.5, 0), -0.3)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  // Mouse wheel and drag (or swipe) slide along the shelf. In Street, up and down change rows.
  const drag = useRef<{ x: number; y: number; target: number; axis?: 'x' | 'y' } | null>(null)
  const wheelRows = useRef({ total: 0, at: 0, moved: 0 })
  const onWheel = (e: React.WheelEvent) => {
    if (pulled) return
    const sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY)
    if (!street || sideways || e.shiftKey) {
      scroll.target += (sideways ? e.deltaX : e.deltaY) * 0.006
      return
    }
    // One row per flick of the wheel, however many events the flick sends.
    const w = wheelRows.current
    const now = performance.now()
    if (now - w.at > 250) w.total = 0
    w.at = now
    w.total += e.deltaY
    if (Math.abs(w.total) > 60 && now - w.moved > 450) {
      goToRow(activeRow + Math.sign(w.total))
      w.total = 0
      w.moved = now
    }
  }
  const worldPerPixel = () => {
    const c = cameraFor(theme)
    return (2 * c.z * Math.tan(THREE.MathUtils.degToRad(c.fov / 2))) / innerHeight
  }
  const onPointerDown = (e: React.PointerEvent) => {
    if (pulled) return
    drag.current = { x: e.clientX, y: e.clientY, target: scroll.target, axis: street ? undefined : 'x' }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    // A swipe goes either along the row or between rows, decided by its first few pixels.
    if (!d.axis && Math.hypot(dx, dy) > 10) d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    if (d.axis === 'x') {
      scroll.held = true
      scroll.target = d.target - dx * worldPerPixel() * 1.4
    } else if (d.axis === 'y') {
      // The stack follows the finger; swiping up brings the row below into view.
      stack.target = activeRow + Math.max(-1, Math.min(1, -dy / 240))
    }
  }
  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    scroll.held = false
    if (d?.axis !== 'y') return
    const dy = e.clientY - d.y
    goToRow(Math.abs(dy) > 50 ? activeRow + (dy < 0 ? 1 : -1) : activeRow)
  }

  // ---- Screens ---------------------------------------------------------------

  if (phase !== 'shelf') {
    return (
      <main className={`welcome ${theme}`} data-sky={street ? sky : undefined}>
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
        <Host line={line} bouncing={false} theme={theme} />
        {phase === 'loading' && <LoadingCard text="Stacking up your CDs…" />}
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
    <main className={`room ${theme} ${playing ? 'grooving' : ''}`} data-sky={street ? sky : undefined}>
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
          camera={{
            position: [0, cameraFor(theme).y, cameraFor(theme).z],
            fov: cameraFor(theme).fov,
          }}
          dpr={theme === 'street' ? budget.pixelRatio : [1, 2]}
          gl={{ antialias: true, alpha: true }}
          onPointerMissed={() => {
            // Tapping empty space puts a closed CD back; an open one stays until "Put it back".
            if (pulled?.stage === 'out') putBack()
          }}
        >
          <CameraRig theme={theme} />
          <DiscLighting />
          {theme === 'street' && (
            <Suspense fallback={null}>
              <StreetBackdrop scroll={scroll} discs={discs} sky={sky} />
            </Suspense>
          )}
          {street ? (
            <Suspense fallback={null}>
              <RowStack
                rows={shownRows}
                active={activeRow}
                stack={stack}
                scrollFor={scrollFor}
                selectedId={pulled?.disc.id ?? null}
                playing={playing}
                onTap={tapRowDisc}
                onActivate={goToRow}
                onFocus={setFocused}
              />
            </Suspense>
          ) : (
            <Shelf
              discs={discs}
              rows={rows}
              scroll={shelfScroll}
              selectedId={pulled?.disc.id ?? null}
              highlightId={highlightId}
              playing={playing}
              onPick={pick}
            />
          )}
          {pulled && (
            <PulledCD
              key={pulled.disc.id}
              disc={pulled.disc}
              from={pulled.from}
              fromRy={pulled.fromRy}
              stage={pulled.stage}
              theme={theme}
              playing={playing && now.disc?.id === pulled.disc.id}
              songArtUrl={now.disc?.id === pulled.disc.id ? now.track?.imageUrl : undefined}
              onToggleOpen={toggleOpen}
              onReturned={() => {
                setPulled(null)
                setLine(rhymes.returned())
              }}
            />
          )}
        </Canvas>
      </div>

      <SceneLoading text={street ? 'Building the rooftop…' : 'Setting up the shelf…'} />
      {theme === 'street' && <SpeedLines scroll={scroll} />}

      <header className="topbar">
        <div className="brand">PLAYBACK</div>
        <input
          className="search"
          placeholder={street ? 'Search Spotify…' : 'Find a CD…'}
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('')
            if (e.key === 'Enter' && street) {
              runSearch(query)
              e.currentTarget.blur()
            }
          }}
        />
        {!street && (
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort">
          <option value="added">Recently added</option>
          <option value="title">Title</option>
          <option value="artist">Artist</option>
          <option value="kind">Type</option>
        </select>
        )}
        <button
          className="chip theme-toggle"
          onClick={() => setTheme(theme === 'street' ? 'paper' : 'street')}
          title="Switch look"
        >
          {theme === 'street' ? 'Paper' : 'Street'}<span className="wide-only"> look</span>
        </button>
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

      <Host line={line} bouncing={playing} theme={theme} />

      {pulled && pulled.stage === 'open' && (
        <TrackPanel
          disc={pulled.disc}
          tracks={tracks}
          error={trackError}
          nowUri={now.disc?.id === pulled.disc.id ? (now.track?.uri ?? null) : null}
          onPlay={(i) => void playIndex(i)}
          onClose={putBack}
          starting={starting}
        />
      )}
      {pulled && pulled.stage === 'out' && <p className="hint">Tap the case to open it</p>}
      {!pulled && street && currentRow?.loading && (
        <LoadingCard
          className="row-loading"
          // Keys on these overlays must differ from each other: they're siblings, and a shared key
          // makes React lose track of one, leaving it stuck on screen.
          key={`loading:${currentRow.id}`}
          text={currentRow.id === 'search:loading' ? 'Searching Spotify…' : `Loading ${currentRow.title}…`}
        />
      )}
      {!pulled && street && results && (
        <div className="results-bar">
          <button onClick={closeSearch}>← Back</button>
          <span>
            Results for <strong>{results.query}</strong>
          </span>
        </div>
      )}
      {!pulled && street && currentRow && (
        <div className={`row-header ${results ? 'below-results' : ''}`} key={`header:${currentRow.id}`}>
          <strong>{currentRow.title}</strong>
          <span>
            Row {activeRow + 1} of {shownRows.length}
          </span>
        </div>
      )}
      {!pulled && street && (
        <div className="row-arrows">
          <button aria-label="Row above" disabled={activeRow === 0} onClick={() => goToRow(activeRow - 1)}>
            ▲
          </button>
          <button
            aria-label="Row below"
            disabled={activeRow >= shownRows.length - 1}
            onClick={() => goToRow(activeRow + 1)}
          >
            ▼
          </button>
        </div>
      )}
      {!pulled && street && focused && currentRow?.discs.length ? (
        <div className={`focus-label ${results ? 'below-results' : ''}`} key={`focus:${focused.id}`}>
          <strong>{focused.title}</strong>
          <span>{focused.subtitle}</span>
        </div>
      ) : null}
      {!pulled && (
        <p className="hint">
          {theme === 'street'
            ? 'Swipe left/right through CDs · up/down to change rows · tap the front one'
            : 'Scroll or swipe along the shelf · tap a CD to pull it out'}
        </p>
      )}

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
