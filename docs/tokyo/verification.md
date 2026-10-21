# Tokyo background verification

The three camera-based concepts were approved before implementation. References, prompts, and the latest six screenshots are in this directory; see [gallery](gallery.md).

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

David rejected the round-10 result as too gray and below the approved concepts, and directed continued iteration against those images. That supersedes the original ten-round cap. The PR remains a draft while this comparison continues.

| Follow-up round | Scores | Average | Outcome |
| --- | --- | --- | --- |
| 11 | 6,7,7,7,8,6,9,9,7,6 | 7.2 | Larger signs, illustrated screens, object-specific palettes. Clipping and muddy lighting remained. |
| 12 | 6,7,6,7,8,6,9,8,6,6 | 6.9 | Ground colors improved, but shadow shading removed printed-art hue and sign glyphs were compressed. Not accepted. |
| 13 | Not scored | — | Corrected world-space light direction, retained texture hue in shadows, and matched sign canvas dimensions to physical faces. |
| 14 | 7,7,7,8,8,7,9,9,7,7 | 7.6 | Lower central skyline, inclined train, concrete detail and textured neon pools. Broad shadows and ramp form still needed work. |
| 15 | Not scored | — | Left screen framing, curved ramp, phone tower placement. |
| 16 | 8,7,7,8,8,8,9,9,8,7 | 7.9 | Broad slate/plum shadows and readable phone tower. Central skyline, railway separation and detailed surface work still short. |
| 17 | 7,8,7,8,8,7,9,9,8,7 | 7.8 | Desktop depth improved; mid-distance mass hid phone tower. Texture and warm/cool balance still needed refinement. |
| 18 | 8,8,7,8,8,8,9,9,8,8 | 8.1 | Three palettes now resemble the targets. Restored phone gap, amber sunset train, cobalt roof and localized neon. Prop fidelity and surface variation still short. |
| 19 | Not scored | — | Raised sign stacks, then identified toolbar clipping to correct in round 20. |
| 20 | 8,8,8,8,8,8,9,9,8,8 | 8.2 | Detailed vending machines, proportioned signs and higher utility wires. Foreground props and sunset light still short. |
| 21 | 9,8,8,8,9,8,9,9,8,8 | 8.4 | Shorter train exposes right signs; stronger stairwell lighting. Poster crop and foreground detail remain. |
| 22 | Not scored | — | Portrait posters, repositioned stairwell door. |
| 23 | 9,8,8,8,9,8,9,9,8,8 | 8.4 | Sixteen-ray AO, metal bevels and ramp tag. Reviewer requests readable equipment shading, unobscured posters and integrated cracks. |
| 24 | Not scored | — | Open tower/sun gap, warmer sunset windows and restored floor vertex AO. |
| 25 | 9,8,8,8,9,9,9,9,8,8 | 8.5 | Clear sun gap, warm windows, unobscured posters and controlled night spill. Lighting approved; foreground finish remains. |
| 26 | 9,9,8,8,9,9,9,9,8,8 | 8.6 | Distinct equipment shading, panels, mounts and canopy supports. Shape detail approved. The intended DPR increase was later found to be reset by Canvas. |
| 27 | Not scored | — | Stable 25-sample shadow filtering replaces randomized five-tap borders. |
| 28 | 9,9,9,8,9,9,9,9,9,8 | 8.8 | Surface detail and technical finish pass. Remaining gap: cel-cloud silhouette and selective illustrated edge treatment. |
| 29 | Not scored | — | Lobed cel clouds replace the exposed ellipse. |
| 30 | 9,9,9,9,9,9,9,10,9,8 | 9.0 | First qualifying primary art review. Cel clouds, selective ink and colored highlights pass the style criterion. |
| 31 | 9,9,9,9,9,9,9,10,9,8 | 9.0 | Corrected Canvas-owned DPR2. All six views confirm the render scale; no art regression. Starts confirmation for this configuration. |
| 32 | 9,9,9,9,9,9,9,10,9,8 | 9.0 | Unchanged confirmation passes. Primary reviewer grants rubric sign-off after consecutive rounds 31 and 32. |

A second reviewer assessed round 28 without seeing previous scores: 8,8,8,9,9,8,9,9,9,8 (8.5). It confirmed clean geometry and distinct colors, and requested more architectural hierarchy, selective light integration and separation between moon and tower. The same fresh reviewer reassessed round 30 at 8.5, retaining its architectural-depth and lighting-integration reservations. These additional reviews are retained rather than substituted for the primary review.

Rounds 31 and 32 meet the primary rubric threshold on the same final rendering configuration, and the primary reviewer grants visual sign-off. Concept fidelity remains its weakest category at 8/10, with more regular geometry and less painterly treatment than the targets. Automated validation is recorded separately from visual acceptance.

## Validation

- Production type-check/build passed on an exact source copy with clean dependencies. macOS intermittently stalls copied native tooling in the Documents directory, so final production bundling used the clean dependency/source copy under `/tmp`. Vite reports its existing large-chunk warning.
- All six final browser captures load the model with no console/page errors and satisfy mesh/material contracts, including signs, screens, train and glow roles.
- Local-time boundary and URL override checks pass.
- Desktop: row button, CD pull/open/play/return, moving train, Paper switch and return to Street all pass.
- Phone 390×800: actual touch swipe between rows, CD tap/open/play/return, moving train, Paper switch and return all pass.
- Blender checks pass for 60 solid mesh batches: manifold edges, consistent edge winding, nonzero areas. Open art/window quads are excluded. Structural kit parts intersect intentionally; this is not a complete proof against all overlapping faces. Visible surfaces were reviewed in screenshots and close-ups.
- Grayscale captures preserve the sampled CD area mean at 190.3/255 desktop and 186.9/255 phone across all three skies. Round-32 background means range 64–95, and 5th–95th percentile ranges exceed 200. These measurements support CD contrast, but do not replace the reviewer's silhouette/squint judgment.
- Blender Workbench render and raw screenshots/JSON are local under `output/tokyo-verification/`. Compressed final evidence is committed in `images/`.

## Recorded cost, for later optimization

The current asset contains 590,640 triangles in 88 mesh batches, 4,164,904 bytes after Draco. Generated atlases total 1,968,280 bytes, excluding the small font and decoder. Visible color geometry including outline passes is approximately 1.16m triangles desktop / 935k phone. Recorded backdrop submissions including shadow/postprocessing passes are 181–198 desktop / 150–151 phone. These exceed the former rendering targets deliberately under the quality-first direction. Headless software WebGL is not an FPS benchmark; real phone smoothness remains unverified.

## Implementation notes

The model uses a fixed seed, material batches, vertex AO (sixteen stratified hemisphere rays per face corner), beveled shapes and Draco compression. Decoder and Japanese font are self-hosted. All eight sign labels are deterministic canvas type over generated backgrounds, including vertical long-vowel marks.

The daytime lights that illuminate CDs remain constant. A separate zero-intensity light supplies city shadow maps with a stable 25-sample PCF filter; only its position changes at sunset. City materials control the mood. Desktop night renders city bloom first and then CDs with their original tone mapping. Phone uses unlit neon without the composer. Street renders at pixel ratio two to preserve thin ink and shadow edges; Paper keeps its original adaptive ratio. Round-32 metrics confirm DPR2 in all six Street views; the flow test confirms DPR1 in Paper on the DPR1 test device. Earlier child-level DPR attempts were reset by Canvas and did not affect rounds 26–30. Train movement and sign pulses use frame callbacks, with no per-frame React state. Reduced motion freezes the train and suppresses flickering/pulsing. Screens continue to cycle available album artwork and idle ads; real Spotify sign-in and cover delivery were not exercised.

## Reproduce

Run `npm install`, `npm run build`, then `npm run preview`. With Node 22.6+ run `node scripts/check-sky.mjs`. With Playwright and Chrome installed, run:

```sh
TOKYO_URL=http://127.0.0.1:4173 TOKYO_OUTPUT=output/tokyo-verification/final node scripts/verify-tokyo.mjs
TOKYO_URL=http://127.0.0.1:4173 node scripts/verify-tokyo-flow.mjs
python scripts/tokyo-values.py output/tokyo-verification/final
```

Pillow is required for the value/squint sheets. Optional `PLAYWRIGHT_MODULE` selects an existing Playwright installation. Rendering verification fails for missing contracts/browser errors; budget overages are recorded as diagnostics. `?verifyTokyo=1` exposes metrics, sign proof and a close-up camera, and fixes train position for comparable screenshots; add `&animateTrain=1` to exercise motion.

Regenerate with Blender: `blender -b -t 4 -P blender/rooftop.py`. Prefix with `TOKYO_RENDER=1` for the fixed-camera Workbench render. Commit the generator and its GLB together.
