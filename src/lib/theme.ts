import { useEffect, useState } from 'react'

/** "paper" is the pastel paper-cutout look; "street" is the graffiti rooftop look. */
export type Theme = 'paper' | 'street'

const KEY = 'playback.theme'

function saved(): Theme {
  try {
    return localStorage.getItem(KEY) === 'paper' ? 'paper' : 'street'
  } catch {
    return 'street'
  }
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(saved)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Storage blocked; the theme still applies for this visit.
    }
  }, [theme])
  return [theme, setTheme]
}

/** Canvas text only draws in a web font once that font has loaded. */
export function loadThemeFonts(): Promise<unknown> {
  if (!document.fonts) return Promise.resolve()
  return Promise.all([
    document.fonts.load('40px "Baloo 2"'),
    document.fonts.load('40px "Rubik Spray Paint"'),
    document.fonts.load('40px "Bangers"'),
    document.fonts.load('40px "Permanent Marker"'),
  ]).catch(() => undefined)
}
