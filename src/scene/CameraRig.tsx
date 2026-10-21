import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import type { Theme } from '../lib/theme'
import { CAMERA_Z } from './layout'

/** Where the camera sits for each theme. Street pulls back a little to show the skyline. */
export function cameraFor(theme: Theme, aspect = innerWidth / innerHeight) {
  if (theme === 'paper') return { z: CAMERA_Z, y: 0, fov: 40 }
  // Phones stand back further so the rooftop and sky still show around the rack.
  return aspect < 0.8 ? { z: 10.5, y: 0.6, fov: 46 } : { z: 8.2, y: 0.3, fov: 44 }
}

export function CameraRig({ theme }: { theme: Theme }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const aspect = useThree((s) => s.size.width / s.size.height)
  useEffect(() => {
    const c = cameraFor(theme, aspect)
    camera.position.set(0, c.y, c.z)
    camera.fov = c.fov
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
  }, [camera, theme, aspect])
  return null
}
