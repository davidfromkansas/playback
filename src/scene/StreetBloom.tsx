import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, type RefObject } from 'react'
import * as THREE from 'three'

// Composite the city first, then draw the CDs normally. Postprocessing must never touch cover art.
export default function StreetBloom({ backdrop }: { backdrop: RefObject<THREE.Group | null> }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    const root = backdrop.current
    root?.traverse((o) => {
      o.layers.set(1)
      if ((o as THREE.Light).isLight) o.layers.enable(0)
    })
    return () => {
      root?.traverse((o) => o.layers.set(0))
      camera.layers.set(0)
    }
  }, [backdrop, camera])
  useFrame(() => { camera.layers.set(1) }, 0.5)
  useFrame(() => {
    camera.layers.set(0)
    const autoClear = gl.autoClear
    const toneMapping = gl.toneMapping
    gl.autoClear = false
    gl.clearDepth()
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.render(scene, camera)
    gl.toneMapping = toneMapping
    gl.autoClear = autoClear
  }, 2)
  return (
    <EffectComposer multisampling={Math.min(4, gl.capabilities.maxSamples)}>
      <Bloom luminanceThreshold={0.35} luminanceSmoothing={0.15} intensity={0.25} />
    </EffectComposer>
  )
}
