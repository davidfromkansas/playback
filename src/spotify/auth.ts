// Spotify login with Authorization Code + PKCE. Runs fully in the browser,
// so no client secret and no server are needed.

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'

// "streaming", "user-read-email" and "user-read-private" are required by the
// Web Playback SDK; the player scopes let us start music on the user's phone.
const SCOPES = [
  'user-library-read',
  'playlist-read-private',
  'playlist-read-collaborative',
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-recently-played',
  'user-top-read',
]

const STORE_KEY = 'playback.auth'
const VERIFIER_KEY = 'playback.verifier'
const STATE_KEY = 'playback.state'

interface Tokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export const clientId: string = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? ''

export function redirectUri(): string {
  return import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${location.origin}/`
}

export function isConfigured(): boolean {
  return clientId.length > 0
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage blocked (private mode). Login still works for this page load.
  }
}

function randomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function login(): Promise<void> {
  const verifier = randomString(64)
  const state = randomString(16)
  write(VERIFIER_KEY, verifier)
  write(STATE_KEY, state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    redirect_uri: redirectUri(),
    state,
  })
  location.assign(`${AUTHORIZE_URL}?${params}`)
}

export function logout(): void {
  memory = null
  write(STORE_KEY, null)
}

let memory: Tokens | null = read<Tokens>(STORE_KEY)

function save(json: { access_token: string; refresh_token?: string; expires_in: number }): void {
  memory = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? memory?.refreshToken ?? '',
    // Refresh a minute early so a request never goes out with a dead token.
    expiresAt: Date.now() + (json.expires_in - 60) * 1000,
  }
  write(STORE_KEY, memory)
}

async function tokenRequest(body: Record<string, string>): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, ...body }),
  })
  if (!res.ok) throw new Error(`Spotify login failed (${res.status})`)
  save(await res.json())
}

/** Finishes login if Spotify just sent the user back to us. Returns an error message, if any. */
export async function handleRedirect(): Promise<string | null> {
  const url = new URL(location.href)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  const returnedState = url.searchParams.get('state')
  if (!code && !error) return null

  url.search = ''
  history.replaceState(null, '', url.toString())

  if (error) return error === 'access_denied' ? 'Login was cancelled.' : `Spotify said: ${error}`
  const verifier = read<string>(VERIFIER_KEY)
  const state = read<string>(STATE_KEY)
  write(VERIFIER_KEY, null)
  write(STATE_KEY, null)
  if (!verifier || !code || state !== returnedState) return 'Login expired. Please try again.'
  try {
    await tokenRequest({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      code_verifier: verifier,
    })
    return null
  } catch (e) {
    return (e as Error).message
  }
}

export function isLoggedIn(): boolean {
  return memory !== null
}

let refreshing: Promise<void> | null = null

export async function accessToken(): Promise<string> {
  if (!memory) throw new Error('Not logged in')
  if (Date.now() >= memory.expiresAt) {
    refreshing ??= tokenRequest({
      grant_type: 'refresh_token',
      refresh_token: memory.refreshToken,
    }).finally(() => {
      refreshing = null
    })
    try {
      await refreshing
    } catch (e) {
      logout()
      throw e
    }
  }
  return memory!.accessToken
}
