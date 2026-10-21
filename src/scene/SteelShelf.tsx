// Street theme: the brushed stainless steel shelf each row of CDs stands on. The model comes from
// blender/shelf.py; its long parts are 1 unit long and get stretched to the row's length here.
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

const MODEL = '/models/shelf.glb'
const PARTS = ['Plate', 'Rail', 'Bracket'] as const
type Part = (typeof PARTS)[number]
const BRACKET_GAP = 1.8 // between brackets along the shelf

/** Fine streaks running along the shelf, like a brushed steel finish. */
const brushed = (() => {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#c8c8c8'
  ctx.fillRect(0, 0, c.width, c.height)
  // u runs along the shelf, so streaks are horizontal rows of slightly different shades.
  for (let y = 0; y < c.height; y++) {
    const shade = 170 + Math.random() * 70
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.8)`
    ctx.fillRect(0, y, c.width, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
})()

const steel = new THREE.MeshStandardMaterial({
  color: '#d3d8de',
  metalness: 1,
  roughness: 0.22,
  roughnessMap: brushed,
  map: brushed,
})
const steelDark = new THREE.MeshStandardMaterial({ color: '#b4bac2', metalness: 1, roughness: 0.42, roughnessMap: brushed })

function useParts() {
  const { scene } = useGLTF(MODEL)
  return useMemo(() => {
    const parts = {} as Record<Part, THREE.BufferGeometry>
    scene.updateMatrixWorld(true)
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      const name = (PARTS as readonly string[]).includes(mesh.name) ? mesh.name : mesh.parent?.name
      if (mesh.isMesh && (PARTS as readonly string[]).includes(name ?? '')) {
        parts[name as Part] = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
      }
    })
    return parts
  }, [scene])
}

/** A shelf `length` long, centred on its origin along x, with its top surface at y = 0. */
export function SteelShelf({ length }: { length: number }) {
  const parts = useParts()
  const count = Math.max(2, Math.ceil(length / BRACKET_GAP))
  const brackets = Array.from({ length: count }, (_, i) => -length / 2 + 0.3 + (i * (length - 0.6)) / (count - 1))
  return (
    <group>
      <mesh geometry={parts.Plate} material={steel} scale-x={length} />
      <mesh geometry={parts.Rail} material={steelDark} scale-x={length} />
      {brackets.map((x) => (
        <mesh key={x} geometry={parts.Bracket} material={steelDark} position-x={x} />
      ))}
    </group>
  )
}

useGLTF.preload(MODEL)
