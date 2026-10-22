export type VoltDirection = 'left' | 'right' | 'up' | 'down'
export interface VoltNavigation {
  horizontal: { current: number }
  vertical: { current: number }
  enabled: boolean
}
export const VOLT_REACTIONS: Record<VoltDirection, readonly number[]> = {
  left: [0, 176, 177, 178, 179],
  right: [0, 180, 181, 182, 183],
  up: [0, 184, 185, 186, 187],
  down: [0, 188, 189, 190, 191],
}

export function newVoltNavigation() {
  return {
    horizontal: undefined as VoltNavigation['horizontal'] | undefined,
    vertical: undefined as VoltNavigation['vertical'] | undefined,
    x: NaN, y: NaN, quiet: 1, direction: null as VoltDirection | null,
    pose: null as VoltDirection | null, age: 0, settled: 2,
  }
}
export type VoltNavigationMotion = ReturnType<typeof newVoltNavigation>

// Observe the same mutable positions that the shelves render. Switching rows must
// not mistake that row's remembered horizontal position for a fresh swipe.
export function readVoltNavigation(motion: VoltNavigationMotion, input: VoltNavigation | undefined, seconds: number) {
  const dt = Math.max(0, Math.min(seconds, 0.1))
  const x = input?.horizontal.current ?? NaN
  const y = input?.vertical.current ?? NaN
  const dx = motion.horizontal === input?.horizontal && Number.isFinite(motion.x) ? x - motion.x : 0
  const dy = motion.vertical === input?.vertical && Number.isFinite(motion.y) ? y - motion.y : 0
  motion.horizontal = input?.horizontal
  motion.vertical = input?.vertical
  motion.x = x
  motion.y = y
  // Ignore the subpixel tail of easing and initial layout; compare velocity so
  // the threshold behaves the same at 60 and 120 Hz.
  const movingX = Number.isFinite(dx) && Math.abs(dx) > Math.max(dt * 0.045, 0.0001)
  const movingY = Number.isFinite(dy) && Math.abs(dy) > Math.max(dt * 0.045, 0.0001)
  if (input?.enabled && (movingX || movingY)) {
    motion.direction = movingY ? (dy > 0 ? 'down' : 'up') : (dx > 0 ? 'right' : 'left')
    motion.quiet = 0
    motion.settled = 0
  } else {
    motion.quiet += dt
    if (!input?.enabled || motion.quiet > 0.14) motion.direction = null
  }
  if (!motion.direction && !motion.pose) motion.settled += dt
  return motion.direction
}

// Reverse the actual entered drawings before changing direction. No cut to an
// opposite lean, even if a touch gesture reverses halfway through anticipation.
export function advanceVoltNavigation(motion: VoltNavigationMotion, seconds: number, ready: boolean) {
  const dt = Math.max(0, Math.min(seconds, 0.05))
  if (!motion.pose && ready && motion.direction) motion.pose = motion.direction
  if (!motion.pose) return null
  const active = motion.direction === motion.pose && ready
  motion.age = active ? Math.min(4, motion.age + dt * 10) : Math.max(0, motion.age - dt * 12)
  const cel = VOLT_REACTIONS[motion.pose][Math.floor(motion.age)]
  const sample = { cel, state: active ? 'scrolling' : 'settling', direction: motion.pose }
  if (!active && motion.age === 0) motion.pose = null
  return sample
}
