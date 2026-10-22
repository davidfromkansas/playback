// A real-looking CD jewel case, modeled in Blender (blender/jewelcase.py): clear plastic
// shell, black tray with a toothed hub, printed spine, and the cover booklet under the lid.
import { animated, type SpringValue } from '@react-spring/three'
import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { colorFor } from '../lib/colors'
import type { Disc } from '../types'
import { CASE_W } from './layout'
import { streetSpineTexture } from './streetArt'
import { useCover } from './textures'
import { CoverMoodBadge } from './CoverMoodBadge'

const MODEL = '/models/jewelcase.glb'

/** Where the lid and booklet pivot: the left edge of the case. */
export const HINGE = new THREE.Vector3(-CASE_W / 2, 0, 0)
/** Centre of the hub the disc clips onto. */
export const HUB_X = 0.019

const BASE_PARTS = ['BaseShell', 'Tray', 'Hub', 'Inlay', 'SpineL', 'SpineR'] as const
const LID_PARTS = ['LidShell', 'Booklet', 'BookletBack'] as const
type Part = (typeof BASE_PARTS)[number] | (typeof LID_PARTS)[number]
const isPart = (name?: string): name is Part =>
  (BASE_PARTS as readonly string[]).includes(name ?? '') || (LID_PARTS as readonly string[]).includes(name ?? '')

/** The model's geometry, baked into case space (lid parts relative to the hinge). */
function useParts() {
  const { scene } = useGLTF(MODEL)
  return useMemo(() => {
    const parts = {} as Record<Part, THREE.BufferGeometry>
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      // A multi-material object exports as a group of primitives; the object name is on the parent.
      const name = isPart(mesh.name) ? mesh.name : mesh.parent?.name
      if (!isPart(name)) return
      const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
      if ((LID_PARTS as readonly string[]).includes(name)) g.translate(-HINGE.x, -HINGE.y, -HINGE.z)
      // glTF flips V on export, but our canvas and photo textures keep three's default flipY.
      if (name === 'Booklet' || name === 'BookletBack' || name === 'SpineL' || name === 'SpineR') flipV(g)
      // The inside page is seen from behind the lid, so it also needs mirroring.
      if (name === 'BookletBack') mirrorU(g)
      parts[name] = g
    })
    return parts
  }, [scene])
}

function flipV(g: THREE.BufferGeometry) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
  uv.needsUpdate = true
}

function mirrorU(g: THREE.BufferGeometry) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i))
  uv.needsUpdate = true
}

// Shared materials. The plastic is barely there: mostly glossy reflections and bright edges.
const plastic = new THREE.MeshPhysicalMaterial({
  color: '#f4fbff',
  transparent: true,
  opacity: 0.2,
  roughness: 0.05,
  metalness: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
  envMapIntensity: 2.2,
  depthWrite: false,
})
const tray = new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.32, metalness: 0.15 })
const hub = new THREE.MeshStandardMaterial({ color: '#24242c', roughness: 0.4, metalness: 0.1 })
const blank = new THREE.MeshStandardMaterial({ color: '#f1efe9', roughness: 0.85 })

interface Props {
  disc: Disc
  /** Lid angle in radians (0 = shut; negative swings it open to the left). */
  lid?: number | SpringValue<number>
  /** What's printed inside the booklet (only worth drawing when the case can open). */
  inside?: THREE.Texture
  /** Things that sit in the tray, like the disc. */
  children?: ReactNode
}

export function JewelCase({ disc, lid = 0, inside, children }: Props) {
  const parts = useParts()
  const coverBounds = useMemo(() => {
    parts.Booklet.computeBoundingBox()
    return parts.Booklet.boundingBox!
  }, [parts])
  const cover = useCover(disc)
  const mats = useMemo(() => {
    const spine = streetSpineTexture(disc)
    spine.anisotropy = 4
    return {
      // The cover is printed paper: show the art's own colours, unaffected by scene lights.
      cover: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
      inside: inside ? new THREE.MeshBasicMaterial({ map: inside, toneMapped: false }) : blank,
      inlay: new THREE.MeshStandardMaterial({ color: colorFor(disc.id + disc.title), roughness: 0.85 }),
      spine: new THREE.MeshBasicMaterial({ map: spine, toneMapped: false }),
    }
  }, [disc, inside])
  useEffect(() => {
    mats.cover.map = cover
    mats.cover.needsUpdate = true
  }, [cover, mats])
  useEffect(
    () => () => {
      mats.spine.map?.dispose()
      mats.spine.dispose()
      mats.cover.dispose()
      mats.inlay.dispose()
      if (mats.inside !== blank) mats.inside.dispose()
    },
    [mats],
  )

  return (
    <group>
      <mesh geometry={parts.Inlay} material={mats.inlay} />
      <mesh geometry={parts.SpineL} material={mats.spine} />
      <mesh geometry={parts.SpineR} material={mats.spine} />
      <mesh geometry={parts.Tray} material={tray} />
      <mesh geometry={parts.Hub} material={hub} />
      {children}
      <mesh geometry={parts.BaseShell} material={plastic} renderOrder={2} />
      <animated.group position={HINGE.toArray()} rotation-y={lid}>
        <mesh geometry={parts.Booklet} material={mats.cover} />
        <CoverMoodBadge disc={disc} right={coverBounds.max.x} bottom={coverBounds.min.y}
          z={coverBounds.max.z + 0.0005} coverWidth={coverBounds.max.x - coverBounds.min.x} />
        <mesh geometry={parts.BookletBack} material={mats.inside} />
        <mesh geometry={parts.LidShell} material={plastic} renderOrder={3} />
      </animated.group>
    </group>
  )
}

useGLTF.preload(MODEL)
