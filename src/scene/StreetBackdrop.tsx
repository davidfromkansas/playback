// Material names are the contract with blender/rooftop.py; scene lights never change with the sky.
import { Outlines, useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { TimeOfDay } from '../lib/timeOfDay'
import { pulse } from '../lib/beat'
import { renderBudget } from '../lib/renderBudget'
import type { Disc } from '../types'
import type { ScrollState } from './Shelf'
import { billboardAd, billboardWithCover } from './streetArt'
import { idleScreen, posterTexture, scanlines, signTexture, surfaceTexture, vendingTexture, trainGlassTexture, rampTexture, roofMetalTexture } from './tokyoArt'

const StreetBloom = lazy(() => import('./StreetBloom'))
const MODEL = '/models/rooftop.glb'
const FLOOR_Y = -4.3
const WHITE = new THREE.Color('#ffffff')
// Stable 25-sample PCF keeps cel-shadow borders clean instead of dithering five taps per pixel.
const CITY_SHADOW_CHUNK = THREE.ShaderChunk.shadowmap_pars_fragment.replace(
  /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord.xy \+ vogelDiskSample\( 0, 5, phi \)[\s\S]*?\) \* 0.2;/,
  `shadow = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      shadow += texture(shadowMap, vec3(shadowCoord.xy + vec2(float(x), float(y)) * radius * 0.5, shadowCoord.z));
    }
  }
  shadow *= 0.04;`,
)
const MOOD = {
  day: { fog: '#70c5ed', tint: '#ffffff', shadow: '#526988', ramp: [100, 170, 225, 255] },
  sunset: { fog: '#ffad82', tint: '#ffffff', shadow: '#514363', ramp: [85, 150, 215, 255] },
  night: { fog: '#172456', tint: '#ffffff', shadow: '#182654', ramp: [90, 150, 210, 255] },
}
const PALETTE: Record<TimeOfDay, Record<string, string>> = {
  day: {
    Floor: '#fff8ed', Concrete: '#e4d5ae', BuildingA: '#f2dfb0', BuildingB: '#80b9d6',
    BuildingC: '#829fc9', BuildingD: '#e5c789', Metal: '#263e5a', Windows: '#13617d',
    Red: '#ef2448', Blue: '#185ce0', Tank: '#b4ced9', TrainStripe: '#35b62b',
  },
  sunset: {
    Ramp: '#cbb0c1', RoadPaint: '#f6ad39', FloorSeam: '#ad827d', Floor: '#f7aa89', Concrete: '#ac8ba0', BuildingA: '#af98af', BuildingB: '#6974a1',
    BuildingC: '#786a95', BuildingD: '#b68da0', Metal: '#343451', Windows: '#30445f',
    Red: '#eb2846', Blue: '#255bd3', Tank: '#8d83a1', TrainBody: '#b7a8af', Trim: '#ffb34d',
  },
  night: {
    Ramp: '#446ca2', RoadPaint: '#997d24', FloorSeam: '#273a65', Floor: '#284d9c', Concrete: '#294778', BuildingA: '#304e88', BuildingB: '#204478',
    BuildingC: '#26376f', BuildingD: '#354974', Metal: '#17284d', Windows: '#081b3d',
    Red: '#b91449', Blue: '#1249b5', Tank: '#263e74', TrainBody: '#294881', Trim: '#b98535',
  },
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
  const [budget] = useState(renderBudget)
  const shadowLight = useRef<THREE.DirectionalLight>(null)
  const shadowSize = Math.min(budget.shadowSize, gl.capabilities.maxTextureSize)
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const compact = size.width / size.height < 0.8
  const bloom = sky === 'night' && size.width >= 800 && gl.capabilities.maxTextureSize >= 8192 && !window.matchMedia('(pointer: coarse)').matches
  const mood = MOOD[sky]
  useEffect(() => {
    const enabled = gl.shadowMap.enabled
    const type = gl.shadowMap.type
    gl.shadowMap.enabled = true
    gl.shadowMap.type = THREE.PCFShadowMap
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
    scene.fog = new THREE.Fog(mood.fog, 115, 300)
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
      // Keep a tower gap in the narrow crop while retaining the desktop skyline.
      if (compact && name.startsWith('Mid')) {
        const positions = geometry.attributes.position
        for (let i = 0; i < positions.count; i++) {
          if (positions.getX(i) > 8 && positions.getX(i) < 22 && positions.getZ(i) < -80 && positions.getZ(i) > -105) {
            positions.setY(i, -24 + (positions.getY(i) + 24) * 0.62)
          }
        }
        positions.needsUpdate = true
        geometry.computeBoundingSphere()
      }
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
        if (role === 'Ramp') {
          for (let i = 0; i < pos.count; i++) {
            const side = Math.abs(normal.getZ(i)) > 0.8
            uv[i * 2] = (side ? 0 : 0.5) + (pos.getX(i) + 16) / 13
            uv[i * 2 + 1] = side ? 1 - pos.getY(i) / 4 : (-pos.getZ(i) - 16) / 5
          }
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
      }
      out.push({
        key: mesh.uuid, name, geometry, color: mesh.material.color.clone(), role,
        matrix: mesh.matrixWorld.clone(), far: name.startsWith('Far'),
        train: name.startsWith('Train'),
        outline: !match && !/Windows|Wires|Fence|Far|TowerLight|TrainWindow|RoadPaint|FloorSeam|RoofCrack|Blinds|EdgeLight/.test(name),
        art: match ? ({ Sign: 'sign', Poster: 'poster', Vend: 'vending', Billboard: 'billboard', Graffiti: 'graffiti' } as const)[match[1] as 'Sign'] : null,
        index: match ? Number(match[2]) : 0,
      })
    })
    return out
  }, [gltf, compact])
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
      train.current.position.z = -train.current.position.x * 0.11
      train.current.position.y = train.current.position.x * 0.065
    }
    if (VERIFY && group.current) {
      const w = window as typeof window & { __tokyo?: unknown }
      if (++frames.current % 30 === 0) w.__tokyo = {
        sky, bloom, pixelRatio: gl.getPixelRatio(),
        shadowSize: shadowLight.current?.shadow.map?.width,
        textures: gl.info.memory.textures,
        backdropCalls: gl.info.render.calls - counts.current.foreground, backdropTriangles: counts.current.triangles,
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
        <directionalLight ref={shadowLight} position={sky === 'sunset' ? [-50, 40, 20] : [-40, 65, 30]} intensity={0} castShadow
          shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={-60} shadow-camera-right={60}
          shadow-camera-top={75} shadow-camera-bottom={-75} shadow-camera-near={1} shadow-camera-far={260}
          shadow-normalBias={0.012} shadow-bias={-0.00005} />
        {pieces.filter((p) => !p.train && !p.name.startsWith('Tower')).map(renderPiece)}
        <group position={[compact ? 44 : 0, compact ? -6 : 0, 0]}>
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
  const unlit = p.art === 'sign' || p.art === 'vending' || (sky !== 'day' && glow && !/^Tower/.test(p.role)) || (sky === 'night' && glow)
  const material = useMemo(() => {
    const color = PALETTE[sky][p.role] ? new THREE.Color(PALETTE[sky][p.role]) : p.color.clone()
    if (p.role === 'Blinds') color.set(PALETTE[sky].BuildingC)
    if (p.role === 'EdgeLight') color.set(sky === 'day' ? '#fff0b6' : sky === 'sunset' ? '#ffb56a' : '#365fa1')
    if (p.name === 'Roof_Metal') color.set(sky === 'day' ? '#728b9f' : sky === 'sunset' ? '#a2829b' : '#365a91')
    if (sky === 'day' && (p.role === 'TrainWindow' || p.role === 'TowerLight')) color.set('#15677f')
    if (sky === 'day' && /^Windows(Lit|Cool)$/.test(p.role)) color.set('#2584a2')
    if (p.far) color.lerp(new THREE.Color(MOOD[sky].fog), 0.24)
    if (unlit) return new THREE.MeshBasicMaterial({ color: p.art ? '#ffffff' : p.color, vertexColors: !!p.geometry.attributes.color, toneMapped: false })
    const m = new THREE.MeshToonMaterial({ color: p.art ? '#ffffff' : color, gradientMap: ramp,
      vertexColors: !!p.geometry.attributes.color })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.citySunset = { value: sky === 'sunset' ? 1 : 0 }
      shader.uniforms.cityMetal = { value: p.name === 'Roof_Metal' ? 1 : 0 }
      shader.uniforms.cityEdge = { value: new THREE.Color(sky === 'sunset' ? '#c17f40' : sky === 'night' ? '#173668' : '#738b8d').multiplyScalar(/^(Roof|Near)/.test(p.name) && /Concrete|Building|Metal/.test(p.role) ? 0.4 : 0) }
      shader.uniforms.cityFloor = { value: p.role === 'Floor' ? 1 : 0 }
      shader.uniforms.cityRamp = { value: p.role === 'Ramp' ? 1 : 0 }
      shader.uniforms.cityColoredShadow = { value: /Building|Floor|Concrete|Tank/.test(p.role) ? 1 : 0 }
      shader.uniforms.cityLight = { value: new THREE.Color(sky === 'sunset' ? '#fff1e7' : '#ffffff') }
      shader.uniforms.cityNight = { value: sky === 'night' ? 1 : 0 }
      shader.vertexShader = 'varying vec3 cityPosition;\n' + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ncityPosition = position;')
      shader.uniforms.cityShadow = { value: new THREE.Color(MOOD[sky].shadow) }
      shader.uniforms.cityBands = { value: new THREE.Vector4().fromArray(MOOD[sky].ramp.map((v) => v / 255)) }
      shader.fragmentShader = 'varying vec3 cityPosition;\nuniform vec3 cityEdge;\nuniform float cityMetal;\nuniform float cityNight;\nuniform float cityColoredShadow;\nuniform float cityRamp;\nuniform float cityFloor;\nuniform float citySunset;\nuniform vec3 cityShadow;\nuniform vec3 cityLight;\nuniform vec4 cityBands;\n' + shader.fragmentShader
      shader.fragmentShader = `
        float cityHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float cityNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(cityHash(i), cityHash(i + vec2(1.0, 0.0)), f.x),
            mix(cityHash(i + vec2(0.0, 1.0)), cityHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
      ` + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>', CITY_SHADOW_CHUNK + '\n#include <shadowmask_pars_fragment>')
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
        float cityRim = pow(1.0 - max(dot(normalize(vViewPosition), normal), 0.0), 3.0);
        vec3 cityNormal = inverseTransformDirection(normal, viewMatrix);
        // Keep the riding surface concrete; the side cheek carries the graffiti.
        float rampConcrete = cityRamp * (1.0 - step(0.8, abs(cityNormal.z)));
        #ifdef USE_MAP
          if (cityFloor > 0.5) {
            vec3 floorTex = texture2D(map, vMapUv).rgb;
            float wear = smoothstep(0.2, 0.75, cityNoise(cityPosition.xz * 0.23) * 0.75 + cityNoise(cityPosition.xz * 1.1) * 0.25);
            floorTex = mix(vec3(0.91), floorTex, mix(0.15, 1.0, wear));
            floorTex = mix(floorTex, vec3(dot(floorTex, vec3(0.2126, 0.7152, 0.0722))), cityNight);
            diffuseColor.rgb = diffuse * floorTex;
            #ifdef USE_COLOR
              diffuseColor.rgb *= vColor.rgb;
            #endif
          }
        #endif
        vec3 cityDirection = mix(vec3(-0.65, 0.8, 1.0), vec3(-0.7, 1.0, 0.4), cityMetal);
        vec4 bands = mix(cityBands, vec4(0.24, 0.47, 0.7, 1.0), cityMetal);
        float cityKey = dot(cityNormal, normalize(cityDirection));
        float cityBand = cityKey > 0.65 ? bands.w : cityKey > 0.2 ? bands.z : cityKey > -0.3 ? bands.y : bands.x;
        cityBand = mix(bands.x, cityBand, getShadowMask());
        float cityValue = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        vec3 cityShade = mix(diffuseColor.rgb * cityShadow, diffuseColor.rgb * 0.14 + cityShadow * (0.3 + cityValue * 0.7), max(cityColoredShadow, rampConcrete));
        vec3 cityLit = diffuseColor.rgb * cityLight;
        cityLit += citySunset * max(-cityNormal.x, 0.0) * vec3(0.32, 0.12, 0.035);
        outgoingLight = mix(cityShade, cityLit, smoothstep(0.4, 0.95, cityBand));
        outgoingLight += diffuseColor.rgb * cityRim * 0.07;
        float beveledEdge = smoothstep(0.02, 0.22, 1.0 - max(max(abs(cityNormal.x), abs(cityNormal.y)), abs(cityNormal.z)));
        outgoingLight += cityEdge * beveledEdge * smoothstep(0.05, 0.75, cityKey) * mix(0.3, 1.0, getShadowMask());
        float capEdge = max(smoothstep(4.08, 4.25, abs(cityPosition.x - 21.0)), smoothstep(3.57, 3.75, abs(cityPosition.z + 31.0)));
        float capTop = step(6.15, cityPosition.y) * (1.0 - step(6.5, cityPosition.y)) * step(0.8, cityNormal.y);
        float edgeChip = smoothstep(0.55, 0.7, cityNoise(cityPosition.xz * 14.0));
        outgoingLight += cityMetal * capTop * capEdge * edgeChip * vec3(0.12, 0.14, 0.15) * (1.0 - cityNight * 0.8);
        vec2 cyanDelta = (cityPosition.xz - vec2(-11.0, -25.0)) * vec2(0.26, 0.22);
        vec2 pinkDelta = (cityPosition.xz - vec2(-12.0, -18.0)) * vec2(0.28, 0.22);
        float cyanPool = exp(-dot(cyanDelta, cyanDelta));
        float pinkPool = exp(-dot(pinkDelta, pinkDelta));
        float cityPoolTexture = 1.0;
        #ifdef USE_MAP
          cityPoolTexture = 0.15 + texture2D(map, vMapUv).r * 0.85;
        #endif
        outgoingLight += cityNight * (vec3(0.01, 0.65, 0.9) * cyanPool + vec3(0.95, 0.01, 0.55) * pinkPool) * 1.1 * cityPoolTexture * smoothstep(0.5, 0.9, cityNormal.y);
        float posterSpill = exp(-length((cityPosition - vec3(23.0, 2.0, -27.0)) * vec3(1.2, 0.65, 1.2)));
        outgoingLight += cityNight * posterSpill * vec3(0.1, 0.002, 0.08);
        #include <opaque_fragment>
      `)
    }
    m.toneMapped = false
    m.customProgramCacheKey = () => 'tokyo-v2-' + sky
    return m
  }, [p, sky, ramp, unlit])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    let alive = true
    let tex: THREE.Texture | undefined
    const promise = p.art === 'sign' ? signTexture(p.index)
      : p.art === 'poster' ? posterTexture(p.index)
        : p.art === 'graffiti' ? surfaceTexture(1)
        : p.art === 'vending' ? Promise.resolve(vendingTexture(p.index))
          : p.role === 'TrainWindow' ? Promise.resolve(trainGlassTexture())
          : p.name === 'Roof_Metal' ? Promise.resolve(roofMetalTexture())
          : p.role === 'Ramp' ? rampTexture()
          : (p.role === 'Floor' || p.role === 'RoadPaint') ? surfaceTexture(3)
            : p.role === 'Windows' ? surfaceTexture(2)
              : /Building|Concrete/.test(p.role) ? surfaceTexture(0) : null
    promise?.then((t) => {
      if (!alive) return t.dispose()
      tex = t
      if (!p.art && p.role !== 'Windows' && p.role !== 'TrainWindow' && p.role !== 'Ramp') t.wrapS = t.wrapT = THREE.RepeatWrapping
      material.map = t
      material.needsUpdate = true
    }).catch(() => { /* A failed decal leaves its colored panel readable. */ })
    return () => { alive = false; tex?.dispose() }
  }, [p, material])

  useFrame(({ clock }) => {
    if (!unlit) return
    const breathing = reducedMotion ? 0 : pulse() * 0.06
    const flicker = !reducedMotion && p.art === 'sign' && Math.sin(clock.elapsedTime * 0.7 + p.index * 13) > 0.998 ? 0.82 : 1
    const strength = sky === 'night' ? (p.art === 'sign' ? 1.15 : p.art ? 1.1 : 1.1) + breathing : sky === 'sunset' ? 0.85 : 0.72
    material.color.copy(p.art ? WHITE : p.color).multiplyScalar(strength * flicker)
    if (sky !== 'day' && p.role === 'TrainWindow') material.color.set(sky === 'sunset' ? '#ffcb63' : '#acff5f').multiplyScalar(1.1)
    if (sky === 'sunset' && p.role === 'WindowsCool') material.color.set('#ffd28b')
    if (sky === 'night' && p.role === 'TowerRed') material.color.set('#ff5115').multiplyScalar(1.6)
    if (sky === 'night' && p.role === 'TowerWhite') material.color.set('#73b4f0')
    if (sky === 'night' && p.role === 'TowerLight') material.color.multiplyScalar(reducedMotion || Math.sin(clock.elapsedTime * 2) > -0.75 ? 1 : 0.65)
  })
  return (
    <mesh name={p.name} geometry={p.geometry} material={material} matrix={p.matrix} matrixAutoUpdate={false}
      castShadow={!p.art && !p.name.includes('Windows')} receiveShadow={!unlit}>
      {p.outline && (!compact || (!p.name.startsWith('Mid') && p.role !== 'Metal')) && <Outlines thickness={p.name.startsWith('Mid') ? 0.035 : p.name.startsWith('Near') ? 0.1 : p.name.startsWith('Roof') && /Concrete|Red|Blue/.test(p.role) ? 0.1 : 0.055} color="#172336" />}
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
