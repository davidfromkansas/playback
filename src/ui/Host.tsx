// The host: a dancing character with a speech bubble for little rhymes.
import { useEffect, useState } from 'react'
import type { Theme } from '../lib/theme'
import { DJ } from './DJ'
import type { SongMood } from '../lib/songMood'
import type { VoltNavigation } from './voltNavigation'

export function Host({ line, bouncing, theme: _theme, songMood, navigation }: {
  line: string; bouncing: boolean; theme: Theme; songMood?: SongMood; navigation?: VoltNavigation
}) {
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
      <DJ dancing={bouncing} className="host-figure" mood={songMood} navigation={navigation} />
    </div>
  )
}

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

// DJ Volt talks like a pirate-radio host instead of rhyming.
const streetRhymes = {
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

export const rhymesFor = (_theme: Theme) => streetRhymes
