// Public catalog selections for filming. Listening history and moods are fictional.
import type { Disc, Track } from '../types'
import catalog from './filming-catalog.json'

const moods: Record<string, string> = {
  sabrina: 'playful', dua: 'euphoric', billie: 'melancholic', weeknd: 'romantic',
  labi: 'nostalgic', flume: 'dreamy', tron: 'driving', d4vd: 'dreamy',
  jid: 'confident', bastille: 'confident', cinema: 'driving',
  kendrick: 'confident', queen: 'defiant', foofighters: 'defiant', rhcp: 'defiant', miles: 'relaxed', classical: 'solemn',
  coltrane: 'relaxed', ella: 'relaxed', shakira: 'joyful', balvin: 'joyful',
  wizkid: 'funky', rema: 'funky', blackpink: 'euphoric', twice: 'euphoric',
  cash: 'nostalgic', willie: 'nostalgic', gould: 'solemn', hilary: 'solemn',
  lana: 'melancholic', adele: 'melancholic', katy: 'playful', sade: 'romantic',
  bonobo: 'dreamy', stevie: 'nostalgic', hans: 'driving',
  latin: 'joyful', afrobeats: 'funky', kpop: 'euphoric', country: 'nostalgic',
}

export function sampleLibrary(): Disc[] {
  const groups = catalog.map(group => ({ ...group,
    tracks: group.tracks.map((track, i) => ({ ...track, demoMood: moods[group.id]
      ?? (group.id === 'chappell' ? (i < 5 ? 'playful' : 'euphoric')
        : group.id === 'taylor' ? (i < 5 ? 'melancholic' : 'romantic')
          : i < 5 ? 'nostalgic' : 'confident') })),
  }))
  const select = (...ids: string[]): Track[] => {
    const selected = ids.map(id => groups.find(group => group.id === id)?.tracks ?? [])
    const seen = new Set<string>()
    return Array.from({ length: Math.max(0, ...selected.map(tracks => tracks.length)) },
      (_, i) => selected.flatMap(tracks => tracks[i] ? [tracks[i]] : [])).flat().filter(track => {
      const cover = track.imageUrl ?? track.uri
      if (seen.has(cover)) return false
      seen.add(cover)
      return true
    })
  }
  const playlists: [string, string[]][] = [
    ['Pop Rotation', ['sabrina', 'dua', 'chappell', 'taylor']],
    ['Rock Essentials', ['queen', 'foofighters', 'rhcp']],
    ['Jazz Lounge', ['miles', 'coltrane', 'ella']],
    ['Latin Rotation', ['latin', 'shakira', 'balvin']],
    ['Afrobeats', ['afrobeats', 'wizkid', 'rema']],
    ['K-Pop', ['kpop', 'blackpink', 'twice']],
    ['Country Classics', ['country', 'cash', 'willie']],
    ['Classical Focus', ['classical', 'gould', 'hilary']],
    ['After Hours', ['weeknd', 'billie', 'd4vd']],
    ['Dancefloor', ['dua', 'chappell', 'flume']],
    ['Soft Focus', ['billie', 'taylor', 'labi']],
    ['Road Trip', ['sabrina', 'bastille', 'cinema']],
    ['Electronic Escape', ['flume', 'tron', 'weeknd']],
    ['Hip Hop Mix', ['kendrick', 'jid']],
    ['Golden Hour', ['labi', 'd4vd', 'taylor']],
    ['Funk Classics', ['funk', 'labi']],
    ['Soundtrack Sessions', ['tron', 'flume']],
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
    disc('liked', 'liked', 'Liked Songs', select('kendrick', 'dua', 'queen', 'latin', 'miles', 'afrobeats', 'kpop', 'country', 'classical', 'flume', 'labi', 'billie', 'sabrina', 'chappell', 'taylor', 'weeknd'), 'Demo collection'),
    ...playlists.map(([title, ids], i) => disc(`playlist-${i}`, 'playlist', title, select(...ids), 'Demo mix')),
    ...[...albums.values()].map((tracks, i) => disc(`album-${i}`, 'album', tracks[0].album, tracks, tracks[0].artists)),
  ]
}
