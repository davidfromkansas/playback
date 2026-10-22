import { accessToken } from './auth'
import { cooldownRemaining, recordCooldown, cooldownMessage } from './cooldown'

const API = 'https://api.spotify.com/v1'

export class SpotifyError extends Error {
  constructor(
    public status: number,
    public reason: string,
    message: string,
  ) {
    super(message)
  }
}

/** Calls the Web API; a rate limit pauses subsequent requests until Spotify permits a retry. */
export async function spotify<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${API}${path}`
  {
    const remaining = cooldownRemaining()
    if (remaining) throw new SpotifyError(429, 'rate_limit', cooldownMessage(remaining))
    init.signal?.throwIfAborted()
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.any([AbortSignal.timeout(25000), ...(init.signal ? [init.signal] : [])]),
      headers: {
        Authorization: `Bearer ${await accessToken()}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    if (res.status === 429) {
      const remaining = recordCooldown(res.headers.get('Retry-After'))
      const body = await res.json().catch(() => null) as { error?: { reason?: string } } | null
      const reason = body?.error?.reason ?? 'rate_limit'
      const message = reason === 'QUOTA_EXCEEDED'
        ? 'Spotify’s development-mode quota has been exceeded. This quota is shared across apps on the developer account. Spotify has not provided a quota reset time.'
        : cooldownMessage(remaining)
      throw new SpotifyError(429, reason, message)
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
