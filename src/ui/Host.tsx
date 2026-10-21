// "MC Tape", Playback's own host: a flat paper-cutout cassette with legs and a cap.
import { useEffect, useState } from 'react'
import { pulse } from '../lib/beat'
import { INK } from '../lib/colors'

export function Host({ line, bouncing }: { line: string; bouncing: boolean }) {
  const [squash, setSquash] = useState(0)
  // Each line stays up for a while, then the bubble tucks away so it doesn't hide the shelf.
  const [shown, setShown] = useState(line)
  useEffect(() => {
    setShown(line)
    const id = setTimeout(() => setShown(''), 7000)
    return () => clearTimeout(id)
  }, [line])
  useEffect(() => {
    if (!bouncing) return setSquash(0)
    let raf = 0
    const tick = () => {
      setSquash(pulse())
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [bouncing])

  return (
    <div className="host">
      {shown && (
        <div className="bubble" key={shown}>
          {shown}
        </div>
      )}
      <svg
        viewBox="0 0 120 130"
        className="host-figure"
        style={{ transform: `scale(${1 + squash * 0.06}, ${1 - squash * 0.08})` }}
        aria-hidden
      >
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
          {/* legs */}
          <path d="M42 98 L36 120 L24 122" fill="none" />
          <path d="M78 98 L84 120 L96 122" fill="none" />
          {/* body */}
          <rect x="10" y="30" width="100" height="70" rx="10" fill="#ffe14d" />
          <rect x="22" y="42" width="76" height="34" rx="6" fill="#fff7e8" />
          {/* reels as eyes */}
          <circle cx="42" cy="59" r="10" fill="#ffffff" />
          <circle cx="78" cy="59" r="10" fill="#ffffff" />
          <circle cx="44" cy="60" r="4" fill={INK} />
          <circle cx="80" cy="60" r="4" fill={INK} />
          {/* smile */}
          <path d="M50 86 Q60 94 70 86" fill="none" />
          {/* cap */}
          <path d="M22 32 Q60 0 98 32 Z" fill="#ff7eb6" />
          <path d="M92 30 L116 34 L96 38 Z" fill="#ff7eb6" />
          <circle cx="60" cy="14" r="5" fill="#7ee0ff" />
        </g>
      </svg>
    </div>
  )
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

export const rhymes = {
  welcome: () =>
    pick([
      "Yo! I'm MC Tape. Your music's on the shelf, come pick a CD yourself!",
      'Welcome to Playback, take a look around. Every CD here makes a happy sound!',
    ]),
  pulled: (title: string) =>
    pick([
      `"${title}"! Good pick, my friend. Tap the case, let's go from beginning to end!`,
      `Out comes "${title}", fresh off the rack. Tap to open, then kick back!`,
      `"${title}" in your hand, now isn't that grand? Tap it open, strike up the band!`,
    ]),
  opened: () => pick(['Pick a song, any song, you really can\'t go wrong!', 'The disc is out and ready to spin. Pick a track, let the fun begin!']),
  playing: (song: string) =>
    pick([
      `Now playing "${song}", turn it up loud! Tap along to the beat and make me proud!`,
      `"${song}" is on, the room's in a groove. Hit the buttons on the beat and make your move!`,
    ]),
  returned: () => pick(['Back on the shelf, nice and neat. Pick another one, keep up the beat!', 'Put it back, stack it tight. What we playing next tonight?']),
  cool: () => pick(['You rappin\' COOL! Keep it up!', 'Whoa, COOL! You got the rhythm!']),
  bad: () => pick(['Uh oh, a little off the beat. Shake it off, move your feet!', 'Hmm, BAD... but I believe in you!']),
}
