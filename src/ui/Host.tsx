// The host: a dancing character with a speech bubble for little rhymes.
import { useEffect, useState } from 'react'
import { Rapper } from './Rapper'

export function Host({ line, bouncing }: { line: string; bouncing: boolean }) {
  // Each line stays up for a while, then the bubble tucks away so it doesn't hide the shelf.
  const [shown, setShown] = useState(line)
  useEffect(() => {
    setShown(line)
    const id = setTimeout(() => setShown(''), 7000)
    return () => clearTimeout(id)
  }, [line])

  return (
    <div className="host">
      {shown && (
        <div className="bubble" key={shown}>
          {shown}
        </div>
      )}
      <Rapper dancing={bouncing} className="host-figure" />
    </div>
  )
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

export const rhymes = {
  welcome: () =>
    pick([
      "Yo! Your music's on the shelf, come pick a CD yourself!",
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
