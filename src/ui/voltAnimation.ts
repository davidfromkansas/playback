import { BPM } from '../lib/beat'

export const VOLT_WIDTH = 400
export const VOLT_HEIGHT = 380
export const VOLT_COLUMNS = 8
export const VOLT_CELS = 176
const idle = [0, 1, 2, 3, 2, 1]
const bridge = [16, 17, 18, 19, 20, 21, 22, 23]
const holster = [72, 73, 74, 75, 76, 77, 78, 79]
const handsFree = (start: number, holds: number[] = [0, 1, 2, 3, 4, 5, 6, 7]) =>
  [79, ...holds.map(i => start + i), 79]
export const VOLT_ROUTINES = [
  { id: 'groove', label: 'Rooftop groove', beats: 2, cels: [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 24] },
  // The generated chop cel has an extra arm. Use the clean punch and its complete return instead.
  { id: 'punch', label: 'Punch the beat', beats: 2, cels: [24, 36, 37, 38, 39, 40, 39, 38, 37, 36, 24] },
  { id: 'duck', label: 'Duck & bounce', beats: 2, cels: [24, 48, 49, 50, 51, 52, 53, 54, 53, 52, 51, 50, 49, 48, 24] },
  { id: 'wave', label: 'Crowd wave', beats: 2, cels: [24, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 24] },
  { id: 'bart', label: 'Bart Simpson', beats: 2, cels: handsFree(80) },
  { id: 'running', label: 'Running Man', beats: 2, cels: handsFree(88) },
  { id: 'rabbit', label: 'Roger Rabbit', beats: 2, cels: handsFree(96) },
  { id: 'cabbage', label: 'Cabbage Patch', beats: 2, cels: handsFree(104) },
  { id: 'smurf', label: 'Smurf', beats: 2, cels: handsFree(112) },
  { id: 'points', label: 'Locking points', beats: 2, cels: handsFree(120) },
  // Omit source cel 3: the outstretched fingertip reaches the source boundary.
  { id: 'armwave', label: 'Arm wave', beats: 2, cels: handsFree(128, [0, 1, 2, 4, 5, 6, 7]) },
  { id: 'toprock', label: 'Cross-step toprock', beats: 2, cels: handsFree(136) },
  { id: 'sixstep', label: 'Six-step', beats: 4, cels: handsFree(144) },
  { id: 'freeze', label: 'Baby freeze', beats: 4, cels: handsFree(152, [0, 1, 2, 3, 4, 4, 4, 4, 5, 6, 2, 1, 7]) },
  { id: 'backspin', label: 'Backspin', beats: 4, cels: handsFree(160, [0, 1, 2, 3, 4, 5, 3, 4, 5, 6, 1, 7]) },
  { id: 'windmill', label: 'Windmill', beats: 4, cels: handsFree(168, [0, 1, 2, 3, 4, 5, 2, 3, 4, 5, 6, 1, 7]) },
] as const
export type VoltRoutine = typeof VOLT_ROUTINES[number]['id']
export type VoltSelection = VoltRoutine | 'auto'
export interface VoltMotion { entry: number; equipment: number; phase: number; idlePhase: number; routine: number; loops: number }
export interface VoltSample {
  cel: number
  state: 'idle' | 'enter' | 'playing' | 'exit'
  routine: VoltRoutine
}
export const newVoltMotion = (): VoltMotion => ({ entry: 0, equipment: 0, phase: 0, idlePhase: 0, routine: 0, loops: 0 })

export function advanceVolt(
  motion: VoltMotion, seconds: number, dancing: boolean, selection: VoltSelection = 'auto',
  allowed?: readonly VoltRoutine[],
): VoltSample {
  const dt = Math.max(0, Math.min(seconds, 0.05))
  const end = bridge.length - 1
  const sample = (cel: number, state: VoltSample['state']): VoltSample =>
    ({ cel, state, routine: VOLT_ROUTINES[motion.routine].id })
  const currentCel = () => {
    const cels = VOLT_ROUTINES[motion.routine].cels
    return cels[Math.min(cels.length - 1, Math.floor(motion.phase * cels.length))]
  }
  if (dancing && motion.entry < end) {
    motion.entry = Math.min(end, motion.entry + dt * 10)
    motion.phase = 0
    if (selection !== 'auto') motion.routine = VOLT_ROUTINES.findIndex(r => r.id === selection)
    else if (allowed?.length) motion.routine = VOLT_ROUTINES.findIndex(r => r.id === allowed[0])
    return sample(bridge[Math.round(motion.entry)], 'enter')
  }
  if (!dancing && motion.entry > 0) {
    // Finish this routine's recovery, even if pause arrives at the deepest duck.
    if (motion.phase > 0) {
      motion.phase = Math.min(1, motion.phase + dt * BPM / (60 * VOLT_ROUTINES[motion.routine].beats))
      if (motion.phase < 1) return sample(currentCel(), 'exit')
      motion.phase = 0
    }
    if (motion.equipment > 0) {
      motion.equipment = Math.max(0, motion.equipment - dt * 10)
      return sample(holster[Math.round(motion.equipment)], 'exit')
    }
    motion.entry = Math.max(0, motion.entry - dt * 10)
    return sample(bridge[Math.round(motion.entry)], 'exit')
  }
  if (dancing) {
    const targetEquipment = motion.routine >= 4 ? 7 : 0
    if (motion.equipment !== targetEquipment) {
      motion.equipment += Math.sign(targetEquipment - motion.equipment) * Math.min(dt * 10, Math.abs(targetEquipment - motion.equipment))
      return sample(holster[Math.round(motion.equipment)], 'enter')
    }
    motion.phase += dt * BPM / (60 * VOLT_ROUTINES[motion.routine].beats)
    if (motion.phase >= 1) {
      motion.phase %= 1
      motion.loops++
      // Every routine gets eight beats. Change only after its recovery to the shared neutral.
      if (selection !== 'auto') {
        motion.routine = VOLT_ROUTINES.findIndex(r => r.id === selection)
        motion.loops = 0
      } else if (motion.loops * VOLT_ROUTINES[motion.routine].beats >= 8) {
        if (allowed?.length) {
          const index = allowed.indexOf(VOLT_ROUTINES[motion.routine].id)
          const next = allowed[(index + 1) % allowed.length]
          motion.routine = VOLT_ROUTINES.findIndex(r => r.id === next)
        } else motion.routine = (motion.routine + 1) % VOLT_ROUTINES.length
        motion.loops = 0
      }
    }
    if (motion.equipment !== (motion.routine >= 4 ? 7 : 0)) {
      return sample(holster[Math.round(motion.equipment)], 'enter')
    }
    return sample(currentCel(), 'playing')
  }
  motion.idlePhase = (motion.idlePhase + dt * idle.length / 2.4) % idle.length
  return sample(idle[Math.floor(motion.idlePhase)], 'idle')
}
