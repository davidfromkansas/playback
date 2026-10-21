// Button prompts that scroll in time with Playback's steady beat. Just for fun:
// hitting them moves the mood meter, missing them never stops the music.
import { useCallback, useEffect, useRef, useState } from 'react'
import { beatsNow, beatTime } from '../lib/beat'

export const SYMBOLS = [
  { key: 'ArrowLeft', icon: '★', color: '#ffe14d', label: 'Star' },
  { key: 'ArrowUp', icon: '♥', color: '#ff7eb6', label: 'Heart' },
  { key: 'ArrowDown', icon: '♪', color: '#7ee0ff', label: 'Note' },
  { key: 'ArrowRight', icon: '✿', color: '#9dff8a', label: 'Flower' },
] as const

const LOOKAHEAD = 8 // beats visible ahead of the hit line
const PERFECT_MS = 70
const OK_MS = 160

/** A prompt every other beat; which symbol is fixed per beat so it's the same for everyone. */
function symbolAt(beat: number): number | null {
  if (beat % 2 !== 0) return null
  const h = Math.imul(beat, 2654435761) >>> 0
  return (h >>> 7) % SYMBOLS.length
}

export type Hit = 'perfect' | 'good' | 'miss'

export function RhythmBar({ onHit }: { onHit: (hit: Hit) => void }) {
  const [, setFrame] = useState(0)
  const hits = useRef(new Map<number, Hit>())
  const [flash, setFlash] = useState<{ text: string; at: number } | null>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setFrame((f) => f + 1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const press = useCallback(
    (symbol: number) => {
      const now = performance.now()
      const nearest = Math.round(beatsNow(now) / 2) * 2
      let result: Hit = 'miss'
      for (const beat of [nearest - 2, nearest, nearest + 2]) {
        if (symbolAt(beat) !== symbol || hits.current.has(beat)) continue
        const off = Math.abs(beatTime(beat) - now)
        if (off <= OK_MS) {
          result = off <= PERFECT_MS ? 'perfect' : 'good'
          hits.current.set(beat, result)
          break
        }
      }
      setFlash({ text: result === 'perfect' ? 'COOL!' : result === 'good' ? 'GOOD' : 'BAD', at: now })
      onHit(result)
    },
    [onHit],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = SYMBOLS.findIndex((s) => s.key === e.key)
      if (i < 0 || e.repeat) return
      e.preventDefault()
      press(i)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  const now = performance.now()
  const current = beatsNow(now)
  const prompts: { beat: number; symbol: number; x: number }[] = []
  for (let b = Math.floor(current) - 1; b <= current + LOOKAHEAD; b++) {
    const symbol = symbolAt(b)
    if (symbol === null || hits.current.has(b)) continue
    const x = (b - current) / LOOKAHEAD // 0 = on the line, 1 = far right
    if (x < -0.08) continue
    prompts.push({ beat: b, symbol, x })
  }
  const showFlash = flash && now - flash.at < 450

  return (
    <div className="rhythm">
      <div className="rhythm-track">
        <div className="rhythm-line" style={{ transform: `scale(${1 + 0.15 * Math.pow(1 - (current % 1), 6)})` }} />
        {prompts.map((p) => (
          <div
            key={p.beat}
            className="rhythm-prompt"
            style={{ left: `calc(12% + ${p.x * 84}%)`, background: SYMBOLS[p.symbol].color }}
          >
            {SYMBOLS[p.symbol].icon}
          </div>
        ))}
        {showFlash && <div className={`rhythm-flash ${flash!.text === 'BAD' ? 'bad' : ''}`}>{flash!.text}</div>}
      </div>
      <div className="rhythm-buttons">
        {SYMBOLS.map((s, i) => (
          <button
            key={s.key}
            style={{ background: s.color }}
            aria-label={s.label}
            onPointerDown={(e) => {
              e.preventDefault()
              press(i)
            }}
          >
            {s.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

