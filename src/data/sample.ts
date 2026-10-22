// Public catalog selections for filming. Listening history and moods are fictional.
import type { Disc, Track } from '../types'
import catalog from './filming-catalog.json'

const moods = ['playful', 'euphoric', 'melancholic', 'romantic', 'confident', 'joyful',
  'nostalgic', 'dreamy', 'majestic', 'relaxed', 'defiant', 'driving', 'restless', 'funky']

export function sampleLibrary(): Disc[] {
  const groups = catalog.map((group, i) => ({ ...group,
    tracks: group.tracks.slice(0, i < 6 ? 10 : 5).map(track => ({ ...track, demoMood: moods[i] })),
  }))
  const select = (...ids: string[]): Track[] => {
    const selected = ids.map(id => groups.find(group => group.id === id)?.tracks ?? [])
    return Array.from({ length: 10 }, (_, i) => selected.flatMap(tracks => tracks[i] ? [tracks[i]] : [] )).flat()
  }
  const playlists: [string, string[]][] = [
    ['Pop Rotation', ['sabrina', 'dua', 'chappell', 'taylor']],
    ['After Hours', ['weeknd', 'billie', 'd4vd']],
    ['Dancefloor', ['dua', 'chappell', 'flume']],
    ['Soft Focus', ['billie', 'taylor', 'labi']],
    ['Road Trip', ['sabrina', 'bastille', 'cinema']],
    ['Electronic Escape', ['flume', 'tron', 'weeknd']],
    ['Hip Hop Mix', ['jid']],
    ['Golden Hour', ['labi', 'd4vd', 'taylor']],
    ['Funk Classics', ['funk', 'labi']],
    ['Soundtrack Sessions', ['tron']],
  ]
  const disc = (id: string, kind: Disc['kind'], title: string, tracks: Track[], subtitle: string): Disc => ({
    id, kind, title, subtitle, tracks, trackCount: tracks.length, tracksAvailable: true,
    uri: `sample:${id}`, spotifyUrl: '', imageUrl: tracks[0]?.imageUrl,
  })
  const albums = new Map<string, typeof groups[number]['tracks']>()
  for (const group of groups) for (const track of group.tracks) {
    const key = `${track.artists} — ${track.album}`
    albums.set(key, [...(albums.get(key) ?? []), track])
  }
  return [
    disc('liked', 'liked', 'Liked Songs', select('sabrina', 'dua', 'billie', 'taylor', 'weeknd', 'chappell', 'labi', 'flume'), 'Demo collection'),
    ...playlists.map(([title, ids], i) => disc(`playlist-${i}`, 'playlist', title, select(...ids), 'Demo mix')),
    ...[...albums.values()].map((tracks, i) => disc(`album-${i}`, 'album', tracks[0].album, tracks, tracks[0].artists)),
  ]
}
