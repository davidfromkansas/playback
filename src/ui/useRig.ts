import { useEffect, useRef } from 'react'
import { beatsNow } from '../lib/beat'

/** Inputs each character's pose function gets every frame. */
export interface RigFrame {
  /** 0 = chilling, 1 = dancing, eased so switching between them is smooth. */
  m: number
  /** Seconds since the page loaded. */
  t: number
  /** Beats on the shared beat clock (fractional). */
  b: number
  /** Linear blend from the chill value to the dance value. */
  lerp: (chill: number, dance: number) => number
  /** Sets an SVG transform on a named part. */
  set: (part: string, transform: string) => void
  /** True for ~130 ms every few seconds. */
  blinking: boolean
}

const ease = (x: number) => x * x * (3 - 2 * x)

/**
 * Runs a character's pose function on every display frame (60 or 120 fps), writing
 * SVG transforms directly so React never re-renders during the animation.
 */
export function useRig(dancing: boolean, pose: (f: RigFrame) => void) {
  const parts = useRef<Record<string, SVGGElement | null>>({})
  const dancingRef = useRef(dancing)
  dancingRef.current = dancing
  const poseRef = useRef(pose)
  poseRef.current = pose

  useEffect(() => {
    let raf = 0
    let mix = dancingRef.current ? 1 : 0
    let last = performance.now()
    let nextBlink = last + 2000
    const set = (p: string, tr: string) => parts.current[p]?.setAttribute('transform', tr)
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      mix += ((dancingRef.current ? 1 : 0) - mix) * Math.min(1, dt * 4)
      const m = ease(Math.max(0, Math.min(1, mix)))
      if (now > nextBlink + 130) nextBlink = now + 2500 + Math.random() * 3000
      poseRef.current({
        m,
        t: now / 1000,
        b: beatsNow(now),
        lerp: (chill, dance) => chill + (dance - chill) * m,
        set,
        blinking: now > nextBlink && now < nextBlink + 130,
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (name: string) => (el: SVGGElement | null) => {
    parts.current[name] = el
  }
}
