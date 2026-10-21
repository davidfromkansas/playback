import { Outlines } from '@react-three/drei'
import { animated, useSpring } from '@react-spring/three'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { pulse } from '../lib/beat'
import { colorFor, INK } from '../lib/colors'
import type { Disc } from '../types'
import { CASE_H, CASE_W } from './layout'
import { Disc3D } from './Disc3D'
import { HUB_X, JewelCase } from './JewelCase'
import type { Theme } from '../lib/theme'
import { useLyricsPage } from './lyricsPage'
import { spineTexture, useCover } from './textures'

export type CaseStage = 'out' | 'open' | 'returning'

interface Props {
  disc: Disc
  from: THREE.Vector3
  /** The case's turn where it came from (spines on the shelf face the camera side-on). */
  fromRy?: number
  stage: CaseStage
  theme: Theme
  playing: boolean
  /** Cover of the song playing from this CD, if any. */
  songArtUrl?: string
  onToggleOpen: () => void
  onReturned: () => void
}

const FRONT_Z = 3.4
const LID_D = 0.035
const TRAY_D = 0.065
// Bouncy, cartoon-y spring.
const WOBBLY = { mass: 1, tension: 190, friction: 15 }

export function PulledCD({
  disc,
  from,
  fromRy = Math.PI / 2,
  stage,
  theme,
  playing,
  songArtUrl,
  onToggleOpen,
  onReturned,
}: Props) {
  const { viewport, camera, size } = useThree()
  const cover = useCover(disc)
  const spine = useMemo(() => spineTexture(disc), [disc])
  useEffect(() => () => spine.dispose(), [spine])

  // Fit the open case (lid folded out to the left, about two cases wide) on any screen.
  const front = viewport.getCurrentViewport(camera, new THREE.Vector3(0, 0, FRONT_Z))
  const portrait = size.width < size.height
  // Height where the camera's line of sight crosses FRONT_Z (0 unless the camera looks up or down).
  const fwd = camera.getWorldDirection(new THREE.Vector3())
  const midY = camera.position.y + ((FRONT_Z - camera.position.z) * fwd.y) / fwd.z
  const scale = Math.min(1, (front.width * 0.92) / (CASE_W * 2.05), (front.height * 0.5) / CASE_H)
  // On wide screens the song list covers the right side, so the open case moves left of center.
  const openX = portrait ? (CASE_W * scale) / 2 : -front.width * 0.12 + (CASE_W * scale) / 2
  const open = stage === 'open'
  const back = stage === 'returning'

  const home = { px: from.x, py: from.y, pz: from.z, rx: 0, ry: fromRy, s: 1 }
  const spring = useSpring({
    from: home,
    to: back
      ? home
      : {
          px: open ? openX : 0,
          py: midY + (open ? (portrait ? front.height * 0.1 : 0) : 0.15),
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

  const hostGroup = useRef<THREE.Group>(null)
  useFrame(() => {
    // A little squash-and-stretch on the beat while playing.
    if (hostGroup.current) {
      const p = playing ? pulse() : 0
      hostGroup.current.scale.set(1 + p * 0.03, 1 - p * 0.03, 1)
    }
  })

  const caseColor = colorFor(disc.id + disc.title)
  // Inside the booklet: the lyrics of the song playing. Street's booklet is square; Paper's fills the lid.
  const booklet = useLyricsPage(disc, 640, theme === 'street' ? 640 : 563)
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
        {theme === 'street' ? (
          <JewelCase disc={disc} lid={lid} inside={booklet}>
            {/* The disc only needs drawing once the lid starts to open. */}
            <animated.group
              visible={lift.to((v) => v > 0.01)}
              position-x={HUB_X}
              position-z={lift.to((v) => -0.008 + v * 0.03)}
            >
              <Disc3D disc={disc} artUrl={songArtUrl ?? disc.imageUrl} spin={playing ? 0.9 : open ? 0.05 : 0} />
            </animated.group>
          </JewelCase>
        ) : (
          <>
            {/* Tray */}
            <mesh position={[0, 0, -TRAY_D / 2]}>
              <boxGeometry args={[CASE_W, CASE_H, TRAY_D]} />
              <meshBasicMaterial color="#2d2a3a" />
              <Outlines thickness={0.02} color={INK} />
            </mesh>
            {/* Spindle the disc clips onto */}
            <mesh position={[0, 0, 0.004]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.11, 0.11, 0.01, 32]} />
              <meshBasicMaterial color="#4a4560" />
            </mesh>
            {/* Disc */}
            <animated.group position-z={lift.to((v) => 0.01 + v * 0.18)} position-x={lift.to((v) => v * 0.08)}>
              <Disc3D disc={disc} artUrl={songArtUrl ?? disc.imageUrl} spin={playing ? 0.9 : open ? 0.05 : 0} />
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
          </>
        )}
      </group>
    </animated.group>
  )
}
