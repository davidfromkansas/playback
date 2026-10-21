# Tokyo background verification

The three camera-based concepts were approved before implementation. References, prompts, and the final six screenshots are in this directory; see [gallery](gallery.md).

David subsequently directed us to prioritize model quality and defer performance optimization. The former triangle, draw-call, and file-size limits are therefore diagnostics, not acceptance gates for this pass.

## Independent art reviews

Rubric order: silhouette/composition; shape detail; surface detail; style; Tokyo authenticity; lighting; CD focus; text correctness; technical cleanliness; concept match. An independent reviewer inspected the screenshots and concepts. Scores are not self-assigned.

| Round | Scores | Average | Changes / outcome |
| --- | --- | --- | --- |
| Geometry | Unscored | — | Tower gap, varied skyline, train/fence separation requested and implemented. |
| 1 | 6,5,4,6,6,5,7,7,6,4 | 5.6 | Initial city. Repeated grime, dark floor, obscured tower and night cover clipping identified. |
| 2 | 6,6,6,6,6,6,7,7,7,5 | 6.2 | Cleaner facades, brighter floor, rooftop setbacks. Night cover clipping remained. |
| 3 | 6,6,6,6,7,7,9,7,7,6 | 6.7 | Separate city bloom from CD rendering; lowered screens, train doors/stripe, projecting balconies. |
| 4 | 6,6,6,6,7,7,9,7,7,6 | 6.7 | Explicit colored toon bands and leaner bloom. Architecture still flat. |
| 5 | 7,7,7,7,7,7,9,7,8,6 | 7.2 | Quality priority: modeled window casings, stairs, railings, ducts, dishes, ACs; darker train glazing. |
| 6 | 7,7,7,7,7,7,9,7,7,6 | 7.1 | Cast shadows and relocated tower. Phone tower crop regressed; corrected next pass. |
| 7 | 8,7,7,7,8,7,9,7,8,6 | 7.4 | Phone sign/tower staging, deck details, localized vending spill, darker night base. |
| 8 | 8,7,7,7,8,7,9,9,8,6 | 7.6 | Angled frontages, rounded train/cab, pantograph/glass reflections, finer shadows, floor-only light spill. Sign proof verified. |
| 9 | 8,7,7,7,8,7,9,9,8,6 | 7.6 | Finer fence, quieter ground, warmer/cooler windows, ramp art, golden/plum sunset palette. |
| 10 | 8,7,7,8,8,8,9,9,8,7 | 7.9 | Visible sun, long diagonal sunset shadows, illuminated tower lattice. Best version, but no art sign-off. |

The plan's ten-round cap was reached. The required minimum of 8 on every line and average of 9 for two consecutive rounds was **not achieved**. Remaining gaps: simpler architecture and commercial density than the concepts; repetitive surfaces and plain areas; less rich localized night glow. Bright tower decks lose detail and the tower is still faint in phone squint views. This PR remains a draft.

## Validation

- Production type-check/build passed on an exact source copy with clean dependencies. The same final source also passes a direct type-check in the checkout. macOS intermittently stalls copied native tooling in the Documents directory, so final production bundling used the clean dependency/source copy under `/tmp`. Vite reports its existing large-chunk warning.
- All six final browser captures load the model with no console/page errors and satisfy mesh/material contracts, including signs, screens, train and glow roles.
- Local-time boundary and URL override checks pass.
- Desktop: row button, CD pull/open/play/return, moving train, Paper switch and return to Street all pass.
- Phone 390×800: actual touch swipe between rows, CD tap/open/play/return, moving train, Paper switch and return all pass.
- Blender checks pass for 53 solid mesh batches: manifold edges, consistent edge winding, nonzero areas. Open art/window quads are excluded. Structural kit parts intersect intentionally; this is not a complete proof against all overlapping faces. Visible surfaces were reviewed in screenshots and close-ups.
- Grayscale captures preserve the sampled CD area mean at 192/255 desktop and 189/255 phone across all three skies. Background means range 50–137, and 5th–95th percentile ranges exceed 200. These measurements support CD contrast, but do not replace the reviewer's silhouette/squint judgment.
- Final Blender Workbench render and raw screenshots/JSON are local under `output/tokyo-verification/`. Compressed final evidence is committed in `images/`.

## Recorded cost, for later optimization

The asset contains 230,618 triangles in 83 mesh batches, 1,492,588 bytes after Draco. Generated atlases total 653,804 bytes, excluding the small font and decoder. Visible color geometry including outline passes is approximately 432k triangles desktop / 417k phone. Recorded backdrop submissions including shadow/postprocessing passes are 158–170 desktop / 139 phone. These exceed the former rendering targets deliberately under the quality-first direction. Headless software WebGL is not an FPS benchmark; real phone smoothness remains unverified.

## Implementation notes

The model uses a fixed seed, material batches, vertex AO (four geometric hemisphere rays per face corner), beveled shapes and Draco compression. Decoder and Japanese font are self-hosted. All eight sign labels are deterministic canvas type over generated backgrounds, including vertical long-vowel marks.

The daytime lights that illuminate CDs remain constant. A separate zero-intensity light supplies city shadow maps; only its position changes at sunset. City materials control the mood. Desktop night renders city bloom first and then CDs with their original tone mapping. Phone uses unlit neon without the composer. Train movement and sign pulses use frame callbacks, with no per-frame React state. Reduced motion freezes the train and suppresses flickering/pulsing. Screens continue to cycle available album artwork and idle ads; real Spotify sign-in and cover delivery were not exercised.

## Reproduce

Run `npm install`, `npm run build`, then `npm run preview`. With Node 22.6+ run `node scripts/check-sky.mjs`. With Playwright and Chrome installed, run:

```sh
TOKYO_URL=http://127.0.0.1:4173 TOKYO_OUTPUT=output/tokyo-verification/final node scripts/verify-tokyo.mjs
TOKYO_URL=http://127.0.0.1:4173 node scripts/verify-tokyo-flow.mjs
python scripts/tokyo-values.py output/tokyo-verification/final
```

Pillow is required for the value/squint sheets. Optional `PLAYWRIGHT_MODULE` selects an existing Playwright installation. Rendering verification fails for missing contracts/browser errors; budget overages are recorded as diagnostics. `?verifyTokyo=1` exposes metrics, sign proof and a close-up camera, and fixes train position for comparable screenshots; add `&animateTrain=1` to exercise motion.

Regenerate with Blender: `blender -b -t 4 -P blender/rooftop.py`. Prefix with `TOKYO_RENDER=1` for the fixed-camera Workbench render. Commit the generator and its GLB together.
