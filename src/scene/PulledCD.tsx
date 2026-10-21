import { Outlines } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { pulse } from '../lib/beat'
import { colorFor, INK } from '../lib/colors'
import type { Disc } from '../types'
import { CASE_H, CASE_W } from './layout'
import { bookletTexture, discLabelTexture, spineTexture, useCover } from './textures'

export type CaseStage = 'out' | 'open' | 'returning'

interface Props {
  disc: Disc
  from: THREE.Vector3
  stage: CaseStage
  playing: boolean
  onToggleOpen: () => void
  onReturned: () => void
}

const FRONT_Z = 3.4
const LID_D = 0.035
const TRAY_D = 0.065
// Bouncy, cartoon-y spring.
const WOBBLY = { mass: 1, tension: 190, friction: 15 }

export function PulledCD({ disc, from, stage, playing, onToggleOpen, onReturned }: Props) {
  const { viewport, camera, size } = useThree()
  const cover = useCover(disc)
  const spine = useMemo(() => spineTexture(disc), [disc])
  const label = useMemo(() => discLabelTexture(disc), [disc])
  useEffect(() => () => void (spine.dispose(), label.dispose()), [spine, label])

  // Fit the open case (lid folded out to the left, about two cases wide) on any screen.
  const front = viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, FRONT_Z))
  const portrait = size.width < size.height
  const scale = Math.min(1, (front.width * 0.92) / (CASE_W * 2.05), (front.height * 0.5) / CASE_H)
  // On wide screens the song list covers the right side, so the open case moves left of center.
  const openX = portrait ? (CASE_W * scale) / 2 : -front.width * 0.12 + (CASE_W * scale) / 2
  const open = stage === 'open'
  const back = stage === 'returning'

  const home = { px: from.x, py: from.y, pz: from.z, rx: 0, ry: Math.PI / 2, s: 1 }
  const spring = useSpring({
    from: home,
    to: back
      ? home
      : {
          px: open ? openX : 0,
          py: open ? (portrait ? front.height * 0.1 : 0) : 0.15,
          pz: open && !portrait ? FRONT_Z - 0.8 : FRONT_Z,
          rx: open ? -0.08 : 0.05,
          ry: open ? 0.12 : -0.18,
          s: open && !portrait ? scale * 0.85 : scale,
        },
    config: WOBBLY,
    onRest: () => {
      if (back) onReturned()
    },
  })
  const { lid, lift } = useSpring({ lid: open ? -2.75 : 0, lift: open ? 1 : 0, config: WOBBLY })

  const discRef = useRef<THREE.Mesh>(null)
  const hostGroup = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (discRef.current) discRef.current.rotation.y += dt * (playing ? 4.5 : open ? 0.4 : 0)
    // A little squash-and-stretch on the beat while playing.
    if (hostGroup.current) {
      const p = playing ? pulse() : 0
      hostGroup.current.scale.set(1 + p * 0.03, 1 - p * 0.03, 1)
    }
  })

  const caseColor = colorFor(disc.id + disc.title)
  const booklet = useMemo(() => bookletTexture(disc), [disc])
  useEffect(() => () => booklet.dispose(), [booklet])
  const lidMaterials = useMemo(() => {
    const edge = new THREE.MeshBasicMaterial({ color: '#e9f7ff' })
    const art = new THREE.MeshBasicMaterial({ color: '#ffffff' })
    const inside = new THREE.MeshBasicMaterial({ map: booklet })
    return [edge, edge, edge, edge, art, inside]
  }, [booklet])
  useEffect(() => {
    lidMaterials[4].map = cover
    lidMaterials[4].needsUpdate = true
  }, [cover, lidMaterials])
  const spineMaterials = useMemo(() => {
    const side = new THREE.MeshBasicMaterial({ color: caseColor })
    const face = new THREE.MeshBasicMaterial({ map: spine })
    // The spine's -x face is the one that showed on the shelf.
    return [side, face, side, side, side, side]
  }, [caseColor, spine])

  return (
    <animated.group
      position-x={spring.px}
      position-y={spring.py}
      position-z={spring.pz}
      rotation-x={spring.rx}
      rotation-y={spring.ry}
      scale={spring.s}
      onClick={(e) => {
        e.stopPropagation()
        if (!back) onToggleOpen()
      }}
    >
      <group ref={hostGroup}>
        {/* Tray */}
        <mesh position={[0, 0, -TRAY_D / 2]}>
          <boxGeometry args={[CASE_W, CASE_H, TRAY_D]} />
          <meshBasicMaterial color="#2d2a3a" />
          <Outlines thickness={0.02} color={INK} />
        </mesh>
        {/* Disc */}
        <animated.group position-z={lift.to((v) => 0.01 + v * 0.18)} position-x={lift.to((v) => v * 0.08)}>
          <mesh ref={discRef} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.58, 0.58, 0.014, 64]} />
            <meshBasicMaterial attach="material-0" color="#d8d8e8" />
            <meshBasicMaterial attach="material-1" map={label} />
            <meshBasicMaterial attach="material-2" color="#c9c9da" />
            <Outlines thickness={0.015} color={INK} />
          </mesh>
        </animated.group>
        {/* Spine strip on the hinge side */}
        <mesh position={[-CASE_W / 2 - 0.01, 0, -0.01]} material={spineMaterials}>
          <boxGeometry args={[0.02, CASE_H, TRAY_D + LID_D]} />
        </mesh>
        {/* Lid hinged at the left edge, with the cover art on its front */}
        <animated.group position={[-CASE_W / 2, 0, 0.03]} rotation-y={lid}>
          <mesh position={[CASE_W / 2, 0, LID_D / 2]} material={lidMaterials}>
            <boxGeometry args={[CASE_W, CASE_H, LID_D]} />
            <Outlines thickness={0.02} color={INK} />
          </mesh>
        </animated.group>
      </group>
    </animated.group>
  )
}

