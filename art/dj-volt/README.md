# DJ Volt — Asian redesign

Original Asian male pirate-radio host, early twenties. Lime hair, cyan forehead goggles,
pink headphones, orange 99 jersey, purple cargo trousers, ivory inline skates and a microphone.
Front three-quarter view, facing slightly right. The user's skating-game and extreme-sports
references informed the silhouette and cel shading; no franchise character assets are shipped.

## Sources

Generated with the built-in image_gen tool. Exact prompts are in `prompts.json`.

- `model-sheet.png`: initial concept, superseded by the user's Asian male direction.
- `superseded-idle.png`: generated before that direction; not used at runtime.
- `asian-model-sheet.png`: revised identity and action study.
- `sequence-source.png`: 16 complete cels; first four used for listening. Remaining poses retained for inspection.
- `bridge-source.png`: eight microphone-lift drawings, played in reverse on return.
- `dance-source.png`: 12 groove drawings. Runtime preserves the authored full loop order.

Sources are immutable. `registration.json` records source hashes, crops, sheet-wide uniform scales,
whole-body offsets and skate registration. No limbs are detached, no per-pose height normalization,
and no silhouette crossfade is used. Alpha wheel extents are registration aids, not anatomical proof.

## Runtime

`src/ui/DJ.tsx` draws from the WebP atlas onto a 400 × 380 transparent canvas. The ground line is
Y=364 and skate midpoint X=200 in canvas pixels. CSS retains the existing 198px desktop / 137px
phone footprint in height. Canvas is a DOM overlay, independent of the Three.js camera.
Playback's existing `playing` boolean remains authoritative; Spotify and app actions are unchanged.
The drawing selector updates via requestAnimationFrame without React updates on every frame.
Idle lasts 2.4 seconds; standing routines last two 100 BPM beats and floor routines four; the entry takes 0.7 seconds.
Pause finishes a weight transfer before reversing the entry. Mid-entry interruptions reverse in place.
Reduced motion displays a stationary listening or performance drawing.

## Reproduce and inspect

Install `sharp` in your tooling environment, then run:

```sh
ART_RUNTIME=/absolute/path/to/tooling/package.json node scripts/characters/prepare-volt.mjs
npm run dev
```

Open `/character-preview.html` on that dev server for the original and new character side by side,
normal speed, quarter speed and all 176 cels. This page is development-only and excluded from the main build.
The original SVG is preserved in `previews/DJBaseline.tsx`.

With Playwright available:

```sh
VOLT_URL=http://127.0.0.1:5173 PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify-volt.mjs
```

The harness uses an existing dev server, closes its own browser, saves actual browser recording,
frame timestamps, screenshots and a deterministic input trace in a unique `output/dj-volt/` directory.
The fixture checks the production animation selector, not real Spotify or gameplay simulation.
Combat/collision/facing/landing gates in the supplied general-purpose skill do not apply to this host.

Sixteen playing routines now cycle every eight beats. See `dance-references.md` for research, choreography,
rejected drawings and source provenance. The preview includes an automatic-cycle option and individual routines.

## Expanded street and breaking set

The twelve additions are Bart Simpson, Running Man, Roger Rabbit, Cabbage Patch, Smurf,
locking points, arm wave, cross-step toprock, six-step, baby freeze, backspin and windmill.
Each has an eight-drawing whole-body source family. These are stylized skate adaptations,
not instructional dance demonstrations. A separate eight-cel mic-holstering transition frees
both hands and reverses before returning to listening. The mic stays holstered between new routines.
Freeze accents hold longer; spins repeat their rotation drawings before returning through a crouch.

`expanded-prompts.json` and `expanded-repairs.json` preserve built-in generation prompts and
result paths. Rejected sources preserve background/cropping defects. The first Bart attempt
also had an extra arm; its native output is retained outside the runtime sources.
The arm-wave's clipped fourth source drawing is not selected. All atlas drawings remain
inspectable, including unused drawings; selection is in `src/ui/voltAnimation.ts`.

All expanded sheets use one scale calibrated from their standing neutral to 300 pixels.
Floor poses use their full silhouette center and lowest support as a registration aid.
Anatomical contact drift is not automatically measured; perspective and cel-to-cel drawing
variation remain visible at enlarged review size. Extraction copies only the connected figure,
so neighboring poses cannot leak into its rectangular crop. The original four routines retain
their previous timing and source scale.
