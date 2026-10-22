import { useEffect, useRef } from 'react'
import { advanceVolt, newVoltMotion, VOLT_COLUMNS, VOLT_HEIGHT, VOLT_WIDTH } from './voltAnimation'

interface DJProps {
  dancing: boolean
  className?: string
  // The review surface uses the same renderer and clock, with optional frame inspection.
  speed?: number
  inspectCel?: number
}

export function DJ({ dancing, className, speed = 1, inspectCel }: DJProps) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const inputs = useRef({ dancing, speed, inspectCel })
  inputs.current = { dancing, speed, inspectCel }

  useEffect(() => {
    const el = canvas.current
    const context = el?.getContext('2d')
    if (!el || !context) return
    const atlas = new Image()
    const motion = newVoltMotion()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let raf = 0
    let disposed = false
    let last = 0
    let previous = -1
    const draw = (now: number) => {
      const dt = last ? (now - last) / 1000 : 0
      last = now
      const input = inputs.current
      const sample = reduced.matches
        ? { cel: input.dancing ? 24 : 0, state: input.dancing ? 'playing' : 'idle' }
        : advanceVolt(motion, Math.min(dt, 0.05) * input.speed, input.dancing)
      const cel = input.inspectCel === undefined ? sample.cel : Math.max(0, Math.min(35, input.inspectCel))
      if (cel !== previous) {
        context.clearRect(0, 0, VOLT_WIDTH, VOLT_HEIGHT)
        context.drawImage(atlas, (cel % VOLT_COLUMNS) * VOLT_WIDTH,
          Math.floor(cel / VOLT_COLUMNS) * VOLT_HEIGHT, VOLT_WIDTH, VOLT_HEIGHT,
          0, 0, VOLT_WIDTH, VOLT_HEIGHT)
        previous = cel
      }
      el.dataset.cel = String(cel)
      el.dataset.motion = sample.state
      el.dataset.playing = String(input.dancing)
      raf = requestAnimationFrame(draw)
    }
    atlas.onload = () => { if (!disposed) raf = requestAnimationFrame(draw) }
    atlas.onerror = () => { el.dataset.error = 'artwork-unavailable' }
    atlas.src = '/characters/dj-volt/atlas.webp'
    const resetClock = () => { last = 0 }
    document.addEventListener('visibilitychange', resetClock)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', resetClock)
    }
  }, [])

  return <canvas ref={canvas} width={VOLT_WIDTH} height={VOLT_HEIGHT}
    className={`${className ?? ''} dj-volt`} aria-hidden="true" />
}
