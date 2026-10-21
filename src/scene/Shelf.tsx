import { Outlines } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { pulse } from '../lib/beat'
import { colorFor, INK } from '../lib/colors'
import type { Disc } from '../types'
import { CASE_H, CASE_W, columns, ROW_GAP, slot, SPACING, SPINE } from './layout'
import type { Theme } from '../lib/theme'
import { graffitiWall, hazardTexture, STREET, streetSpineTexture } from './streetArt'
import { toonMaterial } from './StreetBackdrop'
import { spineTexture } from './textures'

export interface ScrollState {
  target: number
  current: number
  max: number
}

interface ShelfProps {
  discs: Disc[]
  rows: number
  scroll: ScrollState
  selectedId: string | null
  highlightId: string | null
  playing: boolean
  theme: Theme
  onPick: (disc: Disc, from: THREE.Vector3) => void
}

const WINDOW_CHUNK = 16

export function Shelf({ discs, rows, scroll, selectedId, highlightId, playing, theme, onPick }: ShelfProps) {
  const group = useRef<THREE.Group>(null)
  const { viewport } = useThree()
  const cols = columns(discs.length, rows)
  const width = cols * SPACING
  const half = viewport.width / 2
  const visibleCols = Math.ceil(viewport.width / SPACING)

  // Scroll range: first CD just inside the left edge, last CD just inside the right.
  // (The shelf moves left as scroll grows, so a CD at x sits on screen at x - scroll.)
  const fits = width < viewport.width - 1
  const minScroll = fits ? width / 2 - SPACING / 2 : half - 0.6
  const maxScroll = fits ? minScroll : width - half + 0.6
  scroll.max = maxScroll
  useEffect(() => {
    scroll.target = THREE.MathUtils.clamp(scroll.target, minScroll, maxScroll)
    if (!Number.isFinite(scroll.current)) scroll.current = scroll.target
  }, [minScroll, maxScroll, scroll])

  // Only the columns near the camera are drawn, so big libraries stay fast.
  const [windowStart, setWindowStart] = useState(0)
  useFrame((_, dt) => {
    scroll.target = THREE.MathUtils.clamp(scroll.target, minScroll, maxScroll)
    if (!Number.isFinite(scroll.current)) scroll.current = scroll.target
    scroll.current += (scroll.target - scroll.current) * Math.min(1, dt * 7)
    if (group.current) {
      group.current.position.x = -scroll.current
      // The whole unit bobs to the beat while music plays.
      const s = playing ? 1 + 0.018 * pulse() : 1
      group.current.scale.set(1, s, 1)
    }
    const firstVisible = Math.floor((scroll.current - half) / SPACING)
    const start = Math.max(0, Math.floor(firstVisible / WINDOW_CHUNK) * WINDOW_CHUNK - WINDOW_CHUNK)
    if (start !== windowStart) setWindowStart(start)
  })

  const windowEnd = Math.min(cols, windowStart + visibleCols + WINDOW_CHUNK * 3)
  const visible = discs.slice(windowStart * rows, windowEnd * rows)

  return (
    <group ref={group}>
      {theme === 'street' ? <StreetRack rows={rows} width={width} /> : <ShelfFrame rows={rows} width={width} />}
      {visible.map((disc, i) => (
        <Spine
          key={disc.id}
          disc={disc}
          index={windowStart * rows + i}
          rows={rows}
          hidden={disc.id === selectedId}
          highlighted={disc.id === highlightId}
          theme={theme}
          onPick={onPick}
        />
      ))}
    </group>
  )
}

function frameSize(rows: number, width: number) {
  const plankW = width + 1.2
  const cx = width / 2 - SPACING / 2
  const totalH = rows * ROW_GAP
  // Plank k sits under row k-1 (plank 0 is the roof above the top row).
  const plankY = (k: number) => ((rows + 1) / 2 - k) * ROW_GAP - CASE_H / 2 - 0.06
  const midY = (plankY(0) + plankY(rows)) / 2
  return { plankW, cx, totalH, plankY, midY }
}

/** Street theme: a steel rack bolted to a tagged-up plywood wall, standing on the roof. */
function StreetRack({ rows, width }: { rows: number; width: number }) {
  const { plankW, cx, totalH, plankY, midY } = frameSize(rows, width)
  const mats = useMemo(() => {
    const wall = graffitiWall()
    wall.repeat.set(plankW / ((totalH + 0.2) * 2), 1)
    const hazard = hazardTexture()
    hazard.repeat.set(plankW / 0.6, 1)
    return {
      wall: toonMaterial('#ffffff', wall),
      plank: toonMaterial('#ffffff', hazard),
      steel: toonMaterial(STREET.pink),
    }
  }, [plankW, totalH])
  useEffect(
    () => () => Object.values(mats).forEach((m) => (m.map?.dispose(), m.dispose())),
    [mats],
  )
  const bottom = plankY(rows) - 0.06
  return (
    <group>
      {Array.from({ length: rows + 1 }, (_, k) => (
        <mesh key={k} position={[cx, plankY(k), 0]} material={mats.plank}>
          <boxGeometry args={[plankW, 0.12, CASE_W + 0.2]} />
          <Outlines thickness={0.03} color={INK} />
        </mesh>
      ))}
      <mesh position={[cx, midY, -CASE_W / 2 - 0.12]} material={mats.wall}>
        <boxGeometry args={[plankW, totalH + 0.2, 0.08]} />
        <Outlines thickness={0.04} color={INK} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[cx + (side * plankW) / 2, midY, 0]} material={mats.steel}>
            <boxGeometry args={[0.16, totalH + 0.2, CASE_W + 0.2]} />
            <Outlines thickness={0.03} color={INK} />
          </mesh>
          {/* Feet down to the roof */}
          {[-1, 1].map((d) => (
            <mesh key={d} position={[cx + (side * plankW) / 2, bottom - 0.25, (d * CASE_W) / 2]} material={mats.steel}>
              <boxGeometry args={[0.16, 0.5, 0.16]} />
              <Outlines thickness={0.03} color={INK} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function ShelfFrame({ rows, width }: { rows: number; width: number }) {
  const { plankW, cx, totalH, plankY, midY } = frameSize(rows, width)
  return (
    <group>
      {Array.from({ length: rows + 1 }, (_, k) => {
        return (
          <mesh key={k} position={[cx, plankY(k), 0]}>
            <boxGeometry args={[plankW, 0.12, CASE_W + 0.2]} />
            <meshBasicMaterial color="#ffb36b" />
            <Outlines thickness={0.025} color={INK} />
          </mesh>
        )
      })}
      {/* Back board */}
      <mesh position={[cx, midY, -CASE_W / 2 - 0.12]}>
        <boxGeometry args={[plankW, totalH + 0.2, 0.08]} />
        <meshBasicMaterial color="#fff2c7" />
        <Outlines thickness={0.03} color={INK} />
      </mesh>
      {/* Side panels */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[cx + (side * plankW) / 2, midY, 0]}>
          <boxGeometry args={[0.12, totalH + 0.2, CASE_W + 0.2]} />
          <meshBasicMaterial color="#ff9b5e" />
          <Outlines thickness={0.025} color={INK} />
        </mesh>
      ))}
    </group>
  )
}

interface SpineProps {
  disc: Disc
  index: number
  rows: number
  hidden: boolean
  highlighted: boolean
  theme: Theme
  onPick: (disc: Disc, from: THREE.Vector3) => void
}

const Spine = memo(function Spine({ disc, index, rows, hidden, highlighted, theme, onPick }: SpineProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const { x, y } = slot(index, rows)
  const materials = useMemo(() => {
    const side = new THREE.MeshBasicMaterial({ color: colorFor(disc.id + disc.title) })
    const front = new THREE.MeshBasicMaterial({ map: theme === 'street' ? streetSpineTexture(disc) : spineTexture(disc) })
    // Box faces: +x, -x, +y, -y, +z (toward camera), -z
    return [side, side, side, side, front, side]
  }, [disc, theme])
  useEffect(
    () => () => {
      materials[4].map?.dispose()
      materials.forEach((m) => m.dispose())
    },
    [materials],
  )

  useFrame((state, dt) => {
    const m = mesh.current
    if (!m) return
    const out = highlighted ? 0.45 : hover ? 0.28 : 0
    m.position.z += (out - m.position.z) * Math.min(1, dt * 12)
    m.rotation.z = highlighted ? Math.sin(state.clock.elapsedTime * 10) * 0.05 : 0
  })

  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    // A drag along the shelf isn't a pick.
    if (!mesh.current || e.delta > 8) return
    onPick(disc, mesh.current.getWorldPosition(new THREE.Vector3()))
  }

  return (
    <mesh
      ref={mesh}
      position={[x, y, 0]}
      visible={!hidden}
      material={materials}
      onClick={pick}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHover(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHover(false)
        document.body.style.cursor = ''
      }}
    >
      <boxGeometry args={[SPINE, CASE_H, CASE_W]} />
      <Outlines thickness={0.012} color={INK} />
    </mesh>
  )
})
