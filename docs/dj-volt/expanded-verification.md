# Expanded choreography verification

Twelve new sprite routines plus the four earlier routines, 176 atlas cels (including unused source cels).
Source: codex/dj-volt-animation. The new draws use the existing rAF canvas renderer and fixed 100 BPM clock.

## Checks

- `npm run build`: passed in the synchronized `/private/tmp/playback-volt-check` checkout with identical source/assets. Existing bundle-size warning remains. Workspace build also attempted but file access stalls during Vite transformation.
- `scripts/verify-volt.mjs`: passed. 6,600 deterministic ticks cover the entire 16-routine auto cycle, routine-boundary neutral drawings, pause and re-entry. Actual Chrome controls select every routine and pause each into idle. Reduced-motion freeze and browser errors checked.
- Trace: `output/dj-volt/2026-10-22T02-12-03.213Z/`. Presented 1,440 callbacks: median 16.7ms, p95 16.7ms, p99 16.8ms, max 16.8ms, zero gaps above 34ms. This measures callback cadence, not the number of unique cel drawings or physical display scans.
- `scripts/verify-volt-app.mjs`: desktop 1280×760 and phone 390×800 passed welcome, sample library, swipe, pick, open, play, return and Street/Paper/Street. No browser errors. Evidence: `output/dj-volt/app-1792635126270/`.
- After those checks, connected-component extraction was tightened to exclude neighboring artwork from a figure's crop. All 176 cels extracted; final source rebuilt and separate live recording captured each of the 12 additions.

## Visual review and limits

Inspected all generated sheets, rejected an extra-arm Bart attempt and colored-background pointing sheets, repaired edge margins, omitted an arm-wave cel with a clipped fingertip. Inspected runtime screenshots of upright and floor poses. Floorwork has dedicated squat/drop/return drawings; pause waits for those recoveries before retrieving the microphone.

These are stylized skate adaptations with eight key drawings per new move, not dance instruction or motion-captured movement. Sparse rotational poses, costume-detail variation, and a few pose-to-pose shifts remain visible in enlarged/slow inspection. Contact registration uses alpha supports and is not an independently annotated anatomical drift test. No claim of independent human motion approval, real Spotify testing, or real 120Hz display measurement.
