// Plays music in one of four ways:
//  - browser: the Web Playback SDK turns this tab into a Spotify speaker (desktop, Premium)
//  - phone:   phone browsers can't run the SDK, so we tell the Spotify app on the phone to play (Premium)
//  - link:    free accounts can't be controlled, so we open the CD in Spotify instead
//  - sample:  no Spotify at all, streamed catalog previews without Spotify
import type { Disc, Track } from '../types'
import { spotify, SpotifyError } from './api'
import { accessToken } from './auth'

export type PlayerMode = 'sample' | 'browser' | 'phone' | 'link'

export interface NowPlaying {
  error?: string
  buffering?: boolean
  disc: Disc | null
  track: Track | null
  paused: boolean
  positionMs: number
  durationMs: number
  /** When positionMs was measured, so the UI can count forward between updates. */
  measuredAt: number
}

export interface PlayResult {
  ok: boolean
  message?: string
  openUrl?: string
}

interface State {
  mode: PlayerMode
  ready: boolean
  now: NowPlaying
}

const idle: NowPlaying = { disc: null, track: null, paused: true, positionMs: 0, durationMs: 0, measuredAt: 0 }

let state: State = { mode: 'sample', ready: true, now: idle }
const listeners = new Set<() => void>()

function set(patch: Partial<State>): void {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function setNow(patch: Partial<NowPlaying>): void {
  set({ now: { ...state.now, ...patch, measuredAt: Date.now() } })
}

export const playerStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  get: () => state,
}

export function isPhone(): boolean {
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

// ---- Web Playback SDK (desktop) -------------------------------------------

interface SdkTrack {
  uri: string
  name: string
  duration_ms: number
  artists: { name: string }[]
  album?: { images: { url: string }[] }
}

const trackFrom = (t: SdkTrack): Track => ({
  uri: t.uri,
  name: t.name,
  artists: t.artists.map((a) => a.name).join(', '),
  durationMs: t.duration_ms,
  imageUrl: t.album?.images?.[0]?.url,
})
interface SdkState { paused: boolean; position: number; duration: number; track_window: { current_track: SdkTrack | null } }
interface SdkPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  activateElement(): Promise<void>
  seek(position: number): Promise<void>
  togglePlay(): Promise<void>
  nextTrack(): Promise<void>
  previousTrack(): Promise<void>
  addListener(event: string, cb: (arg: never) => void): void
}
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: { Player: new (opts: { name: string; getOAuthToken: (cb: (t: string) => void) => void; volume?: number }) => SdkPlayer }
  }
}

let sdk: SdkPlayer | null = null
let playerGeneration = 0
let deviceId: string | null = null
let deviceWaiters: ((id: string | null) => void)[] = []

function resolveDevice(id: string | null): void {
  deviceId = id
  deviceWaiters.forEach((w) => w(id))
  deviceWaiters = []
}

function waitForDevice(timeoutMs = 8000): Promise<string | null> {
  if (deviceId) return Promise.resolve(deviceId)
  return new Promise((resolve) => {
    deviceWaiters.push(resolve)
    setTimeout(() => resolve(deviceId), timeoutMs)
  })
}

function startSdk(): void {
  const generation = playerGeneration
  window.onSpotifyWebPlaybackSDKReady = () => {
    if (!window.Spotify || generation !== playerGeneration || sdk) return
    sdk = new window.Spotify.Player({
      name: 'Playback (CD shelf)',
      getOAuthToken: (cb) => void accessToken().then(cb),
      volume: 0.8,
    })
    sdk.addListener('ready', ({ device_id }: { device_id: string }) => {
      if (generation !== playerGeneration) return
      set({ ready: true })
      resolveDevice(device_id)
    })
    sdk.addListener('not_ready', () => {
      if (generation !== playerGeneration) return
      deviceId = null
    })
    // Free accounts can't stream in the browser.
    sdk.addListener('account_error', () => {
      if (generation !== playerGeneration) return
      set({ mode: 'link', ready: true })
      resolveDevice(null)
    })
    // Browser without the DRM support Spotify needs: control the Spotify app instead.
    sdk.addListener('initialization_error', () => {
      if (generation !== playerGeneration) return
      set({ mode: 'phone', ready: true })
      startPolling()
      resolveDevice(null)
    })
    sdk.addListener('player_state_changed', (s: SdkState | null) => {
      if (generation !== playerGeneration) return
      if (!s) return
      const t = s.track_window.current_track
      setNow({
        paused: s.paused,
        positionMs: s.position,
        durationMs: s.duration,
        track: t ? trackFrom(t) : null,
      })
    })
    void sdk.connect()
  }
  if (window.Spotify) { window.onSpotifyWebPlaybackSDKReady(); return }
  if (document.querySelector('script[data-playback-sdk]')) return
  const script = document.createElement('script')
  script.dataset.playbackSdk = 'true'
  script.src = 'https://sdk.scdn.co/spotify-player.js'
  script.async = true
  script.onerror = () => {
    script.remove()
    if (generation !== playerGeneration) return
    set({ mode: 'phone', ready: true })
    startPolling()
    resolveDevice(null)
  }
  document.head.appendChild(script)
}

// ---- Spotify app on a phone (Spotify Connect) -----------------------------

let pollTimer: number | undefined
let commandPollTimer: ReturnType<typeof setTimeout> | undefined
let pollController: AbortController | null = null
let lastPollAt = 0

interface ApiPlayback {
  is_playing: boolean
  progress_ms: number | null
  item: SdkTrack | null
}

async function pollPhone(): Promise<void> {
  if (state.mode !== 'phone' || !state.now.disc || pollController || document.visibilityState !== 'visible') return
  const controller = new AbortController()
  pollController = controller
  lastPollAt = Date.now()
  try {
    const p = await spotify<ApiPlayback | undefined>('/me/player', { signal: controller.signal })
    if (controller.signal.aborted || state.mode !== 'phone') return
    if (p?.item) {
      setNow({
        paused: !p.is_playing,
        positionMs: p.progress_ms ?? 0,
        durationMs: p.item.duration_ms,
        track: trackFrom(p.item),
      })
    }
  } catch {
    // The shared API cooldown prevents retries while Spotify is limiting us.
  } finally {
    if (pollController === controller) pollController = null
  }
}

function startPolling(): void {
  window.clearInterval(pollTimer)
  pollTimer = window.setInterval(() => {
    if (Date.now() - lastPollAt >= (state.now.paused ? 30000 : 10000)) void pollPhone()
  }, 10000)
}

// ---- Demo audio ------------------------------------------------------------

let sampleAudio: HTMLAudioElement | null = null

function releaseSampleAudio(): void {
  const previous = sampleAudio
  sampleAudio = null
  if (!previous) return
  previous.pause()
  previous.removeAttribute('src')
  previous.load()
  previous.remove()
}

async function playPreview(disc: Disc, track: Track | null): Promise<PlayResult> {
  releaseSampleAudio()
  setNow({ disc, track, paused: true, buffering: false, error: undefined, positionMs: 0, durationMs: 0 })
  if (!track?.previewUrl) {
    const message = 'No audio preview is available for this song. Try another CD.'
    setNow({ error: message })
    return { ok: false, message }
  }
  const audio = document.createElement('audio')
  sampleAudio = audio
  audio.dataset.demoPreview = 'true'
  audio.preload = 'none'
  audio.src = track.previewUrl
  audio.volume = 0.8
  document.body.appendChild(audio)
  const sync = () => {
    if (sampleAudio !== audio) return
    setNow({ positionMs: audio.currentTime * 1000,
      durationMs: Number.isFinite(audio.duration) ? audio.duration * 1000 : 0,
      paused: audio.paused || audio.ended })
  }
  for (const event of ['timeupdate', 'durationchange', 'pause', 'seeked']) audio.addEventListener(event, sync)
  audio.addEventListener('playing', () => {
    if (sampleAudio !== audio) return
    setNow({ buffering: false, error: undefined })
    sync()
  })
  audio.addEventListener('waiting', () => {
    if (sampleAudio === audio) setNow({ buffering: true, paused: true })
  })
  audio.addEventListener('ended', () => {
    if (sampleAudio === audio) { sync(); setNow({ buffering: false, paused: true }) }
  })
  audio.addEventListener('error', () => {
    if (sampleAudio === audio) setNow({ buffering: false, paused: true,
      error: 'This preview could not load. Try another song or press play to retry.' })
  })
  setNow({ buffering: true })
  try {
    await audio.play()
    return { ok: sampleAudio === audio }
  } catch {
    if (sampleAudio !== audio) return { ok: false }
    const message = 'This preview could not start. Press play to retry, or try another song.'
    setNow({ buffering: false, paused: true, error: message })
    return { ok: false, message }
  }
}

// ---- Public API ------------------------------------------------------------

export function disconnectPlayer(): void {
  releaseSampleAudio()
  playerGeneration++
  window.clearInterval(pollTimer)
  clearTimeout(commandPollTimer)
  pollController?.abort()
  pollController = null
  sdk?.disconnect()
  sdk = null
  resolveDevice(null)
  set({ mode: 'sample', ready: true, now: idle })
}

export function initPlayer(signedIn: boolean): void {
  disconnectPlayer()
  if (!signedIn) {
    set({ mode: 'sample', ready: true })
    return
  }
  if (isPhone()) {
    set({ mode: 'phone', ready: true })
    startPolling()
    return
  }
  set({ mode: 'browser', ready: false })
  startSdk()
}

function playBody(disc: Disc, tracks: Track[], index: number): Record<string, unknown> {
  if (disc.kind === 'track') {
    return disc.contextUri ? { context_uri: disc.contextUri, offset: { uri: disc.uri } } : { uris: [disc.uri] }
  }
  if (disc.kind === 'liked') return { uris: tracks.map((t) => t.uri), offset: { position: index } }
  return { context_uri: disc.uri, offset: { position: index } }
}

async function playOn(device: string | null, disc: Disc, tracks: Track[], index: number): Promise<void> {
  const query = device ? `?device_id=${encodeURIComponent(device)}` : ''
  await spotify(`/me/player/play${query}`, { method: 'PUT', body: JSON.stringify(playBody(disc, tracks, index)) })
}

const premiumMessage = 'Playing inside Playback needs Spotify Premium, so this CD will open in Spotify instead.'

export async function play(disc: Disc, tracks: Track[], index = 0): Promise<PlayResult> {
  const track = tracks[index] ?? null
  if (state.mode === 'sample') return playPreview(disc, track)
  if (state.mode === 'link') return { ok: false, message: premiumMessage, openUrl: disc.spotifyUrl }

  try {
    if (state.mode === 'browser') {
      await sdk?.activateElement()
      const id = await waitForDevice()
      // The SDK may have switched us to another mode while we waited.
      if (state.mode !== 'browser') return play(disc, tracks, index)
      if (!id) return { ok: false, message: 'The in-browser player is still warming up. Try again in a moment.' }
      await playOn(id, disc, tracks, index)
    } else {
      try {
        await playOn(null, disc, tracks, index)
      } catch (e) {
        if (!(e instanceof SpotifyError) || e.status !== 404) throw e
        // No active device: wake up the Spotify app on this phone if it's open.
        const { devices } = await spotify<{ devices: { id: string; type: string }[] }>('/me/player/devices')
        const target = devices.find((d) => d.type === 'Smartphone') ?? devices[0]
        if (!target) {
          return {
            ok: false,
            message: 'Open the Spotify app on this phone, then come back and press play again.',
            openUrl: disc.spotifyUrl,
          }
        }
        await playOn(target.id, disc, tracks, index)
      }
      void pollPhone()
    }
    setNow({ disc, track, paused: false, positionMs: 0, durationMs: track?.durationMs ?? 0 })
    return { ok: true }
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 403) {
      set({ mode: 'link' })
      return { ok: false, message: premiumMessage, openUrl: disc.spotifyUrl }
    }
    return { ok: false, message: (e as Error).message }
  }
}

async function phoneCommand(path: string, method: 'PUT' | 'POST'): Promise<void> {
  try {
    await spotify(path, { method })
  } catch {
    // Ignore; the next poll shows the real state.
  }
  clearTimeout(commandPollTimer)
  if (state.mode === 'phone') commandPollTimer = setTimeout(() => void pollPhone(), 500)
}

export async function togglePause(): Promise<void> {
  const { mode, now } = state
  if (mode === 'sample') {
    if (!sampleAudio || sampleAudio.error) {
      if (now.disc) await playPreview(now.disc, now.track)
      return
    }
    if (!sampleAudio.paused) { sampleAudio.pause(); return }
    if (sampleAudio.ended) sampleAudio.currentTime = 0
    try { await sampleAudio.play() }
    catch { setNow({ paused: true, buffering: false, error: 'Could not resume the preview. Press play to retry.' }) }
    return
  }
  if (mode === 'browser' && sdk) return sdk.togglePlay()
  if (mode === 'phone') {
    setNow({ paused: !now.paused, positionMs: livePosition(now) })
    return phoneCommand(now.paused ? '/me/player/play' : '/me/player/pause', 'PUT')
  }
  setNow({ paused: !now.paused, positionMs: livePosition(now) })
}

export async function skip(direction: 1 | -1): Promise<void> {
  const { mode, now } = state
  if (mode === 'browser' && sdk) return direction > 0 ? sdk.nextTrack() : sdk.previousTrack()
  if (mode === 'phone') return phoneCommand(direction > 0 ? '/me/player/next' : '/me/player/previous', 'POST')
  // Sample mode: step through the disc's own list.
  const list = now.disc?.tracks ?? []
  if (!list.length) return
  const i = list.findIndex((t) => t.uri === now.track?.uri)
  const next = list[(i + direction + list.length) % list.length]
  if (now.disc) await playPreview(now.disc, next)
}

export function stop(): void {
  releaseSampleAudio()
  if (state.mode === 'browser' && sdk && !state.now.paused) void sdk.togglePlay()
  if (state.mode === 'phone' && !state.now.paused) void phoneCommand('/me/player/pause', 'PUT')
  set({ now: idle })
}

/** Current position, counting forward from the last update while playing. */
export function livePosition(now: NowPlaying): number {
  if (state.mode === 'sample' && sampleAudio && now === state.now) return sampleAudio.currentTime * 1000
  if (now.paused) return now.positionMs
  return Math.min(now.positionMs + (Date.now() - now.measuredAt), now.durationMs || Infinity)
}

/** Seek within the current track without changing play/pause state. */
export async function seek(positionMs: number): Promise<void> {
  if (!state.now.disc || !state.now.durationMs || state.mode === 'link') return
  const position = Math.round(Math.max(0, Math.min(positionMs, state.now.durationMs)))
  if (state.mode === 'sample' && sampleAudio) {
    sampleAudio.currentTime = position / 1000
  } else if (state.mode === 'browser') {
    if (!sdk) throw new Error('The Spotify player is still connecting.')
    await sdk.seek(position)
  } else if (state.mode === 'phone') {
    await spotify(`/me/player/seek?position_ms=${position}`, { method: 'PUT' })
  }
  setNow({ positionMs: position })
}
