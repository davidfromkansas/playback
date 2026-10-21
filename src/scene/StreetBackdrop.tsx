// The Street theme's world: a rooftop skate spot over a city skyline, modeled in Blender
// (see blender/rooftop.py) and drawn with toon shading and thick ink outlines.
import { Outlines, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { INK } from '../lib/colors'
import type { Disc } from '../types'
import { LINE_FLOOR_Y } from './CaseLine'
import type { ScrollState } from './Shelf'
import { billboardAd, billboardWithCover } from './streetArt'

const MODEL = '/models/rooftop.glb'

// Three flat bands of light: the classic cel-shaded look.
const toonRamp = (() => {
  const data = new Uint8Array([90, 170, 255])
  const t = new THREE.DataTexture(data, 3, 1, THREE.RedFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter
  t.needsUpdate = true
  return t
})()

function toonMaterial(color: THREE.ColorRepresentation, map?: THREE.Texture | null) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, map: map ?? null })
}

interface Piece {
  key: string
  geometry: THREE.BufferGeometry
  material: THREE.Material
  matrix: THREE.Matrix4
  billboard: number | null
  far: boolean
}

export function StreetBackdrop({ scroll, discs }: { scroll: ScrollState; discs: Disc[] }) {
  const { scene: gltf } = useGLTF(MODEL)
  const group = useRef<THREE.Group>(null)
  const { scene } = useThree()

  // Haze the far city into the sky color, like a hot summer afternoon.
  useEffect(() => {
    scene.fog = new THREE.Fog('#bfefff', 70, 210)
    return () => {
      scene.fog = null
    }
  }, [scene])

  const pieces = useMemo(() => {
    const out: Piece[] = []
    gltf.updateMatrixWorld(true)
    gltf.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      const src = mesh.material as THREE.MeshStandardMaterial
      // The mesh or its parent carries the Blender object name.
      const name = mesh.name.startsWith('Billboard_') ? mesh.name : (mesh.parent?.name ?? '')
      const bb = /^Billboard_(\d+)$/.exec(mesh.name) ?? /^Billboard_(\d+)$/.exec(name)
      out.push({
        key: mesh.uuid,
        geometry: mesh.geometry,
        material: toonMaterial(src.color),
        matrix: mesh.matrixWorld.clone(),
        billboard: bb ? Number(bb[1]) : null,
        far: name === 'City' || mesh.name === 'City',
      })
    })
    return out
  }, [gltf])

  // Billboards show covers from the library (or a Playback FM ad).
  const withArt = useMemo(() => discs.filter((d) => d.imageUrl && d.kind === 'album'), [discs])
  const pick = (i: number) => withArt[(i * 7) % Math.max(1, withArt.length)]

  useFrame(() => {
    // Gentle parallax: the city drifts slower than the shelf as you scroll.
    if (group.current) group.current.position.x = -scroll.current * 0.18
  })

  return (
    <group ref={group} position-y={LINE_FLOOR_Y}>
      <ambientLight intensity={1.1} />
      <directionalLight position={[-20, 40, 30]} intensity={2.2} />
      {pieces.map((p) =>
        p.billboard !== null ? (
          <Billboard key={p.key} piece={p} disc={pick(p.billboard)} index={p.billboard} />
        ) : (
          <mesh key={p.key} geometry={p.geometry} material={p.material} matrix={p.matrix} matrixAutoUpdate={false}>
            <Outlines thickness={p.far ? 0.25 : 0.08} color={INK} />
          </mesh>
        ),
      )}
    </group>
  )
}

function Billboard({ piece, disc, index }: { piece: Piece; disc?: Disc; index: number }) {
  // Billboards light themselves, so the art reads at full brightness.
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false }), [])
  useEffect(() => {
    let alive = true
    // The billboard planes' UVs run bottom to top, so flip the art to read correctly.
    const unmirror = (t: THREE.Texture) => {
      t.flipY = !t.flipY
      t.needsUpdate = true
      return t
    }
    let tex = unmirror(billboardAd(index))
    material.map = tex
    material.needsUpdate = true
    if (disc?.imageUrl) {
      billboardWithCover(disc, index).then((t) => {
        if (!alive) return t.dispose()
        tex.dispose()
        tex = unmirror(t)
        material.map = tex
        material.needsUpdate = true
      }, () => undefined)
    }
    return () => {
      alive = false
      tex.dispose()
    }
  }, [disc, index, material])
  useEffect(() => () => material.dispose(), [material])
  return <mesh geometry={piece.geometry} material={material} matrix={piece.matrix} matrixAutoUpdate={false} />
}

useGLTF.preload(MODEL)
