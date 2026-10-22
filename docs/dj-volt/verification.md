# DJ Volt verification

## Passed

- `npm run build`: TypeScript and production build, both isolated copy and original workspace.
- Production preview at 1280×760 and 390×800 with touch: welcome, sample library, row navigation/swipe,
  CD pick/open/play/return, then Street → Paper → Street. No page errors.
- Phone host bounds include the complete skates above the swipe hint (automated non-overlap assertion).
- Deterministic 900-frame selector fixture: idle, play, pause, resume, mid-transition interruption,
  final recovery to idle. Entry never jumps by more than the allowed timestep.
- Isolated actual Chrome surface: 720 rAF samples; median 16.7 ms, p95 16.7 ms, p99 16.8 ms,
  max 16.8 ms; no callback gaps above 34 ms. This measures presentation callbacks, not new drawings.
- Reduced motion holds a static appropriate pose.
- Captured idle/playing frames and reviewed desktop/phone placement. The source sheets retain complete
  bodies and consistent equipment. Runtime uses source-sheet uniform scales and a wheel-line registration.

## Evidence and repeatability

`motion-review.mp4` contains unretimed browser footage of normal playback, interruptions and quarter-speed
inspection. `contact-sheet.png` samples that footage. `idle.png` and `playing.png` compare the preserved
original SVG with the generated character in the same surface. `desktop.png` / `phone.png` show actual app use.

`art/dj-volt/prompts.json` and `registration.json` preserve generation and extraction records.
`scripts/verify-volt.mjs` produces selector and presented-frame traces in timestamped output folders.
`scripts/verify-volt-app.mjs` exercises actual app controls; set `VOLT_APP_URL` for your production preview.
Both use the installed Playwright module via `PLAYWRIGHT_MODULE` and an already-running local server.

## Limits

The groove is authored cel animation at 10 drawings/second, rendered on the display clock; idle uses a
slower subtle sequence. It is not interpolated 60/120 fps character animation. Small drawn costume/face
variations remain between generated cels. Automated anatomical foot-slip measurement and independent
human motion review have not been performed. Real Spotify playback and a physical 120 Hz phone were not tested.

Initial workspace verification attempts failed because the dev server restarted/stalled during dependency
loading. Those failed captures remain in ignored output. An isolated copy produced a stable check, followed
by a successful build in the original folder. No failed screenshot is presented as a successful baseline.
