// The host character, drawn flat in the paper-cutout style (design used with permission).
// Animated every display frame (60 or 120 fps) by writing SVG transforms directly,
// so React never re-renders during the animation.
import { useEffect, useRef } from 'react'
import { beatsNow } from '../lib/beat'
import { INK } from '../lib/colors'

const SKIN = '#fff6c9'
const HAT = '#f47b20'
const HAT_BAND = '#e8661a'
const SHIRT = '#5aa3e8'
const PANTS = '#1f3f8f'
const SHOE = '#e53935'

type Part = 'body' | 'torso' | 'head' | 'hat' | 'armL' | 'armR' | 'legL' | 'legR' | 'eyes' | 'shadow'

const ease = (x: number) => x * x * (3 - 2 * x)

export function Rapper({ dancing, className }: { dancing: boolean; className?: string }) {
  const parts = useRef<Partial<Record<Part, SVGGElement | null>>>({})
  const dancingRef = useRef(dancing)
  dancingRef.current = dancing

  useEffect(() => {
    let raf = 0
    let mix = dancingRef.current ? 1 : 0 // 0 = chilling, 1 = dancing; eased so switches are smooth
    let last = performance.now()
    let nextBlink = last + 2000
    const set = (p: Part, t: string) => parts.current[p]?.setAttribute('transform', t)

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      mix += ((dancingRef.current ? 1 : 0) - mix) * Math.min(1, dt * 4)
      const m = ease(Math.max(0, Math.min(1, mix)))
      const t = now / 1000

      // Dance: driven by the shared beat clock so it lines up with the rhythm bar.
      const b = beatsNow(now)
      const bounce = Math.abs(Math.sin(Math.PI * b)) // 0 on the beat, 1 between
      const sway = Math.sin(Math.PI * b) // -1..1 over two beats
      const hit = Math.pow(1 - (b % 1), 5) // sharp kick on each beat

      // Chill: slow breathing, weight shifting, a lazy foot tap.
      const breathe = Math.sin(t * 1.7)
      const drift = Math.sin(t * 0.6)
      const tap = Math.max(0, Math.sin(t * 2.6)) ** 3

      const lerp = (chill: number, dance: number) => chill + (dance - chill) * m

      const bodyY = lerp(breathe * 1.2, -bounce * 16)
      const bodyX = lerp(drift * 3, sway * 6)
      const squash = lerp(0, hit * 0.06)
      set('body', `translate(${bodyX} ${bodyY}) translate(100 285) scale(${1 + squash} ${1 - squash}) translate(-100 -285)`)
      set('shadow', `translate(${bodyX} 0) translate(100 288) scale(${1 - lerp(0, bounce * 0.25)} 1) translate(-100 -288)`)

      set('torso', `rotate(${lerp(drift * 2, sway * 7)} 100 205) scale(1 ${1 + lerp(breathe * 0.012, 0)})`)
      set('head', `rotate(${lerp(Math.sin(t * 0.8) * 5 - 3, Math.sin(Math.PI * b - 0.6) * 10)} 100 150)`)
      // The tall hat lags behind the head, so it flops.
      set('hat', `rotate(${lerp(Math.sin(t * 0.8 - 0.5) * 4, Math.sin(Math.PI * b - 1.3) * 12)} 100 92)`)

      // Right arm: relaxed at the side when chilling, pumping a finger to the sky when dancing.
      set('armR', `rotate(${lerp(-10 + Math.sin(t * 1.1) * 4, -150 + Math.sin(Math.PI * 2 * b) * 35)} 128 162)`)
      // Left hand stays on the hip, swinging a little more while dancing.
      set('armL', `rotate(${lerp(Math.sin(t * 1.3) * 3, sway * 14)} 72 162)`)

      // Legs: stepping side to side on the beat, or tapping one foot when idle.
      const step = Math.sin(Math.PI * b)
      set('legL', `rotate(${lerp(-tap * 6, Math.max(0, step) * 16)} 86 210) translate(0 ${lerp(-tap * 4, -Math.max(0, step) * 8)})`)
      set('legR', `rotate(${lerp(0, Math.min(0, step) * 16)} 114 210) translate(0 ${lerp(0, Math.min(0, step) * 8)})`)

      // Blink now and then.
      if (now > nextBlink + 130) nextBlink = now + 2500 + Math.random() * 3000
      const blinking = now > nextBlink && now < nextBlink + 130
      set('eyes', blinking ? 'translate(0 112) scale(1 0.12) translate(0 -112)' : '')

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  const ref = (p: Part) => (el: SVGGElement | null) => {
    parts.current[p] = el
  }

  return (
    <svg viewBox="0 -24 200 324" className={className} aria-hidden>
      <g ref={ref('shadow')}>
        <ellipse cx="100" cy="288" rx="48" ry="7" fill="rgba(0,0,0,0.18)" />
      </g>
      <g ref={ref('body')} stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
        {/* Legs and sneakers */}
        <g ref={ref('legL')}>
          <path d="M76 205 L96 205 L94 262 L74 262 Z" fill={PANTS} />
          <path d="M58 262 Q58 252 74 252 L94 254 L96 274 L54 274 Q50 266 58 262 Z" fill={SHOE} />
          <path d="M52 276 L98 276" stroke="#ffffff" strokeWidth="5" />
          <path d="M66 262 L72 268 L78 262 L84 268" fill="none" stroke="#ffffff" strokeWidth="3" />
        </g>
        <g ref={ref('legR')}>
          <path d="M104 205 L124 205 L126 262 L106 262 Z" fill={PANTS} />
          <path d="M142 262 Q142 252 126 252 L106 254 L104 274 L146 274 Q150 266 142 262 Z" fill={SHOE} />
          <path d="M102 276 L148 276" stroke="#ffffff" strokeWidth="5" />
          <path d="M116 262 L122 268 L128 262 L134 268" fill="none" stroke="#ffffff" strokeWidth="3" />
        </g>
        <g ref={ref('torso')}>
          {/* Left arm, hand on hip */}
          <g ref={ref('armL')}>
            <path d="M74 160 Q56 178 66 198 L76 194 Q70 180 82 168 Z" fill={SKIN} />
            <circle cx="70" cy="199" r="8" fill={SKIN} />
          </g>
          {/* Shirt */}
          <path d="M74 150 Q100 142 126 150 L132 210 Q100 216 68 210 Z" fill={SHIRT} />
          <path d="M90 150 Q100 158 110 150" fill="none" />
          {/* Right arm with pointing finger; rotated at the shoulder */}
          <g ref={ref('armR')}>
            <path d="M124 158 L132 154 L134 196 L124 196 Z" fill={SKIN} />
            <circle cx="129" cy="202" r="9" fill={SKIN} />
            <path d="M129 209 L129 222" strokeWidth="7" stroke={INK} />
            <path d="M129 209 L129 221" strokeWidth="3" stroke={SKIN} />
          </g>
          {/* Head */}
          <g ref={ref('head')}>
            {/* Floppy ears */}
            <path d="M66 92 Q48 112 58 142 Q66 146 70 136 Q66 116 76 98 Z" fill={INK} />
            <path d="M134 92 Q152 112 142 142 Q134 146 130 136 Q134 116 124 98 Z" fill={INK} />
            {/* Face */}
            <path d="M70 94 L130 94 Q136 120 126 140 Q100 154 74 140 Q64 120 70 94 Z" fill={SKIN} />
            <g ref={ref('eyes')}>
              <ellipse cx="88" cy="112" rx="10" ry="12" fill="#ffffff" />
              <ellipse cx="112" cy="112" rx="10" ry="12" fill="#ffffff" />
              <circle cx="91" cy="114" r="4.5" fill={INK} stroke="none" />
              <circle cx="109" cy="114" r="4.5" fill={INK} stroke="none" />
            </g>
            <ellipse cx="100" cy="128" rx="5" ry="3.5" fill={INK} />
            <path d="M90 136 Q100 142 110 136" fill="none" strokeWidth="3" />
            {/* Tall beanie */}
            <g ref={ref('hat')}>
              <path d="M66 84 Q64 26 98 -8 Q106 -18 114 -6 Q138 30 134 84 Z" fill={HAT} />
              <path d="M100 4 Q90 40 88 76" fill="none" strokeWidth="2" opacity="0.4" />
              <rect x="62" y="78" width="76" height="20" rx="10" fill={HAT_BAND} />
              <circle cx="100" cy="88" r="7" fill="#3ddc5a" strokeWidth="3" />
              <circle cx="100" cy="88" r="3" fill="#ffe14d" stroke="none" />
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
