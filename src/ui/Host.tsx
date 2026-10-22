// The host: a dancing character with a speech bubble for little rhymes.
import { useEffect, useState } from 'react'
import type { Theme } from '../lib/theme'
import { DJ } from './DJ'
import { Rapper } from './Rapper'

export function Host({ line, bouncing, theme }: { line: string; bouncing: boolean; theme: Theme }) {
  // Each line stays up for a while, then the bubble tucks away so it doesn't hide the shelf.
  const [shown, setShown] = useState(line)
  useEffect(() => {
    setShown(line)
    const id = setTimeout(() => setShown(''), 3500)
    return () => clearTimeout(id)
  }, [line])

  return (
    <div className="host">
      {shown && (
        <div className="bubble" key={shown}>
          {shown}
        </div>
      )}
      {theme === 'street' ? (
        <DJ dancing={bouncing} className="host-figure" />
      ) : (
        <Rapper dancing={bouncing} className="host-figure" />
      )}
    </div>
  )
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

const paperRhymes = {
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
      `Now playing "${song}", turn it up loud! Let it fill the room!`,
      `"${song}" is on, the room's in a groove. Kick back and let the music move!`,
    ]),
  returned: () => pick(['Back on the shelf, nice and neat. Pick another one, keep up the beat!', 'Put it back, stack it tight. What we playing next tonight?']),
  cool: () => pick(['You rappin\' COOL! Keep it up!', 'Whoa, COOL! You got the rhythm!']),
  bad: () => pick(['Uh oh, a little off the beat. Shake it off, move your feet!', 'Hmm, BAD... but I believe in you!']),
}

// DJ Volt talks like a pirate-radio host instead of rhyming.
const streetRhymes: typeof paperRhymes = {
  welcome: () =>
    pick([
      "This is DJ Volt on Playback FM! The wall's covered in your CDs. Grab one!",
      "Yo yo yo! Playback FM, broadcasting live from the rooftop. Pick a disc!",
    ]),
  pulled: (title: string) =>
    pick([
      `"${title}"! Now THAT's a tag worth spraying. Tap the case to crack it open!`,
      `Snagged "${title}" off the wall! Tap it, let's see what's inside.`,
    ]),
  opened: () => pick(['Pick a track and I\'ll put it on the air!', 'Disc is out. Which one goes on the airwaves?']),
  playing: (song: string) =>
    pick([
      `You're tuned to Playback FM. Up next: "${song}"! Turn it UP!`,
      `"${song}" going out live to the whole city!`,
    ]),
  returned: () => pick(['Back on the wall. Who\'s next on the request line?', 'Racked it! What are we spinning next?']),
  cool: () => pick(['The whole city is feeling this one!', 'Off the charts! Keep it going!']),
  bad: () => pick(['Whoa, signal\'s getting fuzzy. Find the beat!', 'Static on the line! Shake it off!']),
}

export const rhymesFor = (theme: Theme) => (theme === 'street' ? streetRhymes : paperRhymes)
