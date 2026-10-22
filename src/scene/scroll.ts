export interface ScrollState {
  target: number
  current: number
  max: number
  /** True while a finger or mouse button is down on the stage. */
  held?: boolean
}
