import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { accentFor, colorFor, INK } from '../lib/colors'
import type { Disc } from '../types'

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

function finish(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

const FONT = '"Baloo 2", "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif'

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight = 800): void {
  let s = size
  do {
    ctx.font = `${weight} ${s}px ${FONT}`
    s -= 2
  } while (ctx.measureText(text).width > maxWidth && s > 10)
}

const KIND_MARK: Record<Disc['kind'], string> = { album: '', playlist: '✦ ', liked: '♥ ' }

/** The thin edge of the case you see on the shelf: title and artist written sideways. */
export function spineTexture(disc: Disc): THREE.CanvasTexture {
  const W = 96
  const H = 960
  const [c, ctx] = canvas(W, H)
  ctx.fillStyle = colorFor(disc.id + disc.title)
  ctx.fillRect(0, 0, W, H)
  // Accent band at the top, like a label sticker.
  ctx.fillStyle = accentFor(disc.title)
  ctx.fillRect(0, 0, W, 120)
  ctx.lineWidth = 10
  ctx.strokeStyle = INK
  ctx.strokeRect(5, 5, W - 10, H - 10)
  ctx.beginPath()
  ctx.moveTo(0, 120)
  ctx.lineTo(W, 120)
  ctx.stroke()

  ctx.save()
  ctx.translate(W / 2, 150)
  ctx.rotate(Math.PI / 2)
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  const title = KIND_MARK[disc.kind] + disc.title
  fitText(ctx, title, H - 220, 44)
  ctx.fillText(title, 0, -8)
  fitText(ctx, disc.subtitle, H - 220, 26, 600)
  ctx.globalAlpha = 0.75
  ctx.fillText(disc.subtitle, 0, 26)
  ctx.restore()
  return finish(c)
}

/** A bold paper-cutout cover for anything without Spotify art (and for sample CDs). */
export function generatedCover(disc: Disc): THREE.CanvasTexture {
  const S = 512
  const [c, ctx] = canvas(S, S)
  const base = colorFor(disc.title)
  const accent = accentFor(disc.id)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, S, S)

  let seed = 0
  for (const ch of disc.id + disc.title) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)

  ctx.lineWidth = 12
  ctx.strokeStyle = INK
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? accent : '#fff7e8'
    ctx.beginPath()
    const x = rand() * S
    const y = rand() * S * 0.7
    const r = 40 + rand() * 90
    if (rand() > 0.5) ctx.arc(x, y, r, 0, Math.PI * 2)
    else ctx.rect(x - r, y - r, r * 1.6, r * 1.2)
    ctx.fill()
    ctx.stroke()
  }
  if (disc.kind === 'liked') {
    ctx.font = `900 260px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ff5e5e'
    ctx.fillText('♥', S / 2, S * 0.42)
    ctx.strokeText('♥', S / 2, S * 0.42)
  }
  // Title strip along the bottom.
  ctx.fillStyle = '#fff7e8'
  ctx.fillRect(0, S - 130, S, 130)
  ctx.beginPath()
  ctx.moveTo(0, S - 130)
  ctx.lineTo(S, S - 130)
  ctx.stroke()
  ctx.fillStyle = INK
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  fitText(ctx, disc.title, S - 48, 56, 900)
  ctx.fillText(disc.title, 24, S - 66)
  fitText(ctx, disc.subtitle, S - 48, 32, 700)
  ctx.fillText(disc.subtitle, 24, S - 24)
  ctx.strokeRect(6, 6, S - 12, S - 12)
  return finish(c)
}

/** Inside of the lid: the back of the little booklet, seen when the case is open. */
export function bookletTexture(disc: Disc): THREE.CanvasTexture {
  const W = 512
  const H = 450
  const [c, ctx] = canvas(W, H)
  ctx.fillStyle = '#fff7e8'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = accentFor(disc.id)
  ctx.fillRect(0, 0, W, 90)
  ctx.lineWidth = 8
  ctx.strokeStyle = INK
  ctx.strokeRect(4, 4, W - 8, H - 8)
  ctx.beginPath()
  ctx.moveTo(0, 90)
  ctx.lineTo(W, 90)
  ctx.stroke()
  ctx.save()
  ctx.fillStyle = INK
  ctx.textBaseline = 'middle'
  fitText(ctx, disc.title, W - 60, 46, 800)
  ctx.fillText(disc.title, 30, 46)
  ctx.globalAlpha = 0.25
  for (let i = 0; i < 9; i++) {
    const w = 140 + ((i * 97) % 220)
    ctx.fillRect(30, 130 + i * 32, w, 12)
  }
  ctx.restore()
  return finish(c)
}

const loader = new THREE.TextureLoader()
loader.setCrossOrigin('anonymous')

/**
 * Loads an image URL as a texture, using a generated one when there's no URL or it fails.
 * `key` says when the fallback needs remaking (e.g. the disc changed).
 */
export function useArt(url: string | undefined, makeFallback: () => THREE.Texture, key: string): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    let alive = true
    let made: THREE.Texture | null = null
    const fallback = () => {
      if (!alive) return
      made = makeFallback()
      setTex(made)
    }
    if (url) {
      loader.load(
        url,
        (t) => {
          if (!alive) return t.dispose()
          t.colorSpace = THREE.SRGBColorSpace
          t.anisotropy = 8
          made = t
          setTex(t)
        },
        undefined,
        fallback,
      )
    } else {
      fallback()
    }
    return () => {
      alive = false
      made?.dispose()
    }
    // makeFallback is recreated each render; `key` covers what it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, key])
  return tex
}

/** The real Spotify cover, falling back to a generated one if there's none or it fails to load. */
export function useCover(disc: Disc): THREE.Texture | null {
  return useArt(disc.imageUrl, () => generatedCover(disc), disc.id)
}
