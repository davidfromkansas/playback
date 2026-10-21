// Bright printed designs for discs that have no cover art, like a stack of game and mix CDs.
import * as THREE from 'three'
import { INK } from '../lib/colors'
import type { Disc } from '../types'

export const DISC_COLORS = ['#ff3d9a', '#9b5cff', '#19c3b4', '#ff8a1f', '#2f7bff', '#ffd21f', '#3ddc5a', '#ff4d4d']

const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif'
const S = 1024
const MID = S / 2

function seeded(text: string) {
  let seed = 0
  for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x, y + r * 0.9)
  ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.6, y - r * 1.1, x, y - r * 0.35)
  ctx.bezierCurveTo(x + r * 0.6, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9)
  ctx.closePath()
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight = 800) {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${FONT}`
    s -= 3
  } while (ctx.measureText(text).width > maxWidth && s > 18)
}

export type DiscStyle = 'tint' | 'stripes' | 'dots' | 'burst' | 'stickers'
const STYLES: DiscStyle[] = ['tint', 'stripes', 'dots', 'burst', 'stickers']

export function discStyle(disc: Disc): DiscStyle {
  return STYLES[seeded(disc.id + disc.title)() * STYLES.length | 0]
}

/** A full-square print; the disc shows the circle inside it. */
export function discPrint(disc: Disc): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  const rand = seeded(disc.title + disc.id)
  const pick = () => DISC_COLORS[(rand() * DISC_COLORS.length) | 0]
  const base = pick()
  let accent = pick()
  if (accent === base) accent = DISC_COLORS[(DISC_COLORS.indexOf(base) + 3) % DISC_COLORS.length]
  const style = discStyle(disc)

  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)

  if (style === 'tint') {
    // A colored blank CD-R: soft radial shading and a white write-on label.
    const g = ctx.createRadialGradient(MID, MID, S * 0.15, MID, MID, S * 0.5)
    g.addColorStop(0, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(0,0,0,0.15)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    ctx.fillStyle = '#fbfbf7'
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.roundRect(MID - 260, S * 0.74, 520, 120, 24)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#2b2bb5'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    fit(ctx, disc.title, 470, 64, 600)
    ctx.fillText(disc.title, MID, S * 0.74 + 60)
    return finish(c)
  }

  if (style === 'stripes') {
    for (let r = S * 0.72; r > S * 0.18; r -= 46) {
      ctx.beginPath()
      ctx.arc(MID, MID, r, 0, Math.PI * 2)
      ctx.fillStyle = ((r / 46) | 0) % 2 ? accent : base
      ctx.fill()
    }
  } else if (style === 'dots') {
    ctx.fillStyle = accent
    for (let y = 30; y < S; y += 110) {
      for (let x = (y / 110) % 2 ? 30 : 85; x < S; x += 110) {
        ctx.beginPath()
        ctx.arc(x, y, 26, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (style === 'burst') {
    ctx.fillStyle = accent
    for (let i = 0; i < 24; i += 2) {
      ctx.beginPath()
      ctx.moveTo(MID, MID)
      ctx.arc(MID, MID, S, (Math.PI / 12) * i, (Math.PI / 12) * (i + 1))
      ctx.closePath()
      ctx.fill()
    }
  } else {
    const g = ctx.createLinearGradient(0, 0, S, S)
    g.addColorStop(0, base)
    g.addColorStop(1, accent)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
  }

  // Stickers scattered around the printable ring.
  ctx.lineWidth = 8
  ctx.strokeStyle = INK
  for (let i = 0; i < 7; i++) {
    const a = rand() * Math.PI * 2
    const d = S * (0.3 + rand() * 0.14)
    const x = MID + Math.cos(a) * d
    const y = MID + Math.sin(a) * d
    if (y > S * 0.6 && y < S * 0.9 && Math.abs(x - MID) < 300) continue // keep the title clear
    ctx.fillStyle = i % 2 ? '#fff7e8' : pick()
    if (rand() > 0.5) star(ctx, x, y, 34 + rand() * 20)
    else heart(ctx, x, y, 30 + rand() * 16)
    ctx.fill()
    ctx.stroke()
  }

  // Big title like a game disc, outlined so it reads on any background.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  fit(ctx, disc.title, 640, 110, 800)
  ctx.lineWidth = 18
  ctx.strokeStyle = INK
  ctx.strokeText(disc.title, MID, S * 0.78)
  ctx.fillStyle = '#fff7e8'
  ctx.fillText(disc.title, MID, S * 0.78)
  fit(ctx, disc.subtitle, 420, 52, 700)
  ctx.lineWidth = 10
  ctx.strokeText(disc.subtitle, MID, S * 0.2)
  ctx.fillText(disc.subtitle, MID, S * 0.2)
  return finish(c)
}

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
