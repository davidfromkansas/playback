// Street theme: rows of CDs stacked top to bottom. The row you're on sits in the middle of the
// screen; the ones above and below peek in. Swiping up or down slides the whole stack.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ShelfRow } from '../spotify/rows'
import type { Disc } from '../types'
import { CaseLine } from './CaseLine'
import { CASE_H } from './layout'
import type { ScrollState } from './scroll'

export const ROW_SPACING = 2.7
const SHOWN = 1.6 // rows further than this from the one you're on aren't drawn

export interface StackState {
  /** The row index the stack is easing toward, plus any live drag (fractional). */
  target: number
  /** Where the stack is now. */
  current: number
}

interface Props {
  rows: ShelfRow[]
  active: number
  stack: StackState
  scrollFor: (rowId: string) => ScrollState
  selectedId: string | null
  playing: boolean
  onTap: (row: ShelfRow, disc: Disc, from: THREE.Vector3, fromRy: number) => void
  onActivate: (index: number) => void
  onFocus: (disc: Disc | null) => void
}

export function RowStack({ rows, active, stack, scrollFor, selectedId, playing, onTap, onActivate, onFocus }: Props) {
  const groups = useRef<(THREE.Group | null)[]>([])

  useFrame((_, dt) => {
    if (!Number.isFinite(stack.current)) stack.current = stack.target
    stack.current += (stack.target - stack.current) * Math.min(1, dt * 7)
    groups.current.forEach((g, k) => {
      if (!g) return
      const d = k - stack.current
      // Rows below sit lower, rows above higher; both lean back a little so the middle row stands out.
      g.position.set(0, -d * ROW_SPACING, -Math.abs(d) * 0.9)
      g.visible = Math.abs(d) < SHOWN
    })
  })

  return (
    <group>
      {rows.map((row, k) =>
        Math.abs(k - active) > 2 ? null : (
          <group key={row.id} ref={(g) => void (groups.current[k] = g)}>
            {!selectedId && <RowSign row={row} active={k === active} />}
            <CaseLine
              discs={row.discs}
              scroll={scrollFor(row.id)}
              active={k === active}
              selectedId={selectedId}
              playing={playing}
              onTap={(disc, from, ry) => onTap(row, disc, from, ry)}
              onActivate={() => onActivate(k)}
              onFocus={k === active ? onFocus : undefined}
            />
          </group>
        ),
      )}
    </group>
  )
}

/**
 * A painted sign floating at the start of a row with its name. The row you're on is named in the
 * page's header instead, so its sign only shows while it's loading or empty.
 */
function RowSign({ row, active }: { row: ShelfRow; active: boolean }) {
  const text = row.title
  // The active row uses responsive DOM status text, including empty and loading states.
  const show = !active
  const sign = useMemo(() => makeSign(text), [text])
  useEffect(() => () => (sign.material.map?.dispose(), sign.material.dispose()), [sign])
  if (!show) return null
  return (
    <mesh material={sign.material} position={[-1.2 + sign.width / 2, CASE_H / 2 + 0.38, 0.4]}>
      <planeGeometry args={[sign.width, 0.5]} />
    </mesh>
  )
}

function makeSign(text: string) {
  const h = 96
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')!
  const font = '56px Bangers, "Arial Black", sans-serif'
  ctx.font = font
  const w = Math.min(1600, Math.ceil(ctx.measureText(text.toUpperCase()).width) + 60)
  c.width = w
  c.height = h
  ctx.font = font
  ctx.fillStyle = '#111018'
  ctx.fillRect(6, 10, w - 6, h - 10)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 4, w - 8, h - 14)
  ctx.lineWidth = 5
  ctx.strokeStyle = '#111018'
  ctx.strokeRect(2.5, 6.5, w - 13, h - 19)
  ctx.fillStyle = '#111018'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.toUpperCase(), 26, h / 2 - 2)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
  return { material, width: Math.min(2.4, (w / h) * 0.5) }
}
