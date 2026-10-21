// Material names are the contract with blender/rooftop.py; scene lights never change with the sky.
import { Outlines, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { TimeOfDay } from '../lib/timeOfDay'
import { pulse } from '../lib/beat'
import type { Disc } from '../types'
import type { ScrollState } from './Shelf'
import { billboardAd, billboardWithCover } from './streetArt'
import { idleScreen, posterTexture, scanlines, signTexture, surfaceTexture, vendingTexture, trainGlassTexture } from './tokyoArt'

const StreetBloom = lazy(() => import('./StreetBloom'))
const MODEL = '/models/rooftop.glb'
const FLOOR_Y = -4.3
const WHITE = new THREE.Color('#ffffff')
const MOOD = {
  day: { fog: '#bfefff', tint: '#ffffff', shadow: '#8c9cdb', ramp: [100, 170, 225, 255] },
  sunset: { fog: '#efb88b', tint: '#ffe6cf', shadow: '#7d66b1', ramp: [85, 150, 215, 255] },
  night: { fog: '#242b48', tint: '#7888b5', shadow: '#656fa7', ramp: [90, 150, 210, 255] },
}
const GLOW = /^(WindowsLit|WindowsCool|NeonGlow|VendGlow|TrainWindow|TowerLight|TowerRed|TowerWhite)$/
const VERIFY = new URLSearchParams(window.location.search).has('verifyTokyo')

interface Piece {
  key: string
  name: string
  geometry: THREE.BufferGeometry
  color: THREE.Color
  role: string
  matrix: THREE.Matrix4
  far: boolean
  train: boolean
  outline: boolean
  art: 'sign' | 'poster' | 'vending' | 'billboard' | 'graffiti' | null
  index: number
}

export function StreetBackdrop({ scroll, discs, sky }: { scroll: ScrollState; discs: Disc[]; sky: TimeOfDay }) {
  const { scene: gltf } = useGLTF(MODEL, '/draco/')
  const group = useRef<THREE.Group>(null)
  const train = useRef<THREE.Group>(null)
  const { scene, gl, size, camera } = useThree()
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const compact = size.width / size.height < 0.8
  const bloom = sky === 'night' && size.width >= 800 && gl.capabilities.maxTextureSize >= 8192 && !window.matchMedia('(pointer: coarse)').matches
  const mood = MOOD[sky]
  useEffect(() => {
    const enabled = gl.shadowMap.enabled
    const type = gl.shadowMap.type
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFSoftShadowMap
    gl.shadowMap.needsUpdate = true
    return () => { gl.shadowMap.enabled = enabled; gl.shadowMap.type = type }
  }, [gl])
  const ramp = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(MOOD[sky].ramp), 4, 1, THREE.RedFormat)
    t.minFilter = t.magFilter = THREE.NearestFilter
    t.needsUpdate = true
    return t
  }, [sky])
  useEffect(() => () => ramp.dispose(), [ramp])

  useEffect(() => {
    const previous = scene.fog
    scene.fog = new THREE.Fog(mood.fog, 75, 235)
    return () => { scene.fog = previous }
  }, [scene, mood.fog])

  const pieces = useMemo(() => {
    const out: Piece[] = []
    gltf.updateMatrixWorld(true)
    gltf.traverse((o) => {
      const mesh = o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
      if (!mesh.isMesh) return
      const name = mesh.name
      const match = /^(Sign|Poster|Vend|Billboard|Graffiti)_(-?\d+)$/.exec(name)
      const role = mesh.material.name
      const geometry = mesh.geometry.clone()
      // World-sized UVs for the shared surface trim sheet; preserve authored face UVs.
      if (!match && !name.includes('Windows')) {
        const pos = geometry.attributes.position
        const normal = geometry.attributes.normal
        const uv = new Float32Array(pos.count * 2)
        for (let i = 0; i < pos.count; i++) {
          const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i))
          uv[i * 2] = (nx > ny && nx > nz ? pos.getZ(i) : pos.getX(i)) / 10
          uv[i * 2 + 1] = (ny > nz && ny > nx ? pos.getZ(i) : pos.getY(i)) / 10
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      }
      out.push({
        key: mesh.uuid, name, geometry, color: mesh.material.color.clone(), role,
        matrix: mesh.matrixWorld.clone(), far: name.startsWith('Far'),
        train: name.startsWith('Train'),
        outline: !match && !/Windows|Wires|Fence|Far|Mid|TowerLight|TrainWindow/.test(name),
        art: match ? ({ Sign: 'sign', Poster: 'poster', Vend: 'vending', Billboard: 'billboard', Graffiti: 'graffiti' } as const)[match[1] as 'Sign'] : null,
        index: match ? Number(match[2]) : 0,
      })
    })
    return out
  }, [gltf])
  useEffect(() => () => pieces.forEach((p) => p.geometry.dispose()), [pieces])

  useEffect(() => {
    if (!VERIFY) return
    const w = window as typeof window & { __tokyoCloseup?: () => void; __tokyoSigns?: () => string[] }
    w.__tokyoSigns = () => {
      const images: string[] = []
      group.current?.traverse((o) => {
        if (!o.name.startsWith('Sign_')) return
        const mesh = o as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
        const canvas = mesh.material.map?.image as HTMLCanvasElement | undefined
        if (canvas?.toDataURL) images.push(canvas.toDataURL('image/png'))
      })
      return images
    }
    w.__tokyoCloseup = () => {
      camera.position.set(14, 5, -17)
      camera.lookAt(21, 0, -31)
      camera.updateProjectionMatrix()
    }
    return () => { delete w.__tokyoCloseup; delete w.__tokyoSigns }
  }, [camera])

  // Debug data only exists on explicit verification URLs. Count actual backdrop submissions, including outlines.
  const counts = useRef({ calls: 0, triangles: 0, foreground: 0 })
  useEffect(() => {
    if (!VERIFY) return
    const previous = gl.info.autoReset
    gl.info.autoReset = false
    return () => { gl.info.autoReset = previous }
  }, [gl])
  const frames = useRef(0)
  useFrame(({ clock }) => {
    if (group.current) group.current.position.x = -scroll.current * 0.18
    if (train.current) {
      const phase = VERIFY && !new URLSearchParams(window.location.search).has('animateTrain') ? 5 : clock.elapsedTime % 26
      train.current.position.x = reducedMotion ? -34 : phase < 10 ? -95 + phase * 19 : 110
    }
    if (VERIFY && group.current) {
      const w = window as typeof window & { __tokyo?: unknown }
      if (++frames.current % 30 === 0) w.__tokyo = {
        sky, bloom, backdropCalls: gl.info.render.calls - counts.current.foreground, backdropTriangles: counts.current.triangles,
        totalCalls: gl.info.render.calls, totalTriangles: gl.info.render.triangles,
        meshes: pieces.length, trainX: train.current?.position.x,
        names: pieces.map((p) => p.name), roles: [...new Set(pieces.map((p) => p.role))],
      }
      counts.current = { calls: 0, triangles: 0, foreground: 0 }
      gl.info.reset()
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (mesh.isMesh) mesh.onBeforeRender = () => { counts.current.foreground++ }
      })
      group.current.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.onBeforeRender = () => {
          counts.current.calls++
          counts.current.triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3
        }
      })
    }
  })
  const withArt = useMemo(() => discs.filter((d) => d.imageUrl && d.kind === 'album'), [discs])
  const renderPiece = (p: Piece) => p.art === 'billboard'
    ? <Billboard key={p.key} piece={p} discs={withArt} />
    : <CityPiece key={p.key} piece={p} sky={sky} ramp={ramp} reducedMotion={reducedMotion || VERIFY} compact={compact} />

  return (
    <>
      <group ref={group} position-y={FLOOR_Y} name="TokyoBackdrop">
        <ambientLight intensity={1.1} />
        <directionalLight position={[-20, 40, 30]} intensity={2.2} />
        {/* A shadow-only light lets the city sunset change without relighting the CDs. */}
        <directionalLight position={sky === 'sunset' ? [-40, 28, -55] : [-20, 40, 30]} intensity={0} castShadow
          shadow-mapSize={[Math.min(8192, gl.capabilities.maxTextureSize), Math.min(8192, gl.capabilities.maxTextureSize)]} shadow-camera-left={-80} shadow-camera-right={80}
          shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-near={1} shadow-camera-far={260}
          shadow-normalBias={0.05} shadow-bias={-0.0002} />
        {pieces.filter((p) => !p.train && !p.name.startsWith('Tower')).map(renderPiece)}
        <group position={[compact ? 48 : 0, compact ? -6 : 0, 0]}>
          {pieces.filter((p) => p.name.startsWith('Tower')).map(renderPiece)}
        </group>
        <group ref={train} name="PassingTrain">{pieces.filter((p) => p.train).map(renderPiece)}</group>
      </group>
      {bloom && (
        <Suspense fallback={null}><StreetBloom backdrop={group} /></Suspense>
      )}
    </>
  )
}

function CityPiece({ piece: p, sky, ramp, reducedMotion, compact }: {
  piece: Piece; sky: TimeOfDay; ramp: THREE.DataTexture; reducedMotion: boolean; compact: boolean
}) {
  const glow = GLOW.test(p.role)
  const unlit = p.art === 'sign' || p.art === 'vending' || (sky === 'night' && glow)
  const material = useMemo(() => {
    const color = (p.role === 'Floor' ? WHITE : p.role === 'Windows' ? new THREE.Color('#a4b8cc') : p.color).clone().multiply(new THREE.Color(MOOD[sky].tint))
    if (sky !== 'night' && (p.role === 'TrainWindow' || p.role === 'TowerLight')) color.set('#284b64')
    if (sky === 'day' && /^Windows(Lit|Cool)$/.test(p.role)) color.set(p.role === 'WindowsLit' ? '#b0ad85' : '#829cae')
    if (p.far) color.lerp(new THREE.Color(MOOD[sky].fog), 0.24)
    if (unlit) return new THREE.MeshBasicMaterial({ color: p.art ? '#ffffff' : p.color, vertexColors: !!p.geometry.attributes.color, toneMapped: false })
    const m = new THREE.MeshToonMaterial({ color: p.art ? '#ffffff' : color, gradientMap: ramp,
      vertexColors: !!p.geometry.attributes.color })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.cityLight = { value: new THREE.Color(sky === 'sunset' ? '#ffd28a' : '#ffffff') }
      shader.uniforms.cityNight = { value: sky === 'night' ? 1 : 0 }
      shader.vertexShader = 'varying vec3 cityPosition;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncityPosition = position;')
      shader.uniforms.cityShadow = { value: new THREE.Color(MOOD[sky].shadow) }
      shader.uniforms.cityBands = { value: new THREE.Vector4().fromArray(MOOD[sky].ramp.map((v) => v / 255)) }
      shader.fragmentShader = 'varying vec3 cityPosition;\nuniform float cityNight;\nuniform vec3 cityShadow;\nuniform vec3 cityLight;\nuniform vec4 cityBands;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float cityRim = pow(1.0 - max(dot(normalize(vViewPosition), normal), 0.0), 3.0);
        float cityKey = dot(normal, normalize(vec3(-0.7, 1.0, 0.5)));
        float cityBand = cityKey > 0.65 ? cityBands.w : cityKey > 0.2 ? cityBands.z : cityKey > -0.3 ? cityBands.y : cityBands.x;
        cityBand = mix(cityBands.x, cityBand, getShadowMask());
        outgoingLight = diffuseColor.rgb * mix(cityShadow, cityLight, smoothstep(0.4, 0.95, cityBand)) * (0.5 + cityBand * 0.8);
        outgoingLight += diffuseColor.rgb * cityRim * 0.07;
        float cyanPool = exp(-length((cityPosition - vec3(-11.0, 0.8, -28.0)) * vec3(0.28, 0.65, 0.25)));
        float pinkPool = exp(-length((cityPosition - vec3(-14.0, 0.8, -28.0)) * vec3(0.3, 0.65, 0.25)));
        outgoingLight += cityNight * (vec3(0.05, 0.65, 0.8) * cyanPool + vec3(0.7, 0.03, 0.25) * pinkPool) * 0.65 * smoothstep(0.5, 0.9, normal.y);
        #include <opaque_fragment>
      `)
    }
    m.customProgramCacheKey = () => 'tokyo-' + sky
    return m
  }, [p, sky, ramp, unlit])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    let alive = true
    let tex: THREE.Texture | undefined
    const promise = p.art === 'sign' ? signTexture(p.index)
      : p.art === 'poster' ? posterTexture(p.index)
        : p.art === 'graffiti' ? surfaceTexture(1)
        : p.art === 'vending' ? Promise.resolve(vendingTexture())
          : p.role === 'TrainWindow' ? Promise.resolve(trainGlassTexture())
          : p.role === 'Floor' ? surfaceTexture(3)
            : p.role === 'Windows' ? surfaceTexture(2)
              : /Building|Concrete|Ramp/.test(p.role) ? surfaceTexture(0) : null
    promise?.then((t) => {
      if (!alive) return t.dispose()
      tex = t
      if (!p.art && p.role !== 'Windows' && p.role !== 'TrainWindow') t.wrapS = t.wrapT = THREE.RepeatWrapping
      material.map = t
      material.needsUpdate = true
    }).catch(() => { /* A failed decal leaves its colored panel readable. */ })
    return () => { alive = false; tex?.dispose() }
  }, [p, material])

  useFrame(({ clock }) => {
    if (!unlit) return
    const breathing = reducedMotion ? 0 : pulse() * 0.06
    const flicker = !reducedMotion && p.art === 'sign' && Math.sin(clock.elapsedTime * 0.7 + p.index * 13) > 0.998 ? 0.82 : 1
    const strength = sky === 'night' ? (p.art === 'sign' ? 2.2 : p.art ? 1.3 : 1.1) + breathing : sky === 'sunset' ? 0.85 : 0.72
    material.color.copy(p.art ? WHITE : p.color).multiplyScalar(strength * flicker)
    if (sky === 'night' && p.role === 'TowerRed') material.color.multiplyScalar(2.2)
    if (sky === 'night' && p.role === 'TowerLight') material.color.multiplyScalar(reducedMotion || Math.sin(clock.elapsedTime * 2) > -0.75 ? 1.5 : 0.65)
  })
  return (
    <mesh name={p.name} geometry={p.geometry} material={material} matrix={p.matrix} matrixAutoUpdate={false}
      castShadow={!p.art && !p.name.includes('Windows')} receiveShadow={!unlit}>
      {p.outline && (!compact || (!p.name.startsWith('Mid') && p.role !== 'Metal')) && <Outlines thickness={p.name.startsWith('Mid') ? 0.035 : 0.055} color="#172336" />}
    </mesh>
  )
}

function Billboard({ piece, discs }: { piece: Piece; discs: Disc[] }) {
  const [cycle, setCycle] = useState(0)
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false, toneMapped: false }), [])
  useEffect(() => {
    const timer = window.setInterval(() => setCycle((c) => c + 1), 12_000)
    return () => window.clearInterval(timer)
  }, [])
  const disc = discs.length && cycle % 3 !== 2 ? discs[(piece.index * 7 + cycle) % discs.length] : undefined
  useEffect(() => {
    let alive = true
    let tex = scanlines(billboardAd(piece.index))
    tex.flipY = false
    material.map = tex
    material.needsUpdate = true
    const promise = disc?.imageUrl ? billboardWithCover(disc, piece.index).then((t) => {
      t.flipY = false
      return scanlines(t)
    }) : idleScreen(piece.index + cycle)
    promise.then((t) => {
      if (!alive) return t.dispose()
      tex.dispose()
      tex = t
      material.map = tex
      material.needsUpdate = true
    }).catch(() => undefined)
    return () => { alive = false; tex.dispose() }
  }, [disc, piece.index, cycle, material])
  useEffect(() => () => material.dispose(), [material])
  return <mesh geometry={piece.geometry} material={material} matrix={piece.matrix} matrixAutoUpdate={false} />
}

useGLTF.preload(MODEL, '/draco/')
