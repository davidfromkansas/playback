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

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, font: string) {
  let s = size
  do {
    ctx.font = `${s}px ${font}`
    s -= 2
  } while (ctx.measureText(text).width > maxWidth && s > 10)
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
