// Bright, flat, paper-cutout palette used for spines, the room and the host.
export const PALETTE = [
  '#ff7eb6', // bubblegum
  '#ffe14d', // lemon
  '#7ee0ff', // sky
  '#9dff8a', // lime
  '#c8a6ff', // lilac
  '#ffa96b', // tangerine
  '#ff5e5e', // tomato
  '#5ef0c2', // mint
]

export const INK = '#1b1b1b'

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function colorFor(text: string): string {
  return PALETTE[hash(text) % PALETTE.length]
}

export function accentFor(text: string): string {
  return PALETTE[(hash(text) >>> 3) % PALETTE.length]
}
