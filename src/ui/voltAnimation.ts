import { BPM } from '../lib/beat'

export const VOLT_WIDTH = 280
export const VOLT_HEIGHT = 340
export const VOLT_COLUMNS = 8
// Complete drawings, registered to the same skate line. Reversing the path avoids a loop seam.
const idle = [0, 1, 2, 3, 2, 1]
const bridge = [16, 17, 18, 19, 20, 21, 22, 23]
const groove = [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35]
export interface VoltMotion { entry: number; phase: number }
export interface VoltSample { cel: number; state: 'idle' | 'enter' | 'playing' | 'exit' }
export const newVoltMotion = (): VoltMotion => ({ entry: 0, phase: 0 })

export function advanceVolt(motion: VoltMotion, seconds: number, dancing: boolean): VoltSample {
  const dt = Math.max(0, Math.min(seconds, 0.05))
  const end = bridge.length - 1
  if (dancing && motion.entry < end) {
    motion.entry = Math.min(end, motion.entry + dt * 10)
    motion.phase = 0
    return { cel: bridge[Math.round(motion.entry)], state: 'enter' }
  }
  if (!dancing && motion.entry > 0) {
    // Finish the current weight transfer before lowering the microphone.
    if (motion.phase > 0) {
      motion.phase = Math.min(groove.length, motion.phase + dt * groove.length * BPM / 120)
      if (motion.phase < groove.length) return { cel: groove[Math.floor(motion.phase)], state: 'exit' }
      motion.phase = 0
    }
    motion.entry = Math.max(0, motion.entry - dt * 10)
    return { cel: bridge[Math.round(motion.entry)], state: 'exit' }
  }
  if (dancing) {
    motion.phase = (motion.phase + dt * groove.length * BPM / 120) % groove.length
    return { cel: groove[Math.floor(motion.phase)], state: 'playing' }
  }
  motion.phase = (motion.phase + dt * idle.length / 2.4) % idle.length
  return { cel: idle[Math.floor(motion.phase)], state: 'idle' }
}
