// Extract whole drawings; use one uniform scale per source sheet, never per pose.
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
const require = createRequire(process.env.ART_RUNTIME || import.meta.url)
const sharp = require('sharp')
const size = { width: 400, height: 380 }
const sources = [
  { name: 'sequence', rows: 4, columns: 4, scale: 1 },
  { name: 'bridge', rows: 2, columns: 4, scale: 0.63 },
  { name: 'dance', rows: 3, columns: 4, scale: 0.85 },
  { name: 'punch', rows: 3, columns: 4, scale: 0.85 },
  { name: 'duck', rows: 3, columns: 4, scale: 0.85 },
  { name: 'wave', rows: 3, columns: 4, scale: 0.9 },
  ...['holster', 'bart', 'running', 'rabbit', 'cabbage', 'smurf', 'points', 'armwave',
    'toprock', 'sixstep', 'freeze', 'backspin', 'windmill'].map(name =>
    ({ name, rows: 2, columns: 4, scale: 0, expanded: true })),
]
const records = []
const layers = []
for (const source of sources) {
  const file = `art/dj-volt/${source.name}-source.png`
  const bytes = await fs.readFile(file)
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height } = info
  const seen = new Uint8Array(width * height)
  const figures = []
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] < 16) continue
    const queue = [start]
    seen[start] = 1
    let left = width, top = height, right = 0, bottom = 0
    for (let j = 0; j < queue.length; j++) {
      const p = queue[j], x = p % width, y = Math.floor(p / width)
      left = Math.min(left, x); right = Math.max(right, x)
      top = Math.min(top, y); bottom = Math.max(bottom, y)
      for (const k of [p - 1, p + 1, p - width, p + width]) {
        if (k >= 0 && k < seen.length && !seen[k] && data[k * 4 + 3] >= 16) {
          seen[k] = 1
          queue.push(k)
        }
      }
    }
    if (queue.length > 1000) figures.push({ left, top, right, bottom, pixels: queue })
  }
  figures.sort((a, b) => a.top - b.top)
  if (figures.length !== source.rows * source.columns) throw Error(`${file}: expected ${source.rows * source.columns} complete figures, got ${figures.length}`)
  const ordered = []
  for (let row = 0; row < source.rows; row++) {
    ordered.push(...figures.slice(row * source.columns, (row + 1) * source.columns).sort((a, b) => a.left - b.left))
  }
  if (source.expanded) source.scale = 300 / (ordered[0].bottom - ordered[0].top + 1)
  for (const [index, box] of ordered.entries()) {
    // Register the midpoint of both skate contact extents, not the arm-dependent silhouette center.
    let footLeft = width, footRight = 0
    const footTop = box.bottom - Math.round(20 / source.scale)
    for (let y = footTop; y <= box.bottom; y++) for (let x = box.left; x <= box.right; x++) {
      if (data[(y * width + x) * 4 + 3] > 160) {
        footLeft = Math.min(footLeft, x); footRight = Math.max(footRight, x)
      }
    }
    const floor = ['sixstep', 'freeze', 'backspin', 'windmill'].includes(source.name) && index > 0 && index < 7
    const root = [floor ? (box.left + box.right) / 2 : (footLeft + footRight) / 2, box.bottom]
    const crop = { left: Math.max(0, box.left - 2), top: Math.max(0, box.top - 2),
      width: Math.min(width - box.left + 2, box.right - box.left + 5),
      height: Math.min(height - box.top + 2, box.bottom - box.top + 5) }
    const targetWidth = Math.round(crop.width * source.scale)
    const targetHeight = Math.round(crop.height * source.scale)
    const left = Math.round(200 - (root[0] - crop.left) * source.scale)
    const top = Math.round(364 - (root[1] - crop.top) * source.scale)
    if (left < 0 || top < 0 || left + targetWidth > size.width || top + targetHeight > size.height) {
      throw Error(`Clipped cel ${source.name}-${index}`)
    }
    // Copy this connected figure only: nearby poses can overlap its rectangular bounds.
    const isolated = Buffer.alloc(crop.width * crop.height * 4)
    for (const pixel of box.pixels) {
      const x = pixel % width, y = Math.floor(pixel / width)
      const target = ((y - crop.top) * crop.width + x - crop.left) * 4
      data.copy(isolated, target, pixel * 4, pixel * 4 + 4)
    }
    const input = await sharp(isolated, { raw: { width: crop.width, height: crop.height, channels: 4 } })
      .resize(targetWidth, targetHeight).png().toBuffer()
    const cel = await sharp({ create: { ...size, channels: 4, background: '#00000000' } })
      .composite([{ input, left, top }]).png().toBuffer()
    const id = records.length
    layers.push({ input: cel, left: (id % 8) * size.width, top: Math.floor(id / 8) * size.height })
    records.push({ id, source: file, sourceIndex: index, crop, uniformScale: source.scale,
      sourceRoot: root, targetRoot: [200, 364], offset: [left, top],
      contactMethod: floor ? 'floor silhouette center / lowest support; not an anatomical slip measurement' : 'lowest wheel extents; visual review required',
      sha256: crypto.createHash('sha256').update(bytes).digest('hex') })
  }
}
await sharp({ create: { width: size.width * 8, height: size.height * Math.ceil(records.length / 8),
  channels: 4, background: '#00000000' } }).composite(layers).webp({ quality: 92, alphaQuality: 100 })
  .toFile('public/characters/dj-volt/atlas.webp')
await fs.writeFile('art/dj-volt/registration.json', JSON.stringify({ size, columns: 8, records }, null, 2))
console.log(`Registered ${records.length} complete cels`)
