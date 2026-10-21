import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import type { Theme } from '../lib/theme'
import { CAMERA_Z } from './layout'

/** Where the camera sits for each theme. Street pulls back a little to show the skyline. */
export function cameraFor(theme: Theme, aspect = innerWidth / innerHeight) {
  if (theme === 'paper') return { z: CAMERA_Z, y: 0, fov: 40, lookY: 0 }
  // Looking down a little at the line of CDs on the roof. Phones stand back further to fit it.
  return aspect < 0.8 ? { z: 6.6, y: 1.6, fov: 50, lookY: -1.2 } : { z: 5.4, y: 0.5, fov: 44, lookY: -0.8 }
}

export function CameraRig({ theme }: { theme: Theme }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const aspect = useThree((s) => s.size.width / s.size.height)
  useEffect(() => {
    const c = cameraFor(theme, aspect)
    camera.position.set(0, c.y, c.z)
    camera.fov = c.fov
    camera.lookAt(0, c.lookY, 0)
    camera.updateProjectionMatrix()
  }, [camera, theme, aspect])
  return null
}
