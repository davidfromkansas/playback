import { accessToken } from './auth'

const API = 'https://api.spotify.com/v1'
const MAX_RETRIES = 3

export class SpotifyError extends Error {
  constructor(
    public status: number,
    public reason: string,
    message: string,
  ) {
    super(message)
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Calls the Web API. Waits and retries when Spotify says we're asking too often. */
export async function spotify<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API}${path}`
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const wait = Number(res.headers.get('Retry-After') ?? '2')
      await sleep(Math.min(wait, 30) * 1000)
      continue
    }
    if (res.status === 204 || res.status === 202) return undefined as T
    const text = await res.text()
    const json = text ? safeJson(text) : undefined
    if (!res.ok) {
      const err = (json as { error?: { message?: string; reason?: string } } | undefined)?.error
      throw new SpotifyError(res.status, err?.reason ?? '', err?.message ?? `Spotify error ${res.status}`)
    }
    return json as T
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

interface Page<T> {
  items: T[]
  next: string | null
  total: number
}

/** Follows Spotify's 50-at-a-time pages until done. */
export async function allPages<T>(path: string, onProgress?: (loaded: number, total: number) => void): Promise<T[]> {
  const out: T[] = []
  let next: string | null = path
  while (next) {
    const page: Page<T> = await spotify<Page<T>>(next)
    out.push(...page.items)
    onProgress?.(out.length, page.total)
    next = page.next
  }
  return out
}
