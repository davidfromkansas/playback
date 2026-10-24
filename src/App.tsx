import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { sampleLibrary } from './data/sample'
import { restartBeat } from './lib/beat'
import { renderBudget } from './lib/renderBudget'
import { useTimeOfDay } from './lib/timeOfDay'
import { loadThemeFonts } from './lib/theme'
import { cameraFor, CameraRig } from './scene/CameraRig'
import { RowStack, type StackState } from './scene/RowStack'
import { LINE_STEP } from './scene/layout'
import { DiscLighting } from './scene/Disc3D'
import { PulledCD, type CaseStage } from './scene/PulledCD'
import { type ScrollState } from './scene/scroll'
import { StreetBackdrop } from './scene/StreetBackdrop'
import * as auth from './spotify/auth'
import { cachedLibrary, clearCache, fetchMe, loadLibrary, loadTracks, saveCache, type Me } from './spotify/library'
import { loadRows, sampleRows, searchRows, songsRow, startingRows, type ShelfRow } from './spotify/rows'
import * as player from './spotify/player'
import type { Disc, SortKey, Track } from './types'
import { Host, rhymesFor } from './ui/Host'
import { useLoadedSongMoods, useSongMood } from './lib/songMood'
import { useRemixCollection, useRemixRows } from './lib/remix'
import { SongMoodLabel } from './ui/SongMoodLabel'
import { TrackPanel } from './ui/Panels'
import { NowPlayingBar } from './ui/NowPlayingBar'
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
  const theme = 'street' as const
  const sky = useTimeOfDay()
  const rhymes = rhymesFor(theme)
  const [phase, setPhase] = useState<Phase>('welcome')
  const [me, setMe] = useState<Me | null>(null)
  const [library, setLibrary] = useState<Disc[]>([])
  const sortKey: SortKey = 'added'
  const [query, setQuery] = useState('')
  const [pulled, setPulled] = useState<Pulled | null>(null)
  const [showTracks, setShowTracks] = useState(false)
  const [showHint, setShowHint] = useState(true)
  useEffect(() => { setShowTracks(false) }, [pulled?.disc.id, pulled?.stage])
  useEffect(() => {
    if (phase !== 'shelf') return
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [phase])
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const [trackError, setTrackError] = useState<string | null>(null)
  const [line, setLine] = useState(rhymes.welcome())
  const [notice, setNotice] = useState<{ text: string; openUrl?: string } | null>(null)
  const [starting, setStarting] = useState(false)
  const shelfScroll = useRef<ScrollState>({ target: -Infinity, current: NaN, max: 0 }).current
  const street = theme === 'street'
  const { mode, now } = useSyncExternalStore(player.playerStore.subscribe, player.playerStore.get)
  const [remix, setRemix] = useState(false)
  const remixHome = useRef(0)
  const topbarRef = useRef<HTMLElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerTop, setHeaderTop] = useState(70)
  const [focusTop, setFocusTop] = useState(132)

  // Street: rows of CDs stacked top to bottom, each remembering how far along it you've scrolled.
  const [rowList, setRowList] = useState<ShelfRow[]>([])
  // The search results page: its own rows (Songs, Albums, Playlists) shown instead of yours.
  const [results, setResults] = useState<{ query: string; rows: ShelfRow[] } | null>(null)
  const homeRow = useRef(0) // the row you were on before searching, to come back to
  const collection = useRemixCollection(remix && street && phase === 'shelf', library, mode === 'sample')
  const remixTracks = useMemo(() => [
    ...collection.tracks,
    ...rowList.flatMap(row => row.discs.flatMap(disc => disc.tracks ?? [])),
    ...library.flatMap(disc => (disc.tracks ?? []).map(track => ({ ...track, imageUrl: track.imageUrl ?? disc.imageUrl }))),
  ], [collection.tracks, rowList, library])
  const remixed = useRemixRows(remixTracks, mode === 'sample')
  const shownRows = results?.rows ?? (remix ? remixed.rows : rowList)
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
  const playing = !!now.disc && !now.paused
  const loadedSongs = useMemo(() => [
    ...(tracks ?? []),
    ...(remix ? collection.tracks : []),
    ...shownRows.flatMap(row => row.discs.flatMap(disc => disc.tracks ?? [])),
    ...library.flatMap(disc => disc.tracks ?? []),
    ...(now.track ? [now.track] : []),
  ], [tracks, shownRows, library, now.track, remix, collection.tracks])
  const prioritySongs = useMemo(() => remix ? collection.tracks.slice(0, collection.recentCount) : [],
    [remix, collection.tracks, collection.recentCount])
  useLoadedSongMoods(loadedSongs, mode !== 'sample' && phase === 'shelf' && import.meta.env.DEV, prioritySongs)
  const songMood = useSongMood(now.track, street && mode !== 'sample' && import.meta.env.DEV)

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
      setRemix(false)
      setActiveRow(0)
      stack.target = 0
      if (user) {
        setRowList(startingRows())
        // Whatever goes wrong, no row should be left saying it's loading forever.
        void loadRows(user, list, setRowList).then(() => {
          if (auth.isLoggedIn()) saveCache(user.id, list)
        }).catch(() =>
          setRowList((rows) => rows.map((r) => (r.loading ? { ...r, loading: false, note: "Couldn't load this row" } : r))),
        )
      } else setRowList(sampleRows(list))
      setPhase('shelf')
      setLine(rhymes.welcome())
    },
    [shelfScroll, rowScrolls, stack, rhymes],
  )

  const libraryLoading = useRef(false)
  const loadFromSpotify = useCallback(
    async (force = false) => {
      if (libraryLoading.current) return
      libraryLoading.current = true
      setNotice(null)
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
            err.status === 429 ? err.message : err.status === 403
              ? "Spotify blocked this account. Playback is invite-only for now, so ask the owner to add your Spotify email."
              : `Couldn't load your library: ${err.message}`,
        })
      } finally {
        libraryLoading.current = false
      }
    },
    [startShelf],
  )

  useEffect(() => {
    void (async () => {
      if (new URLSearchParams(window.location.search).get('demo') === '1') {
        void startShelf(null, sampleLibrary())
        return
      }
      const error = await auth.handleRedirect()
      if (error) setNotice({ text: error })
      if (auth.isLoggedIn()) void loadFromSpotify()
    })()
  }, [loadFromSpotify, startShelf])

  const trySample = () => void startShelf(null, sampleLibrary())

  const signOut = () => {
    player.stop()
    player.disconnectPlayer()
    auth.logout()
    clearCache()
    setPulled(null)
    setMe(null)
    setRemix(false)
    setLibrary([])
    setRowList([])
    setPhase('welcome')
  }

  // ---- Shelf interactions ----------------------------------------------------

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

  const toggleRemix = () => {
    if (pulled) return
    const next = !remix
    if (next) remixHome.current = results ? homeRow.current : activeRow
    setResults(null)
    setQuery('')
    const row = next ? Math.max(0, remixed.rows.findIndex(r => r.discs.length && r.id !== 'remix:pending'))
      : Math.min(remixHome.current, Math.max(0, rowList.length - 1))
    setRemix(next)
    setActiveRow(row)
    stack.target = stack.current = row
  }

  // Street: the CD at the front of the line, named in a label above it.
  const [focused, setFocused] = useState<Disc | null>(null)
  useEffect(() => {
    const measure = () => {
      setHeaderTop((topbarRef.current?.getBoundingClientRect().bottom ?? 58) + 12)
      setFocusTop((headerRef.current?.getBoundingClientRect().bottom ?? 120) + 12)
    }
    const observer = new ResizeObserver(measure)
    if (topbarRef.current) observer.observe(topbarRef.current)
    if (headerRef.current) observer.observe(headerRef.current)
    window.addEventListener('resize', measure)
    measure()
    return () => { observer.disconnect(); window.removeEventListener('resize', measure) }
  }, [phase, pulled, results, remix, activeRow, headerTop])


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

  const skip = (dir: 1 | -1) => { void player.skip(dir) }

  // Keyboard: arrows scroll the shelf, Escape puts the CD back.
  useEffect(() => {
    if (phase !== 'shelf') return
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || (e.target instanceof HTMLElement &&
        e.target.closest('input, select, textarea, button, a, [contenteditable="true"]'))) return
      if (e.key === 'Escape') {
        if (showTracks) setShowTracks(false)
        else if (pulled) putBack()
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
            {notice && <p className="note" role="alert">{notice.text}</p>}
            <button className="big spotify" disabled={!auth.isConfigured()} onClick={() => auth.isLoggedIn() ? void loadFromSpotify() : void auth.login()}>
              {auth.isLoggedIn() ? 'Retry loading library' : 'Sign in with Spotify'}
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
      </main>
    )
  }

  return (
    <main className={`room ${theme} ${playing ? 'grooving' : ''} ${pulled ? 'inspecting' : ''} ${remix && street && !results ? 'remixing' : ''}`} data-sky={street ? sky : undefined}>
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
          {street && (
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
          )}
          {pulled && (
            <PulledCD
              key={pulled.disc.id}
              disc={pulled.disc}
              tracks={tracks}
              trackError={trackError}
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

      <header className="topbar" ref={topbarRef}>
        <div className="brand">PLAYBACK</div>
        <input
          className="search"
          placeholder={mode === 'sample' ? 'Search demo music…' : street ? 'Search Spotify…' : 'Find a CD…'}
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
        {street && <button className="chip remix-toggle" role="switch" aria-checked={remix}
          disabled={!!pulled} onClick={toggleRemix} title="Group your music by mood">
          Remix <span aria-hidden="true">{remix ? 'ON' : 'OFF'}</span>
        </button>}
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
          <button className="chip" title="Demo · real song previews" onClick={() => { player.stop(); setPhase('welcome') }}>
            Exit demo
          </button>
        )}
      </header>


      <Host line={line} bouncing={playing} theme={theme}
        navigation={{ horizontal: scroll, vertical: stack, enabled: !pulled && theme === 'street' }}
        songMood={mode === 'sample' || import.meta.env.DEV ? songMood : undefined} />

      {pulled && pulled.stage !== 'returning' && <nav className="case-actions" aria-label="CD actions">
        <button className="chip" onClick={putBack}>← Back to collection</button>
        {pulled.stage === 'open' && <>
          {now.disc?.id !== pulled.disc.id && <button className="chip" disabled={starting}
            onClick={() => void playIndex(0)}>{starting ? 'Starting…' : '▶ Play CD'}</button>}
          <button className="chip" aria-expanded={showTracks} aria-controls="case-tracks"
            onClick={() => setShowTracks(value => !value)}>{showTracks ? 'Hide tracks' : 'Tracks'}</button>
        </>}
      </nav>}
      {pulled && pulled.stage === 'open' && showTracks && (
        <TrackPanel
          disc={pulled.disc}
          tracks={tracks}
          error={trackError}
          nowUri={now.disc?.id === pulled.disc.id ? (now.track?.uri ?? null) : null}
          onPlay={(i) => void playIndex(i)}
          onClose={() => setShowTracks(false)}
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
        <div ref={headerRef} style={{ top: results ? headerTop + 54 : headerTop }} className={`row-header ${results ? 'below-results' : ''}`} key={`header:${currentRow.id}`}>
          {remix && !results ? <select aria-label="Mood row" value={activeRow} onChange={e => goToRow(Number(e.target.value))}>
            {shownRows.map((row, index) => <option key={row.id} value={index}>{row.title} · {row.discs.length}</option>)}
          </select> : <strong>{currentRow.title}</strong>}
          <span>
            Row {activeRow + 1} of {shownRows.length}
          </span>
          {remix && !results && <div className="remix-status" role="status">
            {mode === 'sample' ? `Demo moods · ${remixed.total} sample songs`
              : remixed.setup ? `Jev isn't connected yet · ${remixed.total} songs ready`
              : !import.meta.env.DEV || remixed.unsupported ? `Mood sorting isn't enabled on this site yet · ${remixed.total} songs ready`
              : `${remixed.total - remixed.pending} of ${remixed.total} checked · ${remixed.classified} sorted · ${remixed.pending} waiting`}
            {mode !== 'sample' && remixed.total - remixed.pending > 0 && !remixed.classified && <small>No reliable moods yet. Checked songs remain available in Unrated.</small>}
            {mode !== 'sample' && (remixed.outcomes.unmatched + remixed.outcomes.uncertain + remixed.outcomes.unavailable > 0) && <small>
              {remixed.outcomes.unmatched} without a public catalog match · {remixed.outcomes.uncertain} uncertain · {remixed.outcomes.unavailable} lookup errors
            </small>}
            {mode !== 'sample' && <small>{collection.loading ? `Loading ${collection.source}…` : `${collection.recentCount} recently played songs included`}</small>}
            {collection.issues.length > 0 && <details><summary>Some music couldn't be loaded</summary>
              {collection.issues.map(issue => <p key={issue}>{issue}</p>)}
            </details>}
          </div>}
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
      {!pulled && street && currentRow && !currentRow.loading && !currentRow.discs.length && (
        <div className="empty-row" style={{ top: focusTop }} role="status">
          <strong>{currentRow.title}</strong>
          <span>{currentRow.note ?? 'No songs here yet'}</span>
        </div>
      )}
      {!pulled && street && focused && currentRow?.discs.length ? (
        <div style={{ top: focusTop }} className={`focus-label ${results ? 'below-results' : ''}`} key={`focus:${focused.id}`}>
          <strong>{focused.title}</strong>
          <span>{focused.subtitle}</span>
          {focused.kind === 'track' && focused.tracks?.[0] && <SongMoodLabel track={focused.tracks[0]} />}
        </div>
      ) : null}
      {!pulled && showHint && (
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
        onSeek={player.seek}
      />
    </main>
  )
}
