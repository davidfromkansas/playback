import { useEffect, useRef } from 'react'

/** Decorative motion only: Spotify never supplies audio samples to this component. */
export function Visualizer({ playing, trackKey }: { playing: boolean; trackKey: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const phase = useRef(0)
  useEffect(() => { phase.current = 0 }, [trackKey])
  useEffect(() => {
    const element = canvas.current
    const ctx = element?.getContext('2d')
    if (!element || !ctx) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let last = 0
    let width = 0
    let height = 0
    const seed = [...trackKey].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 97
    const draw = () => {
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#101827'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#254052'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let x = 0; x < width; x += 18) { ctx.moveTo(x, 0); ctx.lineTo(x, height) }
      for (let y = 8; y < height; y += 14) { ctx.moveTo(0, y); ctx.lineTo(width, y) }
      ctx.stroke()
      // Two layered, deterministic waves create a continuous trail, never an audio measurement.
      for (let layer = 1; layer >= 0; layer--) {
        ctx.strokeStyle = layer ? '#21cbe1' : '#d1ff26'
        ctx.globalAlpha = layer ? 0.35 : 1
        ctx.lineWidth = layer ? 1 : 2
        ctx.beginPath()
        for (let x = 0; x <= width; x += 2) {
          const t = x / 32 + phase.current + seed + layer * 0.8
          const envelope = 0.16 + 0.72 * Math.pow(Math.sin(t * 0.53), 2)
          const wave = (Math.sin(t * 3.8) + Math.sin(t * 7.1) * 0.26) / 1.26
          const y = height / 2 + wave * envelope * height * 0.43
          if (!x) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    const resize = () => {
      const rect = element.getBoundingClientRect()
      width = rect.width
      height = rect.height
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      element.width = Math.round(width * dpr)
      element.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw()
    }
    const tick = (at: number) => {
      if (at - last >= 1000 / 30) {
        if (last) phase.current += Math.min((at - last) / 1000, 0.1) * 1.5
        last = at
        draw()
      }
      frame = requestAnimationFrame(tick)
    }
    const sync = () => {
      cancelAnimationFrame(frame)
      last = 0
      draw()
      if (playing && !media.matches && !document.hidden) frame = requestAnimationFrame(tick)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    resize()
    sync()
    media.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      media.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [playing, trackKey])
  return <canvas ref={canvas} className="deck-wave" aria-hidden="true" />
}
