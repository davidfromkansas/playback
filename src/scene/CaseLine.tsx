// Street theme: one row of CDs as a line of jewel cases on a steel shelf, angled so you see their
// covers. Swipe (or scroll) along the line; the CD in front slides out. RowStack stacks the rows.
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { pulse } from '../lib/beat'
import type { Disc } from '../types'
import { JewelCase } from './JewelCase'
import { SteelShelf } from './SteelShelf'
import { CASE_H, CASE_W, LINE_STEP } from './layout'
import type { ScrollState } from './Shelf'

// The line runs to the right and away from the camera; each case is turned to face front-left.
const DIR = new THREE.Vector3(0.78, 0, -0.62).normalize()
const POP = new THREE.Vector3(0.35, 0.06, 0.6) // how far the CD in front slides out
const GAP = 0.42 // between neighbouring cases
const SPREAD = 0.6 // extra room either side of the CD in front
const TURN = -0.95 // how far each case is turned
const FOCUS_TURN = -0.28
const BEHIND = 6 // cases drawn before the one in front
const AHEAD = 16 // and after it, in the row you're on
const AHEAD_IDLE = 9 // and in the rows above and below

interface Props {
  discs: Disc[]
  scroll: ScrollState
  /** The row you're on: it settles on a CD, reports it, and lets you pull CDs out. */
  active: boolean
  selectedId: string | null
  playing: boolean
  /** Tapping the CD in front of the active row. */
  onTap: (disc: Disc, from: THREE.Vector3, fromRy: number) => void
  /** Tapping any CD in a row you're not on. */
  onActivate: () => void
  onFocus?: (disc: Disc | null) => void
}

export function CaseLine({ discs, scroll, active, selectedId, playing, onTap, onActivate, onFocus }: Props) {
  const max = Math.max(0, (discs.length - 1) * LINE_STEP)
  scroll.max = max
  const [focus, setFocus] = useState(0)
  const idle = useRef({ last: NaN, time: 0 })
  // Phones show less of the line, so it starts nearer the middle of the screen.
  const tall = useThree((s) => s.size.width < s.size.height)
  const origin = useMemo(() => new THREE.Vector3(tall ? -0.45 : -0.75, 0, 0), [tall])

  useEffect(() => {
    if (active) onFocus?.(discs[focus] ?? null)
  }, [active, discs, focus, onFocus])

  useFrame((_, dt) => {
    scroll.target = THREE.MathUtils.clamp(scroll.target, 0, max)
    // Once the swipe or wheel stops, settle on the nearest CD.
    const st = idle.current
    if (scroll.held || scroll.target !== st.last) {
      st.last = scroll.target
      st.time = 0
    } else if ((st.time += dt) > 0.12) {
      scroll.target = st.last = Math.round(scroll.target / LINE_STEP) * LINE_STEP
    }
    if (!Number.isFinite(scroll.current)) scroll.current = scroll.target
    scroll.current += (scroll.target - scroll.current) * Math.min(1, dt * 8)
    const f = Math.round(scroll.current / LINE_STEP)
    if (f !== focus) setFocus(f)
  })

  const start = Math.max(0, focus - BEHIND)
  const visible = discs.slice(start, focus + (active ? AHEAD : AHEAD_IDLE))

  return (
    <group>
      <Ledge origin={origin} length={Math.min(discs.length, focus + AHEAD) * GAP + SPREAD * 2 + 2} />
      {visible.map((disc, i) => (
        <LineCase
          key={disc.id}
          disc={disc}
          index={start + i}
          scroll={scroll}
          origin={origin}
          hidden={disc.id === selectedId}
          playing={active && playing}
          onClick={(group, front) => {
            if (!active) return onActivate()
            const index = start + i
            // Tapping the CD in front pulls it out; tapping another one brings it to the front.
            if (front) onTap(disc, group.getWorldPosition(new THREE.Vector3()), group.rotation.y)
            else scroll.target = index * LINE_STEP
          }}
        />
      ))}
    </group>
  )
}

// The shelf each row of CDs stands on, running along the line under the cases.
function Ledge({ origin, length }: { origin: THREE.Vector3; length: number }) {
  const start = origin.clone().addScaledVector(DIR, -1.6)
  const centre = start.clone().addScaledVector(DIR, length / 2)
  return (
    <group position={[centre.x, -CASE_H / 2, centre.z + 0.15]} rotation-y={Math.atan2(-DIR.z, DIR.x)}>
      <SteelShelf length={length} />
    </group>
  )
}

/** Soft dark blob under each case, so they read as standing on the shelf. */
const shadowTexture = (() => {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 32
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 16, 2, 64, 16, 64)
  g.addColorStop(0, 'rgba(10,10,30,0.55)')
  g.addColorStop(1, 'rgba(10,10,30,0)')
  ctx.fillStyle = g
  ctx.setTransform(1, 0, 0, 0.25, 0, 12)
  ctx.fillRect(0, -48, 128, 128)
  return new THREE.CanvasTexture(c)
})()
const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false })
const shadowGeometry = new THREE.PlaneGeometry(CASE_W * 1.3, 0.7)

interface CaseProps {
  disc: Disc
  index: number
  scroll: ScrollState
  origin: THREE.Vector3
  hidden: boolean
  playing: boolean
  onClick: (group: THREE.Group, front: boolean) => void
}

const LineCase = memo(function LineCase({ disc, index, scroll, origin, hidden, playing, onClick }: CaseProps) {
  const group = useRef<THREE.Group>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const u = index - scroll.current / LINE_STEP
    // 1 for the CD in front, easing to 0 for its neighbours.
    const front = THREE.MathUtils.smoothstep(1 - Math.abs(u), 0, 1)
    const along = u * GAP + Math.sign(u) * Math.min(1, Math.abs(u)) * SPREAD
    tmp.copy(DIR).multiplyScalar(along).add(origin).addScaledVector(POP, front)
    // The front CD bobs on the beat while music plays.
    if (playing) tmp.y += front * 0.05 * pulse()
    g.position.copy(tmp)
    g.rotation.y = THREE.MathUtils.lerp(TURN, FOCUS_TURN, front)
  })

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 8 || !group.current) return
    onClick(group.current, Math.abs(index - scroll.current / LINE_STEP) < 0.5)
  }

  return (
    <group
      ref={group}
      visible={!hidden}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation()
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <JewelCase disc={disc} />
      <mesh
        geometry={shadowGeometry}
        material={shadowMaterial}
        position={[0.05, -CASE_H / 2 + 0.004, -0.02]}
        rotation-x={-Math.PI / 2}
      />
    </group>
  )
})
