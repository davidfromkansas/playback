// Share Spotify's cooldown across requests and reloads on this origin.
const KEY = 'playback.spotify.retryAt'
let retryAt = 0

export function cooldownRemaining(now = Date.now()): number {
  try {
    const stored = Number(localStorage.getItem(KEY))
    if (Number.isFinite(stored)) retryAt = Math.max(retryAt, stored)
  } catch { /* Storage may be unavailable. Keep the in-memory deadline. */ }
  return Math.max(0, Math.ceil((retryAt - now) / 1000))
}

export function recordCooldown(header: string | null, now = Date.now()): number {
  const seconds = header?.trim() ? Number(header) : NaN
  const wait = Number.isFinite(seconds) && seconds >= 0 ? Math.max(1, seconds) : 30
  retryAt = Math.max(retryAt, now + wait * 1000)
  try { localStorage.setItem(KEY, String(retryAt)) } catch { /* Keep the in-memory deadline. */ }
  return cooldownRemaining(now)
}

export function cooldownMessage(seconds: number): string {
  const wait = seconds < 60 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`
  return `Spotify is limiting requests to Playback. Try again in about ${wait}. You are still signed in.`
}
