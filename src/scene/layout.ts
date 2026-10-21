// Sizes in scene units. A CD jewel case is about 142 x 125 x 10 mm.
export const CASE_W = 1.42
export const CASE_H = 1.25
export const SPINE = 0.12
export const SPACING = 0.15
export const ROW_GAP = 1.6
export const CAMERA_Z = 7

export const ROWS = 3

/** Reading order goes down each column, then across, so scrolling sideways walks the sort order. */
export function slot(index: number, rows: number): { col: number; row: number; x: number; y: number } {
  const col = Math.floor(index / rows)
  const row = index % rows
  return { col, row, x: col * SPACING, y: ((rows - 1) / 2 - row) * ROW_GAP }
}

export function columns(count: number, rows: number): number {
  return Math.max(1, Math.ceil(count / rows))
}

/** Street theme: scroll distance from one CD in the line to the next. */
export const LINE_STEP = 0.6
