import * as THREE from 'three'
import type { Disc } from '../types'
import { moodLabel, useSongMoodResult } from '../lib/songMood'

// A small shared texture per label, independent of the album-art texture.
const badges = new Map<string, { texture: THREE.CanvasTexture; aspect: number }>()
function badgeArt(text: string) {
  const existing = badges.get(text)
  if (existing) return existing
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = '500 28px Arial, sans-serif'
  canvas.width = Math.ceil(ctx.measureText(text).width) + 32
  canvas.height = 56
  ctx.fillStyle = '#fff7e8'
  ctx.strokeStyle = '#302d38'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 7)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#302d38'
  ctx.font = '500 28px Arial, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 1)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const art = { texture, aspect: canvas.width / canvas.height }
  badges.set(text, art)
  return art
}
if (import.meta.hot) import.meta.hot.dispose(() => {
  for (const art of badges.values()) art.texture.dispose()
  badges.clear()
})

export function CoverMoodBadge({ disc, right, bottom, z, coverWidth }: {
  disc: Disc; right: number; bottom: number; z: number; coverWidth: number
}) {
  const track = disc.kind === 'track' ? disc.tracks?.[0] ?? null : null
  const result = useSongMoodResult(track)
  if (!track) return null
  const label = moodLabel(result)
  const art = badgeArt(label.text)
  const height = coverWidth * 0.105
  const width = height * art.aspect
  const gap = coverWidth * 0.06
  return <mesh name="CoverMoodBadge" position={[right + gap + width / 2, bottom + height / 2, z]}
    renderOrder={1} raycast={() => {}}>
    <planeGeometry args={[width, height]} />
    <meshBasicMaterial map={art.texture} transparent toneMapped={false} depthWrite={false} />
  </mesh>
}
