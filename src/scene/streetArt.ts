// Spray paint, tags and stickers for the Street theme, all drawn on canvases.
import * as THREE from 'three'
import { INK } from '../lib/colors'
import type { Disc } from '../types'

export const STREET = {
  lime: '#c6ff00',
  pink: '#ff2e93',
  cyan: '#00d0ff',
  orange: '#ff8a1f',
  purple: '#8a4dff',
  yellow: '#ffe600',
  white: '#ffffff',
}
const SPRAY = Object.values(STREET)

const TAG_FONT = '"Rubik Spray Paint", "Permanent Marker", "Bangers", sans-serif'
const MARKER_FONT = '"Permanent Marker", "Bangers", sans-serif'
const COMIC_FONT = '"Bangers", "Arial Black", sans-serif'

function seeded(text: string) {
  let seed = 0
  for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function finish(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, font: string) {
  let s = size
  do {
    ctx.font = `${s}px ${font}`
    s -= 2
  } while (ctx.measureText(text).width > maxWidth && s > 10)
}

/** Soft spray dots around a stroke, plus paint drips running down. */
function sprayStroke(ctx: CanvasRenderingContext2D, rand: () => number, x: number, y: number, w: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  for (let i = 0; i < 260; i++) {
    const a = rand() * Math.PI * 2
    const r = Math.pow(rand(), 2) * w
    ctx.globalAlpha = 0.08 + rand() * 0.15
    ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.6, 2, 2)
  }
  ctx.globalAlpha = 0.9
  for (let i = 0; i < 3; i++) {
    const dx = x + (rand() - 0.5) * w
    const len = 10 + rand() * 40
    ctx.fillRect(dx, y, 3, len)
    ctx.beginPath()
    ctx.arc(dx + 1.5, y + len, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function tag(ctx: CanvasRenderingContext2D, rand: () => number, text: string, x: number, y: number, size: number) {
  const fill = SPRAY[(rand() * SPRAY.length) | 0]
  let outline = SPRAY[(rand() * SPRAY.length) | 0]
  if (outline === fill) outline = INK
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rand() - 0.5) * 0.35)
  ctx.font = `${size}px ${TAG_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.22
  ctx.strokeStyle = INK
  ctx.strokeText(text, 4, 6)
  ctx.lineWidth = size * 0.14
  ctx.strokeStyle = outline
  ctx.strokeText(text, 0, 0)
  ctx.fillStyle = fill
  ctx.fillText(text, 0, 0)
  ctx.restore()
  sprayStroke(ctx, rand, x, y + size * 0.4, size * 1.2, fill)
}

const TAGS = ['PLAYBACK', 'GG', 'FM', 'SPIN', 'LOUD', 'DIG', 'REWIND', 'B-SIDE', 'MIXTAPE', 'NO SKIP', 'VOLT']

/** The back wall of the CD rack: painted plywood covered in tags. Tiles sideways. */
export function graffitiWall(): THREE.CanvasTexture {
  const W = 2048
  const H = 1024
  const [c, ctx] = canvas(W, H)
  const rand = seeded('wall')
  // Plywood base with a few painted blocks
  ctx.fillStyle = '#3a3f55'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = SPRAY[(rand() * SPRAY.length) | 0]
    ctx.globalAlpha = 0.85
    const x = rand() * W
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 200 + rand() * 300, 0)
    ctx.lineTo(x + 100 + rand() * 300, H)
    ctx.lineTo(x - 100, H)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  for (let i = 0; i < 16; i++) {
    tag(ctx, rand, TAGS[i % TAGS.length], (i % 8) * 260 + 120 + rand() * 60, i < 8 ? 260 + rand() * 120 : 700 + rand() * 120, 110 + rand() * 70)
  }
  // Wrap a copy of the edges so the texture tiles without a seam.
  ctx.drawImage(c, 0, 0, 160, H, W - 160, 0, 160, H)
  return finish(c, true)
}

/** Hazard-striped steel for the rack's shelves. */
export function hazardTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(256, 64)
  ctx.fillStyle = STREET.yellow
  ctx.fillRect(0, 0, 256, 64)
  ctx.fillStyle = INK
  for (let x = -64; x < 256; x += 64) {
    ctx.beginPath()
    ctx.moveTo(x, 64)
    ctx.lineTo(x + 32, 64)
    ctx.lineTo(x + 64, 0)
    ctx.lineTo(x + 32, 0)
    ctx.fill()
  }
  return finish(c, true)
}

function sticker(ctx: CanvasRenderingContext2D, rand: () => number, x: number, y: number, r: number) {
  const kind = (rand() * 4) | 0
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate((rand() - 0.5) * 0.8)
  ctx.lineWidth = 5
  ctx.strokeStyle = INK
  ctx.fillStyle = SPRAY[(rand() * SPRAY.length) | 0]
  ctx.beginPath()
  if (kind === 0) {
    ctx.arc(0, 0, r, 0, Math.PI * 2)
  } else if (kind === 1) {
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2
      const rr = i % 2 ? r * 0.45 : r
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    ctx.closePath()
  } else if (kind === 2) {
    // lightning bolt
    ctx.moveTo(-r * 0.2, -r)
    ctx.lineTo(r * 0.5, -r)
    ctx.lineTo(0, -r * 0.1)
    ctx.lineTo(r * 0.5, -r * 0.1)
    ctx.lineTo(-r * 0.4, r)
    ctx.lineTo(-r * 0.05, r * 0.05)
    ctx.lineTo(-r * 0.5, r * 0.05)
    ctx.closePath()
  } else {
    ctx.roundRect(-r, -r * 0.6, r * 2, r * 1.2, 8)
  }
  ctx.fill()
  ctx.stroke()
  if (kind === 0 || kind === 3) {
    ctx.fillStyle = INK
    ctx.font = `${r * 0.8}px ${COMIC_FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(kind === 0 ? 'FM' : 'GG', 0, 2)
  }
  ctx.restore()
}

/** Spine for the Street theme: bold color, marker title, and a sticker or two slapped on. */
export function streetSpineTexture(disc: Disc): THREE.CanvasTexture {
  const W = 96
  const H = 960
  const [c, ctx] = canvas(W, H)
  const rand = seeded(disc.id + disc.title)
  const base = SPRAY[(rand() * SPRAY.length) | 0]
  ctx.fillStyle = base
  ctx.fillRect(0, 0, W, H)
  // Diagonal shine stripe
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.fillRect(0, 60, W, 18)
  ctx.lineWidth = 8
  ctx.strokeStyle = INK
  ctx.strokeRect(4, 4, W - 8, H - 8)

  ctx.save()
  ctx.translate(W / 2, 120)
  ctx.rotate(Math.PI / 2)
  ctx.textBaseline = 'middle'
  ctx.fillStyle = INK
  fit(ctx, disc.title, H - 300, 54, MARKER_FONT)
  ctx.fillText(disc.title, 0, -6)
  ctx.globalAlpha = 0.8
  fit(ctx, disc.subtitle, H - 300, 26, COMIC_FONT)
  ctx.fillText(disc.subtitle.toUpperCase(), 0, 30)
  ctx.restore()

  const count = 1 + ((rand() * 2) | 0)
  for (let i = 0; i < count; i++) sticker(ctx, rand, W / 2 + (rand() - 0.5) * 20, H - 90 - i * 120 - rand() * 60, 30)
  return finish(c)
}

/** Billboard ad for the Playback radio station, used when there's no cover to show. */
export function billboardAd(i: number): THREE.CanvasTexture {
  const [c, ctx] = canvas(1024, 576)
  const rand = seeded('bb' + i)
  const g = ctx.createLinearGradient(0, 0, 1024, 576)
  g.addColorStop(0, [STREET.pink, STREET.cyan, STREET.purple][i % 3])
  g.addColorStop(1, [STREET.orange, STREET.lime, STREET.pink][i % 3])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 1024, 576)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `150px ${COMIC_FONT}`
  ctx.lineWidth = 18
  ctx.strokeStyle = INK
  ctx.lineJoin = 'round'
  ctx.strokeText('PLAYBACK FM', 512, 240)
  ctx.fillStyle = STREET.white
  ctx.fillText('PLAYBACK FM', 512, 240)
  ctx.font = `70px ${MARKER_FONT}`
  ctx.fillStyle = INK
  ctx.fillText(['24/7 NO SKIPS', 'TUNE IN, TURN UP', 'YOUR CDS ON AIR'][i % 3], 512, 400)
  for (let k = 0; k < 4; k++) sticker(ctx, rand, 80 + rand() * 860, 60 + rand() * 450, 44)
  return finish(c)
}

/** A billboard advertising one of the user's own CDs: the cover, uncropped, beside big type. */
export function billboardWithCover(disc: Disc, i: number): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = reject
    img.onload = () => {
      const [c, ctx] = canvas(1024, 576)
      const g = ctx.createLinearGradient(0, 0, 1024, 576)
      g.addColorStop(0, [STREET.cyan, STREET.pink, STREET.lime][i % 3])
      g.addColorStop(1, [STREET.purple, STREET.orange, STREET.cyan][i % 3])
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 1024, 576)
      ctx.fillStyle = INK
      ctx.fillRect(44, 52, 480, 480)
      ctx.drawImage(img, 32, 40, 480, 480)
      ctx.lineWidth = 10
      ctx.strokeStyle = INK
      ctx.strokeRect(32, 40, 480, 480)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.font = `64px ${COMIC_FONT}`
      ctx.lineWidth = 12
      ctx.strokeText('NOW ON', 560, 110)
      ctx.fillStyle = STREET.white
      ctx.fillText('NOW ON', 560, 110)
      ctx.font = `92px ${COMIC_FONT}`
      ctx.strokeText('PLAYBACK FM', 548, 200)
      ctx.fillStyle = STREET.yellow
      ctx.fillText('PLAYBACK FM', 548, 200)
      ctx.fillStyle = INK
      fit(ctx, disc.title, 430, 60, MARKER_FONT)
      ctx.fillText(disc.title, 560, 340)
      fit(ctx, disc.subtitle, 430, 40, MARKER_FONT)
      ctx.fillText(disc.subtitle, 560, 410)
      resolve(finish(c))
    }
    img.src = disc.imageUrl!
  })
}
