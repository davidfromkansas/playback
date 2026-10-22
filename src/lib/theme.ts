/** Shared renderer styling type. The app now always uses Street. */
export type Theme = 'paper' | 'street'

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
