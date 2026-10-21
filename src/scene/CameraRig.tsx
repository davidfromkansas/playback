import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import type { Theme } from '../lib/theme'
import { CAMERA_Z } from './layout'

/** Where the camera sits for each theme. Street pulls back a little to show the skyline. */
export function cameraFor(theme: Theme, aspect = innerWidth / innerHeight) {
  if (theme === 'paper') return { z: CAMERA_Z, y: 0, fov: 40, lookY: 0 }
  // Looking straight at the row you're on, with the rows above and below peeking in. Phones stand back further.
  return aspect < 0.8 ? { z: 7.8, y: 0.9, fov: 52, lookY: -0.4 } : { z: 6.6, y: 0.8, fov: 46, lookY: -0.1 }
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
