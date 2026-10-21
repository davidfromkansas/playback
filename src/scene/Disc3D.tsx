// A shiny, realistic CD: printed face (cover art or a bright design), a mirror band,
// a clear plastic hub with a real hole, and a rainbow sheen that shifts as it moves.
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { INK } from '../lib/colors'
import type { Disc } from '../types'
import { discPrint, discStyle } from './discArt'
import { useArt } from './textures'

// Real CD proportions: 120 mm across, 15 mm hole, clear hub to ~34 mm, mirror band to ~46 mm.
export const DISC_R = 0.58
const HOLE = 0.075
const HUB = 0.165
const BAND = 0.225
const THICK = 0.012
const SEG = 128

/** Gives shiny materials something to reflect. Mount once inside the Canvas. */
export function DiscLighting() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
    scene.environment = env
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return <directionalLight position={[2, 3, 5]} intensity={1.2} />
}

interface Props {
  disc: Disc
  /** Art to print on the disc; the current song's cover while it plays. */
  artUrl?: string
  /** Turns per second. */
  spin: number
}

export function Disc3D({ disc, artUrl, spin }: Props) {
  const spinner = useRef<THREE.Group>(null)
  const art = useArt(artUrl, () => discPrint(disc), disc.id)
  const tinted = !artUrl && discStyle(disc) === 'tint'

  const geo = useMemo(
    () => ({
      print: new THREE.RingGeometry(BAND, DISC_R, SEG, 1),
      band: new THREE.RingGeometry(HUB, BAND, SEG, 1),
      hub: new THREE.RingGeometry(HOLE, HUB, SEG, 1),
      stack: new THREE.RingGeometry(0.128, 0.138, SEG, 1),
      back: new THREE.RingGeometry(HOLE, DISC_R, SEG, 1),
      rim: new THREE.CylinderGeometry(DISC_R, DISC_R, THICK, SEG, 1, true),
      holeWall: new THREE.CylinderGeometry(HOLE, HOLE, THICK, 48, 1, true),
      outline: new THREE.RingGeometry(DISC_R, DISC_R + 0.012, SEG, 1),
      holeLine: new THREE.RingGeometry(HOLE - 0.008, HOLE, 48, 1),
    }),
    [],
  )
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo])

  // RingGeometry maps the square texture across the whole disc, so the print lines up with the hole.
  const printMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        roughness: 0.3,
        metalness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        iridescence: 0.35,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [200, 800],
      }),
    [],
  )
  useEffect(() => {
    printMat.map = art
    // Blank colored CD-Rs are dyed metal; printed discs are matte ink under gloss.
    printMat.metalness = tinted ? 0.75 : 0.05
    printMat.roughness = tinted ? 0.18 : 0.3
    printMat.iridescence = tinted ? 1 : 0.35
    printMat.needsUpdate = true
  }, [art, tinted, printMat])

  const mats = useMemo(
    () => ({
      mirror: new THREE.MeshPhysicalMaterial({
        color: '#e9edf5',
        metalness: 1,
        roughness: 0.12,
        iridescence: 1,
        iridescenceIOR: 1.8,
        iridescenceThicknessRange: [250, 900],
      }),
      clear: new THREE.MeshPhysicalMaterial({
        color: '#eaf7ff',
        metalness: 0,
        roughness: 0.05,
        clearcoat: 1,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      }),
      stack: new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.2, transparent: true, opacity: 0.7 }),
      back: new THREE.MeshPhysicalMaterial({
        color: '#dfe4ee',
        metalness: 1,
        roughness: 0.1,
        iridescence: 1,
        iridescenceThicknessRange: [300, 1000],
        side: THREE.BackSide,
      }),
      rim: new THREE.MeshStandardMaterial({ color: '#c9ced8', metalness: 1, roughness: 0.25 }),
      ink: new THREE.MeshBasicMaterial({ color: INK }),
    }),
    [],
  )
  useEffect(() => () => [printMat, ...Object.values(mats)].forEach((m) => m.dispose()), [printMat, mats])

  useFrame((state, dt) => {
    const g = spinner.current
    if (!g) return
    g.rotation.z -= dt * spin * Math.PI * 2
    // A slight wobble catches the light so the rainbow sheen shimmers.
    const t = state.clock.elapsedTime
    g.parent!.rotation.x = Math.sin(t * 0.9) * 0.06
    g.parent!.rotation.y = Math.cos(t * 0.7) * 0.06
  })

  const top = THICK / 2
  return (
    <group>
      <group ref={spinner}>
        <mesh geometry={geo.print} material={printMat} position-z={top} />
        <mesh geometry={geo.band} material={mats.mirror} position-z={top} />
        <mesh geometry={geo.hub} material={mats.clear} position-z={top} />
        <mesh geometry={geo.stack} material={mats.stack} position-z={top + 0.001} />
        <mesh geometry={geo.back} material={mats.back} position-z={-top} />
        <mesh geometry={geo.rim} material={mats.rim} rotation-x={Math.PI / 2} />
        <mesh geometry={geo.holeWall} material={mats.clear} rotation-x={Math.PI / 2} />
        {/* Thin ink edges keep it in the paper-cutout style. */}
        <mesh geometry={geo.outline} material={mats.ink} position-z={top + 0.001} />
        <mesh geometry={geo.holeLine} material={mats.ink} position-z={top + 0.001} />
      </group>
    </group>
  )
}
