import * as THREE from 'three'

const images = new Map<string, Promise<HTMLImageElement>>()
export const SIGN_WORDS = ['音楽', 'レコード', 'カラオケ', 'ゲーム', 'CD', 'ラジオ', 'ダンス', '渋谷']

function image(name: string) {
  if (!images.has(name)) images.set(name, new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = `/textures/street/${name}.webp`
  }))
  return images.get(name)!
}

function canvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, ctx: c.getContext('2d')! }
}

function texture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  // Blender faces have bottom-to-top UVs, unlike the canvas image origin.
  t.flipY = false
  t.anisotropy = 4
  return t
}

function tile(ctx: CanvasRenderingContext2D, img: HTMLImageElement, i: number, cols: number, rows: number, w: number, h: number) {
  const sw = img.width / cols
  const sh = img.height / rows
  ctx.drawImage(img, (i % cols) * sw, Math.floor(i / cols) * sh, sw, sh, 0, 0, w, h)
}

let japaneseFont: Promise<unknown> | undefined
export function loadSignFont() {
  if (!japaneseFont) {
    const font = new FontFace('Tokyo Signs', 'url(/textures/street/sign-font.ttf)')
    japaneseFont = font.load().then((loaded) => { document.fonts.add(loaded) })
  }
  return japaneseFont
}

export async function signTexture(index: number) {
  const [img] = await Promise.all([image('signs'), loadSignFont()])
  const heights = [337, 438, 531, 457, 179, 388, 326, 280]
  const height = heights[index % 8]
  const { c, ctx } = canvas(256, height)
  tile(ctx, img, index % 8, 4, 2, 256, height)
  const colors = ['#f42f4e', '#00c9c2', '#ef2a45', '#ffe322', '#00b8e9', '#ef29b8', '#ef304b', '#167be9']
  ctx.fillStyle = colors[index % 8]
  ctx.fillRect(18, 18, 220, height - 36)
  ctx.strokeStyle = '#152135'
  ctx.lineWidth = 6
  ctx.strokeRect(18, 18, 220, height - 36)
  const word = SIGN_WORDS[index % 8]
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 8
  ctx.strokeStyle = '#191a35'
  ctx.fillStyle = index % 8 === 3 ? '#131c2b' : '#fffbea'
  const chars = word === 'CD' ? ['CD'] : [...word]
  const fontSize = Math.min(152, (height - 50) / chars.length * 0.85)
  ctx.font = `${fontSize}px "Tokyo Signs", "Hiragino Kaku Gothic ProN", sans-serif`
  chars.forEach((ch, i) => {
    const y = height / 2 + (i - (chars.length - 1) / 2) * Math.min(170, (height - 50) / chars.length)
    ctx.save()
    ctx.translate(128, y)
    // Vertical Japanese long-vowel mark needs a quarter turn.
    if (ch === 'ー') ctx.rotate(Math.PI / 2)
    if (ch === 'CD') ctx.font = 'bold 100px sans-serif'
    ctx.strokeText(ch, 0, 0)
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  })
  return texture(c)
}

export async function posterTexture(index: number) {
  const img = await image(index === 1 ? 'concept-art-v2' : 'posters')
  const { c: art, ctx: artCtx } = canvas(512, 512)
  tile(artCtx, img, index === 1 ? 3 : index % 4, 2, 2, 512, 512)
  if (index > 1) return texture(art)
  const { c, ctx } = canvas(512, 1216)
  ctx.fillStyle = index === 1 ? '#f02aab' : '#a9e938'
  ctx.fillRect(0, 0, 512, 1216)
  ctx.drawImage(art, 0, 256, 512, 512)
  ctx.fillStyle = '#182036'
  ctx.textAlign = 'center'
  ctx.font = 'bold 104px "Bangers", sans-serif'
  ctx.fillText(index === 1 ? 'NIGHT' : 'BASS', 256, 145)
  ctx.fillText(index === 1 ? 'RADIO' : 'CLUB', 256, 960)
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText('TOKYO • FM 99.9', 256, 1088)
  ctx.lineWidth = 12
  ctx.strokeRect(16, 16, 480, 1184)
  for (let y = 1120; y < 1160; y += 9) ctx.fillRect(70, y, 372, 3)
  return texture(c)
}

export async function surfaceTexture(index: number) {
  const img = await image(index === 3 ? 'roof-concrete-v2' : 'surfaces')
  const { c, ctx } = canvas(1024, 1024)
  if (index === 3) ctx.drawImage(img, 0, 0, 1024, 1024)
  else tile(ctx, img, index, 2, 2, 1024, 1024)
  if (index === 0) {
    ctx.fillStyle = 'rgba(245,240,224,0.82)'
    ctx.fillRect(0, 0, 1024, 1024)
  }
  return texture(c)
}

export function roofMetalTexture() {
  const { c, ctx } = canvas(1024, 1024)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 1024, 1024)
  // Isolated maintenance scuffs leave most painted steel clean.
  for (const [x, y, angle] of [[90, 210, 0.2], [350, 720, -0.3], [740, 300, 0.4], [890, 850, -0.1]]) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#d2d9df' : '#b6c3cc'
      ctx.fillRect(i * 7, i * 5, 18 + i * 4, 1.5)
    }
    ctx.restore()
  }
  return texture(c)
}

export function vendingTexture(index = 0) {
  const { c, ctx } = canvas(512, 512)
  const variant = Math.abs(index) % 3
  ctx.fillStyle = '#172e39'
  ctx.fillRect(0, 0, 512, 512)
  const glass = ctx.createLinearGradient(0, 0, 512, 512)
  glass.addColorStop(0, '#eaffee')
  glass.addColorStop(0.6, '#bdddd5')
  glass.addColorStop(1, '#6eaaa7')
  ctx.fillStyle = glass
  ctx.fillRect(12, 12, 488, 488)
  const colors = ['#e8364f', '#1388c7', '#edbd37', '#5da444', '#f1e9d5']
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 30 + col * 96
      const y = 25 + row * 160
      const bottle = (col + row + variant) % 3 !== 0
      ctx.fillStyle = 'rgba(15,37,45,0.25)'
      ctx.fillRect(x + 9, y + 20, 58, 111)
      ctx.fillStyle = colors[(col + row * 2 + variant) % colors.length]
      ctx.beginPath()
      if (bottle) {
        ctx.moveTo(x + 20, y + 18)
        ctx.lineTo(x + 44, y + 18)
        ctx.lineTo(x + 46, y + 37)
        ctx.quadraticCurveTo(x + 60, y + 42, x + 60, y + 57)
        ctx.lineTo(x + 60, y + 124)
        ctx.lineTo(x + 4, y + 124)
        ctx.lineTo(x + 4, y + 57)
        ctx.quadraticCurveTo(x + 4, y + 42, x + 18, y + 37)
      } else ctx.roundRect(x + 4, y + 32, 56, 92, 7)
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#28424b'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = bottle ? '#dfe9e1' : '#adbfc1'
      ctx.fillRect(x + (bottle ? 20 : 7), y + (bottle ? 12 : 32), bottle ? 24 : 50, 9)
      ctx.fillStyle = '#fff9e2'
      ctx.fillRect(x + 6, y + 69, 52, 31)
      ctx.fillStyle = '#254554'
      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(['SODA', 'TEA', 'TOKYO', 'WATER', 'POP'][(col + variant) % 5], x + 32, y + 89)
      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.fillRect(x + 11, y + 49, 5, 62)
      ctx.fillStyle = '#fff7ae'
      ctx.fillRect(x + 11, y + 134, 43, 16)
      ctx.fillStyle = '#28424b'
      ctx.font = '12px sans-serif'
      ctx.fillText(row === 2 ? '¥120' : '¥150', x + 32, y + 147)
    }
    ctx.fillStyle = '#648a92'
    ctx.fillRect(15, 177 + row * 160, 482, 6)
  }
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.beginPath()
  ctx.moveTo(60, 12); ctx.lineTo(130, 12); ctx.lineTo(405, 500); ctx.lineTo(335, 500)
  ctx.fill()
  return texture(c)
}

export function scanlines(t: THREE.CanvasTexture) {
  const c = t.image as HTMLCanvasElement
  const ctx = c.getContext('2d')!
  ctx.fillStyle = 'rgba(4,8,29,0.16)'
  for (let y = 0; y < c.height; y += 5) ctx.fillRect(0, y, c.width, 1)
  ctx.fillStyle = 'rgba(4,8,29,0.06)'
  for (let x = 0; x < c.width; x += 4) ctx.fillRect(x, 0, 1, c.height)
  t.needsUpdate = true
  return t
}

export async function conceptArtTexture(index: number) {
  const img = await image('concept-art-v2')
  const { c, ctx } = canvas(1024, 1024)
  tile(ctx, img, index, 2, 2, 1024, 1024)
  return texture(c)
}

export async function idleScreen(index: number) {
  return scanlines(await conceptArtTexture(index % 2))
}

export function trainGlassTexture() {
  const { c, ctx } = canvas(128, 128)
  ctx.fillStyle = '#c8dee7'
  ctx.fillRect(0, 0, 128, 128)
  ctx.fillStyle = '#f4ffff'
  ctx.beginPath()
  ctx.moveTo(5, 0)
  ctx.lineTo(50, 0)
  ctx.lineTo(128, 90)
  ctx.lineTo(128, 122)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#8babbc'
  ctx.fillRect(0, 97, 128, 31)
  ctx.fillStyle = '#d8e9ed'
  ctx.fillRect(0, 97, 128, 3)
  return texture(c)
}

export async function rampTexture() {
  const [art, concrete] = await Promise.all([image('concept-art-v2'), image('roof-concrete-v2')])
  const { c, ctx } = canvas(2048, 1024)
  tile(ctx, art, 2, 2, 2, 1024, 1024)
  ctx.drawImage(concrete, 1024, 0, 1024, 1024)
  const { c: decal, ctx: decalCtx } = canvas(512, 512)
  tile(decalCtx, art, 2, 2, 2, 512, 512)
  const pixels = decalCtx.getImageData(0, 0, 512, 512)
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.slice(i, i + 3)
    if (r > 155 && g > 145 && b > 100 && Math.max(r, g, b) - Math.min(r, g, b) < 90) pixels.data[i + 3] = 0
  }
  decalCtx.putImageData(pixels, 0, 0)
  // A smaller painted tag crosses the low riding surface; most concrete stays exposed.
  ctx.drawImage(decal, 1630, 220, 380, 590)
  return texture(c)
}
