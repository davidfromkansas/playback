// Made-up CDs so the shelf can be tried without a Spotify account.
import type { Disc, Track } from '../types'

const ARTISTS = [
  'The Paper Onions', 'DJ Toaster', 'Lil Cardboard', 'Moon Kettle', 'Sunny Side Up', 'Velvet Pancake',
  'MC Scissors', 'Bubble Tea Club', 'Neon Garden', 'Captain Crayon', 'Disco Raccoon', 'The Funky Forks',
]
const WORDS = [
  'Groove', 'Kitchen', 'Rhythm', 'Sunday', 'Believe', 'Rocket', 'Lemon', 'Bounce', 'Snack', 'Cloud',
  'Hustle', 'Sparkle', 'Driving', 'Tiny', 'Big', 'Mellow', 'Hot', 'Cool', 'Paper', 'Stereo', 'Jelly', 'Beat',
]
const PLAYLISTS = ['Morning Hype', 'Cooking Jams', 'Road Trip 2026', 'Rainy Day', 'Gym Bangers', 'Sleepy Time', 'Throwbacks', 'Dance Floor']

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

function tracksFor(title: string, artist: string, count: number, rand: () => number): Track[] {
  return Array.from({ length: count }, (_, i) => {
    const a = WORDS[Math.floor(rand() * WORDS.length)]
    const b = WORDS[Math.floor(rand() * WORDS.length)]
    return {
      uri: `sample:${title}:${i}`,
      name: i === 0 ? `${title} (Intro)` : `${a} ${b}`,
      artists: artist,
      durationMs: 120000 + Math.floor(rand() * 150000),
    }
  })
}

export function sampleLibrary(): Disc[] {
  const rand = rng(42)
  const discs: Disc[] = []
  const liked = tracksFor('Liked Songs', 'Various', 24, rand)
  liked.forEach((t, i) => (t.artists = ARTISTS[i % ARTISTS.length]))
  discs.push({
    id: 'liked', kind: 'liked', title: 'Liked Songs', subtitle: 'You', uri: 'sample:liked',
    spotifyUrl: 'https://open.spotify.com/collection/tracks', trackCount: liked.length, tracks: liked, tracksAvailable: true,
  })
  for (let i = 0; i < 84; i++) {
    const artist = ARTISTS[Math.floor(rand() * ARTISTS.length)]
    const title = `${WORDS[Math.floor(rand() * WORDS.length)]} ${WORDS[Math.floor(rand() * WORDS.length)]}`
    const count = 6 + Math.floor(rand() * 9)
    discs.push({
      id: `album-${i}`, kind: 'album', title, subtitle: artist, uri: `sample:album:${i}`,
      spotifyUrl: 'https://open.spotify.com/', trackCount: count, tracks: tracksFor(title, artist, count, rand),
      addedAt: new Date(Date.UTC(2026, 9, 20) - i * 86400000 * 3).toISOString(), tracksAvailable: true,
    })
  }
  PLAYLISTS.forEach((name, i) => {
    const count = 10 + Math.floor(rand() * 15)
    const tracks = tracksFor(name, 'Various', count, rand)
    tracks.forEach((t) => (t.artists = ARTISTS[Math.floor(rand() * ARTISTS.length)]))
    discs.push({
      id: `playlist-${i}`, kind: 'playlist', title: name, subtitle: 'You', uri: `sample:playlist:${i}`,
      spotifyUrl: 'https://open.spotify.com/', trackCount: count, tracks, tracksAvailable: true,
    })
  })
  return discs
}
