import type { Track } from '../types'
import { moodLabel, useSongMoodResult } from '../lib/songMood'

export function SongMoodLabel({ track }: { track: Track }) {
  const result = useSongMoodResult(track)
  const label = moodLabel(result)
  return <span className="song-mood" data-status={result.status} title={label.detail} aria-label={label.detail}>
    {label.text}
  </span>
}
