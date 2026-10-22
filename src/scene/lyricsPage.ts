// Collections show a looping track list; single songs show lyrics scrolling with playback.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { accentFor, INK } from '../lib/colors'
import { fetchLyrics, type Lyrics } from '../spotify/lyrics'
import { livePosition, playerStore } from '../spotify/player'
import type { Disc, Track } from '../types'
import { drawTrackList } from './trackListPage'
import { songMoods } from '../lib/songMood'
import { fitText, FONT } from './textures'

const PAPER = '#fff7e8'
const HEADER = 0.17 // share of the page taken by the title band
const LINE_PX = 0.062 // lyric text size, as a share of page width

interface Row {
  text: string
  /** Which lyric line this row belongs to (a long line wraps onto several rows). */
  line: number
}

type State = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; lyrics: Lyrics }

/** A texture for the booklet's inside page, `w` x `h` pixels. */
export function useBookletPage(
  disc: Disc, w: number, h: number, tracks: Track[] | null, error: string | null, open: boolean,
): THREE.CanvasTexture {
  const page = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    tex.generateMipmaps = false
    tex.minFilter = THREE.LinearFilter
    return { c, ctx: c.getContext('2d')!, tex }
  }, [w, h])
  useEffect(() => () => page.tex.dispose(), [page])

  // The song playing from this CD, if any.
  const { now } = useSyncExternalStore(playerStore.subscribe, playerStore.get)
  const track = disc.kind === 'track' && now.disc?.id === disc.id ? now.track : null
  const [state, setState] = useState<State>({ status: 'idle' })
  useEffect(() => {
    if (!track) return setState({ status: 'idle' })
    let alive = true
    setState({ status: 'loading' })
    void fetchLyrics(track, disc.kind === 'album' ? disc.title : undefined).then((lyrics) => {
      if (alive) setState({ status: 'ready', lyrics })
    })
    return () => {
      alive = false
    }
    // Only a new song needs new lyrics.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.uri, disc])

  const listOffset = useRef(0)
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    listOffset.current = 0
    if (disc.kind === 'track') return
    drawTrackList(page.ctx, w, h, disc, tracks, error, 0)
    page.tex.needsUpdate = true
  }, [page, w, h, disc, tracks, error])
  useEffect(() => songMoods.subscribe(() => {
    if (disc.kind === 'track') return
    drawTrackList(page.ctx, w, h, disc, tracks, error, listOffset.current)
    page.tex.needsUpdate = true
  }), [page, w, h, disc, tracks, error])

  const size = Math.round(w * LINE_PX)
  const rows = useMemo(() => {
    if (state.status !== 'ready') return []
    const { lyrics } = state
    const texts = lyrics.kind === 'synced' ? lyrics.lines.map((l) => l.text) : lyrics.kind === 'plain' ? lyrics.lines : []
    page.ctx.font = `700 ${size}px ${FONT}`
    return texts.flatMap((text, line) => wrap(page.ctx, text || '♪', w * 0.84).map((t) => ({ text: t, line })))
  }, [state, page, size, w])

  const view = useRef({ scroll: 0, active: -2, drawn: '' })
  useFrame((_, dt) => {
    if (disc.kind !== 'track') {
      if (!open || reduceMotion || document.hidden || !disc.tracksAvailable || error || !tracks?.length) return
      // Constant speed: three seconds per row. Cap suspension gaps so returning to a tab never jumps.
      listOffset.current = (listOffset.current + Math.min(dt, 0.1) / 3) % tracks.length
      drawTrackList(page.ctx, w, h, disc, tracks, error, listOffset.current)
      page.tex.needsUpdate = true
      return
    }
    const v = view.current
    const current = playerStore.get().now
    const pos = livePosition(current)
    let target = 0
    let active = -1
    if (state.status === 'ready' && state.lyrics.kind === 'synced') {
      const { lines } = state.lyrics
      while (active + 1 < lines.length && lines[active + 1].timeMs <= pos) active++
      // Keep the line being sung near the top third of the page.
      const first = rows.findIndex((r) => r.line === Math.max(0, active))
      target = Math.max(0, first)
    } else if (state.status === 'ready' && state.lyrics.kind === 'plain' && current.durationMs) {
      // No timings: glide through the words at the song's pace.
      target = (pos / current.durationMs) * Math.max(0, rows.length - 3)
    }
    v.scroll += (target - v.scroll) * Math.min(1, dt * 6)
    if (Math.abs(target - v.scroll) < 0.002) v.scroll = target
    // Redraw only when what's on the page changed.
    const key = `${state.status}|${rows.length}|${active}|${v.scroll.toFixed(3)}|${track?.uri}`
    if (key === v.drawn) return
    v.drawn = key
    draw(page.ctx, w, h, disc, track?.name ?? null, state, rows, v.scroll, active, size)
    page.tex.needsUpdate = true
  })

  return page.tex
}

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  disc: Disc,
  song: string | null,
  state: State,
  rows: Row[],
  scroll: number,
  active: number,
  size: number,
) {
  const head = Math.round(h * HEADER)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)

  // Title band: the song when one is playing, otherwise the CD.
  ctx.fillStyle = accentFor(disc.id)
  ctx.fillRect(0, 0, w, head)
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const title = song ?? disc.title
  fitText(ctx, title, w - w * 0.12, Math.round(head * 0.5))
  ctx.fillText(title, w * 0.06, head / 2)

  const body = { top: head, height: h - head }
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, body.top, w, body.height)
  ctx.clip()
  ctx.textAlign = 'center'
  const message = (text: string) => {
    ctx.globalAlpha = 0.55
    fitText(ctx, text, w * 0.84, size, 700)
    ctx.fillText(text, w / 2, body.top + body.height / 2)
    ctx.globalAlpha = 1
  }
  if (state.status === 'idle') message('Play a song to see its lyrics')
  else if (state.status === 'loading') message('Finding the lyrics…')
  else if (state.lyrics.kind === 'instrumental') message('♪  Instrumental  ♪')
  else if (state.lyrics.kind === 'none' || !rows.length) message('No lyrics found for this song')
  else {
    const rowH = size * 1.35
    const y0 = body.top + body.height * 0.3
    const synced = state.lyrics.kind === 'synced'
    for (let i = Math.max(0, Math.floor(scroll - 4)); i < rows.length; i++) {
      const y = y0 + (i - scroll) * rowH
      if (y > h + rowH) break
      const now = synced && rows[i].line === active
      ctx.font = `${now ? 800 : 600} ${size}px ${FONT}`
      ctx.fillStyle = INK
      ctx.globalAlpha = synced ? (now ? 1 : rows[i].line < active ? 0.25 : 0.45) : 0.8
      ctx.fillText(rows[i].text, w / 2, y)
    }
    ctx.globalAlpha = 1
    // Soft fade where lines scroll in and out.
    const fade = (from: number, to: number) => {
      const g = ctx.createLinearGradient(0, from, 0, to)
      g.addColorStop(0, PAPER)
      g.addColorStop(1, 'rgba(255,247,232,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, Math.min(from, to), w, Math.abs(to - from))
    }
    fade(body.top, body.top + rowH * 1.2)
    fade(h, h - rowH * 1.6)
    ctx.restore()
    ctx.save()
    ctx.font = `600 ${Math.round(size * 0.45)}px ${FONT}`
    ctx.globalAlpha = 0.45
    ctx.textAlign = 'right'
    ctx.fillStyle = INK
    ctx.fillText('Lyrics from LRCLIB', w - w * 0.04, h - size * 0.5)
  }
  ctx.restore()

  ctx.lineWidth = Math.max(4, w / 64)
  ctx.strokeStyle = INK
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth)
  ctx.beginPath()
  ctx.moveTo(0, head)
  ctx.lineTo(w, head)
  ctx.stroke()
}

/** Splits text into rows that fit `max` pixels at the context's current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const rows: string[] = []
  let row = ''
  for (const word of text.split(/\s+/)) {
    const next = row ? `${row} ${word}` : word
    if (row && ctx.measureText(next).width > max) {
      rows.push(row)
      row = word
    } else row = next
  }
  rows.push(row)
  return rows
}
