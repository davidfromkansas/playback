// Street theme: comic-style speed lines streak across the screen while the shelf is moving fast.
import { useEffect, useRef } from 'react'
import type { ScrollState } from '../scene/Shelf'

export function SpeedLines({ scroll }: { scroll: ScrollState }) {
  const el = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    let last = scroll.current
    let level = 0
    const frame = () => {
      const v = Number.isFinite(scroll.current) && Number.isFinite(last) ? scroll.current - last : 0
      last = scroll.current
      level += (Math.min(1, Math.abs(v) * 6) - level) * 0.15
      if (el.current) {
        el.current.style.opacity = level < 0.02 ? '0' : String(level)
        // Slide the streak pattern with the shelf so the lines rush past.
        const pos = `${-scroll.current * 600}px 0`
        el.current.style.maskPosition = pos
        el.current.style.setProperty('-webkit-mask-position', pos)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [scroll])
  return <div ref={el} className="speedlines" aria-hidden />
}
