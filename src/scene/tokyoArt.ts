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
  const { c, ctx } = canvas(256, 1024)
  tile(ctx, img, index % 8, 4, 2, 256, 1024)
  const word = SIGN_WORDS[index % 8]
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '152px "Tokyo Signs", "Hiragino Kaku Gothic ProN", sans-serif'
  ctx.lineWidth = 8
  ctx.strokeStyle = '#191a35'
  ctx.fillStyle = '#fffbea'
  const chars = word === 'CD' ? ['CD'] : [...word]
  chars.forEach((ch, i) => {
    const y = 512 + (i - (chars.length - 1) / 2) * 170
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
  const img = await image('posters')
  const { c, ctx } = canvas(512, 512)
  tile(ctx, img, index % 4, 2, 2, 512, 512)
  return texture(c)
}

export async function surfaceTexture(index: number) {
  const img = await image('surfaces')
  const { c, ctx } = canvas(512, 512)
  tile(ctx, img, index, 2, 2, 512, 512)
  if (index === 0 || index === 3) {
    ctx.fillStyle = index === 0 ? 'rgba(223,220,207,0.88)' : 'rgba(197,191,174,0.58)'
    ctx.fillRect(0, 0, 512, 512)
  }
  return texture(c)
}

export function vendingTexture() {
  const { c, ctx } = canvas(256, 256)
  ctx.fillStyle = '#ecffef'
  ctx.fillRect(0, 0, 256, 256)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const x = 12 + col * 40
      const y = 12 + row * 78
      ctx.fillStyle = ['#e94765', '#26b2cf', '#f8be42', '#453e8a'][(col + row) % 4]
      ctx.fillRect(x, y, 24, 48)
      ctx.fillStyle = '#faf4d9'
      ctx.fillRect(x, y + 16, 24, 12)
      ctx.fillStyle = '#263548'
      ctx.fillRect(x, y + 58, 24, 5)
    }
  }
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

export async function idleScreen(index: number) {
  const img = await image('posters')
  const { c, ctx } = canvas(1024, 512)
  ctx.fillStyle = index % 2 ? '#042f47' : '#241140'
  ctx.fillRect(0, 0, 1024, 512)
  const sw = img.width / 2
  const i = index % 2 ? 2 : 0
  ctx.drawImage(img, (i % 2) * sw, Math.floor(i / 2) * sw, sw, sw, 0, 0, 512, 512)
  ctx.fillStyle = '#e7fc97'
  ctx.font = 'bold 64px sans-serif'
  ctx.fillText('PLAYBACK', 540, 180)
  ctx.fillText('FM / 2000', 540, 255)
  ctx.fillStyle = '#ff88b4'
  ctx.font = 'bold 30px sans-serif'
  ctx.fillText(index % 2 ? 'AFTER HOURS' : 'ON THE ROOFTOP', 540, 340)
  return scanlines(texture(c))
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
