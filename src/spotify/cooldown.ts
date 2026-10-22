// Share Spotify's cooldown across requests and reloads on this origin.
const KEY = 'playback.spotify.cooldown.v2'
let retryAt = 0
let suppliedBySpotify = false

export function cooldownRemaining(now = Date.now()): number {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (Number.isFinite(stored?.retryAt) && stored.retryAt >= retryAt) {
      retryAt = stored.retryAt
      suppliedBySpotify = stored.suppliedBySpotify === true
    }
  } catch { /* Storage may be unavailable. Keep the in-memory deadline. */ }
  return Math.max(0, Math.ceil((retryAt - now) / 1000))
}

export function recordCooldown(header: string | null, now = Date.now()): number {
  cooldownRemaining(now)
  const seconds = header?.trim() ? Number(header) : NaN
  const supplied = Number.isFinite(seconds) && seconds >= 0
  // Without a provider deadline, pause requests rather than claim to know the reset time.
  const wait = supplied ? Math.max(1, seconds) : 60
  if (now + wait * 1000 >= retryAt) {
    retryAt = now + wait * 1000
    suppliedBySpotify = supplied
  }
  try { localStorage.setItem(KEY, JSON.stringify({ retryAt, suppliedBySpotify })) }
  catch { /* Keep the in-memory deadline. */ }
  return cooldownRemaining(now)
}

export function cooldownMessage(seconds: number): string {
  if (!suppliedBySpotify) {
    return 'Spotify is limiting requests and has not supplied a reset time. Playback has paused requests. '
      + 'You are still signed in; signing in again will not clear the limit.'
  }
  const wait = seconds < 60 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`
  return `Spotify is limiting requests to Playback. Try again in about ${wait}. You are still signed in.`
}
