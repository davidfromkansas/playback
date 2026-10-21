// Street theme: the library as one long line of jewel cases standing on the roof, angled so
// you see their covers. Swipe (or scroll) along the line; the CD in front slides out.
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { pulse } from '../lib/beat'
import type { Disc } from '../types'
import { JewelCase } from './JewelCase'
import { CASE_H, CASE_W, LINE_STEP } from './layout'
import type { ScrollState } from './Shelf'

/** Where the line stands: the roof surface, in world space. */
export const LINE_FLOOR_Y = -1.75

// The line runs to the right and away from the camera; each case is turned to face front-left.
// On a tall phone screen it heads further back, so it climbs up the screen instead of across.
const LAYOUTS = {
  wide: {
    dir: new THREE.Vector3(0.78, 0, -0.62).normalize(),
    pop: new THREE.Vector3(0.35, 0.06, 0.9), // how far the CD in front slides out
    origin: new THREE.Vector3(-0.75, LINE_FLOOR_Y + CASE_H / 2, 0),
  },
  tall: {
    dir: new THREE.Vector3(0.4, 0, -0.92).normalize(),
    pop: new THREE.Vector3(0.7, 0.06, 0.65),
    origin: new THREE.Vector3(-0.35, LINE_FLOOR_Y + CASE_H / 2, 0),
  },
}
type Layout = (typeof LAYOUTS)['wide']
const GAP = 0.42 // between neighbouring cases
const SPREAD = 0.6 // extra room either side of the CD in front
const TURN = -0.95 // how far each case is turned
const FOCUS_TURN = -0.28
const BEHIND = 6 // cases drawn before the one in front
const AHEAD = 16 // and after it

interface Props {
  discs: Disc[]
  scroll: ScrollState
  selectedId: string | null
  playing: boolean
  onPick: (disc: Disc, from: THREE.Vector3, fromRy: number) => void
  onFocus: (disc: Disc | null) => void
}

export function CaseLine({ discs, scroll, selectedId, playing, onPick, onFocus }: Props) {
  const max = Math.max(0, (discs.length - 1) * LINE_STEP)
  scroll.max = max
  const [focus, setFocus] = useState(0)
  const idle = useRef({ last: NaN, time: 0 })
  const layout = useThree((s) => (s.size.width < s.size.height * 0.8 ? LAYOUTS.tall : LAYOUTS.wide))

  useEffect(() => {
    onFocus(discs[focus] ?? null)
  }, [discs, focus, onFocus])

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
  const visible = discs.slice(start, focus + AHEAD)

  return (
    <group>
      {visible.map((disc, i) => (
        <LineCase
          key={disc.id}
          disc={disc}
          index={start + i}
          scroll={scroll}
          hidden={disc.id === selectedId}
          playing={playing}
          layout={layout}
          onPick={onPick}
        />
      ))}
    </group>
  )
}

/** Soft dark blob under each case, so they read as standing on the roof. */
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
  hidden: boolean
  playing: boolean
  layout: Layout
  onPick: Props['onPick']
}

const LineCase = memo(function LineCase({ disc, index, scroll, hidden, playing, layout, onPick }: CaseProps) {
  const group = useRef<THREE.Group>(null)
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const u = index - scroll.current / LINE_STEP
    // 1 for the CD in front, easing to 0 for its neighbours.
    const front = THREE.MathUtils.smoothstep(1 - Math.abs(u), 0, 1)
    const along = u * GAP + Math.sign(u) * Math.min(1, Math.abs(u)) * SPREAD
    tmp.copy(layout.dir).multiplyScalar(along).add(layout.origin).addScaledVector(layout.pop, front)
    // The front CD bobs on the beat while music plays.
    if (playing) tmp.y += front * 0.05 * pulse()
    g.position.copy(tmp)
    g.rotation.y = THREE.MathUtils.lerp(TURN, FOCUS_TURN, front)
  })

  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 8 || !group.current) return
    const front = Math.abs(index - scroll.current / LINE_STEP) < 0.5
    // Tapping the CD in front pulls it out; tapping another one brings it to the front.
    if (front) onPick(disc, group.current.getWorldPosition(new THREE.Vector3()), group.current.rotation.y)
    else scroll.target = index * LINE_STEP
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
