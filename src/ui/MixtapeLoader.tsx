// Playback's own loader: a shiny CD that revs up the longer you wait, equalizer bars bouncing on the
// app's beat, and the message sprayed on letter by letter like a graffiti tag, drips and all.
import { useEffect, useMemo, useRef } from 'react'
import { BEAT_MS, beatsNow } from '../lib/beat'

const BARS = 7
const SPIN_START = 0.6 // turns per second when it starts
const SPIN_TOP = 2.4 // and once it has revved up
const REV_SECONDS = 6

export function MixtapeLoader({ text }: { text: string }) {
  const disc = useRef<HTMLSpanElement>(null)

  // Spin the CD from JS so it can speed up smoothly; CSS can't change an animation's speed mid-turn.
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    let angle = 0
    let last = performance.now()
    const begun = last
    const tick = (now: number) => {
      const rev = Math.min(1, (now - begun) / 1000 / REV_SECONDS)
      const speed = SPIN_START + (SPIN_TOP - SPIN_START) * rev * rev
      angle = (angle + speed * 360 * ((now - last) / 1000)) % 360
      last = now
      if (disc.current) disc.current.style.transform = `rotate(${angle}deg)`
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Start the bars part-way through a beat so they land on the same beat as the host's dancing.
  const beatDelay = useMemo(() => `${-(beatsNow() % 1) * BEAT_MS}ms`, [])
  // Letters numbered across the whole message, so the spray moves left to right word after word.
  const words = useMemo(() => {
    let i = 0
    return text.split(/\s+/).map((word) => Array.from(word).map((ch) => ({ ch, i: i++ })))
  }, [text])

  return (
    <span className="mixtape" role="status" aria-label={text}>
      <span className="mx-deck" aria-hidden="true">
        <span className="mx-cd" ref={disc}>
          <span className="mx-sheen" />
        </span>
        <span className="mx-eq">
          {Array.from({ length: BARS }, (_, i) => (
            <i
              key={i}
              style={{
                animationDuration: `${BEAT_MS}ms`,
                animationDelay: `calc(${beatDelay} - ${(i % 3) * 90}ms)`,
                ['--peak' as string]: [0.55, 0.9, 0.7, 1, 0.75, 0.95, 0.6][i],
              }}
            />
          ))}
        </span>
      </span>
      <span className="mx-tag" aria-hidden="true">
        {words.map((word, w) => (
          // Words stay whole when the message wraps onto a second line.
          <span className="mx-word" key={w}>
            {word.map(({ ch, i }) => (
              <span
                key={i}
                className={i % 3 === 1 ? 'drip' : undefined}
                style={{ animationDelay: `${i * 70}ms`, ['--drip' as string]: `${8 + ((i * 7) % 9)}px` }}
              >
                {ch}
              </span>
            ))}
          </span>
        ))}
      </span>
    </span>
  )
}
