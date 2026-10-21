// A steady made-up beat. Spotify no longer gives new apps a song's tempo,
// so the room, the host and the rhythm bar all bounce to this clock instead.
export const BPM = 100
export const BEAT_MS = 60000 / BPM

let start = performance.now()

export function restartBeat(): void {
  start = performance.now()
}

/** Beats since the clock started (fractional). */
export function beatsNow(now = performance.now()): number {
  return (now - start) / BEAT_MS
}

/** 1 right on the beat, fading quickly to 0. */
export function pulse(now = performance.now()): number {
  const phase = beatsNow(now) % 1
  return Math.pow(1 - phase, 6)
}

export function beatTime(beat: number): number {
  return start + beat * BEAT_MS
}
