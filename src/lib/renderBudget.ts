// Texture-size support is not a memory budget. An 8K shadow target is too large for phones.
// Coarse input also covers tablets and landscape phones, independent of viewport width.
export function renderBudget() {
  const mobile = window.matchMedia('(pointer: coarse)').matches
  return { pixelRatio: mobile ? 1.5 : 2, shadowSize: mobile ? 2048 : 8192 }
}
