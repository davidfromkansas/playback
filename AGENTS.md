# AGENTS.md

A guide for coding agents picking up this repo with no prior context. Read this first, then `README.md`
for the user-facing setup.

## What this is

**Playback** is a browser app that turns a person's Spotify library into a 3D collection of CDs. People sign in
with Spotify, browse their albums, playlists and Liked Songs as CD cases, pull one out, open it and play it.
A cartoon host character dances while music plays.

- Live site: https://playback-fm.vercel.app (Vercel project `playback`)
- Repo: https://github.com/davidfromkansas/playback. `main` is the live version; do new work on a branch and open a PR.
- Owner: David. He prefers short, plain-language updates, and screenshots over descriptions.

There is **no backend**. Everything runs in the browser: Spotify login, data loading and playback.

## Run it

```bash
npm install
npm run dev        # http://127.0.0.1:5180 (Spotify rejects "localhost", so always use 127.0.0.1)
npm run build      # type-checks (tsc --noEmit), then builds to dist/
npm run preview    # serves dist/ on http://127.0.0.1:4173
```

Press **Try it with sample CDs** on the welcome screen to use the app without a Spotify account. That is
how almost all testing is done (see "Testing" below). There are no unit tests or linters set up. `npm run build`
must pass before you commit.

## Stack

Vite 8, React 19, TypeScript, three.js 0.186 via `@react-three/fiber` 9, helpers from `@react-three/drei` 10,
animation springs from `@react-spring/three` 10. 3D models are made in Blender with Python scripts in
`blender/` (see "3D assets").

## Design

Street is the only active design: a Jet Set Radio-inspired rooftop, graffiti typography, bright colors,
jewel cases on steel shelves, and DJ Volt. Paper mode and the theme switch have been removed.
Saved `playback.theme` preferences are ignored. Some shared rendering helpers retain legacy theme arguments.

## Code map

```
src/
  App.tsx              Screens (welcome / loading / shelf), all state, input (wheel, drag/swipe, keys), wiring
  types.ts             Disc (album | playlist | liked | track), Track, SortKey
  styles.css           Shared base CSS; Street styling is scoped under `.street`
  data/sample.ts       Fake library for sample mode
  lib/
    theme.ts           loadThemeFonts() (canvas text needs fonts loaded first)
    beat.ts            Shared 100 BPM beat clock that every dance animation syncs to
    colors.ts          Shared palette helpers
  spotify/
    auth.ts            PKCE login entirely in the browser, token refresh, scopes
    api.ts             fetch wrapper: 429 Retry-After handling, paging (allPages), SpotifyError
    library.ts         Loads albums, playlists, Liked Songs and track lists; 12 h localStorage cache
    player.ts          Playback store (useSyncExternalStore) and the four play modes (below)
    rows.ts            Street rows: Recently Played, Liked Songs, 10 recent albums/playlists (one CD per song),
                       and the search results page (searchRows: Songs, Albums, Playlists from Spotify search)
    lyrics.ts          Song lyrics from LRCLIB (lrclib.net): free, no key, callable from the browser
  scene/               Everything inside the three.js <Canvas>
    CameraRig.tsx      Camera position per theme and screen shape (cameraFor)
    layout.ts          Case sizes (1 unit = 100 mm, CASE_W 1.42 x CASE_H 1.25), shelf slots, LINE_STEP
    scroll.ts         Shared ScrollState type
    RowStack.tsx       Street: stacks the rows vertically and slides between them
    CaseLine.tsx       One Street row: layout, snapping to the nearest CD, focus, tap to pull out
    JewelCase.tsx      Loads jewelcase.glb, bakes parts, applies plastic/tray/cover materials
    PulledCD.tsx       The case you pulled out: flies to the camera, opens, disc lifts and spins
    Disc3D.tsx         The CD itself (shiny print, mirror band, clear hub) + DiscLighting environment
    StreetBackdrop.tsx Loads rooftop.glb, swaps in toon materials + outlines, billboards show your covers
    textures.ts        Canvas textures (spines, generated covers) and useArt/useCover loaders
    lyricsPage.ts      Inside of the booklet: the playing song's lyrics, scrolling in time with the music
    streetArt.ts       Street canvas art: spray-paint spines, billboard ads
    discArt.ts         Disc print styles
  ui/                  Plain DOM overlays
    Host.tsx           Host character + speech bubble; rhymesFor(theme) has each host's lines
    useRig.ts          rAF loop for SVG character rigs: writes transforms directly, no React re-renders
    DJ.tsx The two hosts (pose functions blend "dance" and "chill" states)
    Panels.tsx         Track list panel
    NowPlayingBar.tsx  Miniamp transport controls, elapsed time and seek slider
    Visualizer.tsx     Decorative visual mode (not an audio waveform)
    SpeedLines.tsx     Street speed-line overlay
    Loading.tsx        Loading states (generative-loaders package from generativeloaders.com): LoadingCard, SceneLoading
blender/               Python scripts that build the .glb models
public/models/         Exported models (committed): rooftop.glb, jewelcase.glb, shelf.glb
```

### How the main pieces fit

- **Scrolling** is one shared mutable object, `ScrollState { target, current, max, held }`, created in
  `App.tsx` and read every frame by the active view. Input handlers only move `target`; the view eases
  `current` toward it. Street uses `index * LINE_STEP`.
- **Street rows** (`spotify/rows.ts`): row 1 is Recently Played (newest first; songs played from an album or
  playlist show as that album/playlist, anything else as a single song). Tapping an album/playlist there opens
  its songs as a new row 2. Row 2 is Liked Songs, then up to 10 rows for the most recently played albums and
  playlists, topped up with recently saved ones (Spotify only keeps the last 50 plays). Each row has its own
  ScrollState; App keeps the active row index and a `StackState` for the vertical slide.
- **Search**: in Street, Enter in the search box searches all of Spotify and shows a separate results page
  (its own rows, swapped in for yours) with a Back button (or Escape) that returns to the row you were on.
  Tapping an album/playlist there opens its songs as a row below.
- **Pulling out a CD**: the view calls `onPick(disc, worldPosition, rotationY)`, and App sets `pulled`.
  `PulledCD` animates from that pose and back again when it's put back.
- **Animation at 60/120 fps**: per-frame work happens in `useFrame` (3D) or `useRig` (SVG) by writing to
  objects directly. Avoid React state updates every frame.

## Spotify

- **Client ID** `1840d923d830409a8888a6460253593e` is public and committed in `.env` on purpose.
  **Never add, ask for or commit the Client Secret.** The PKCE flow doesn't need one.
- Redirect URIs to register in the new Spotify app: `http://127.0.0.1:5180/` and
  `https://playback-fm.vercel.app/`. A new host or port needs adding there by David.
- The app is in Spotify **development mode**: max 5 users, each added by hand in the dashboard.
- Spotify renamed playlist `tracks` to `items` in 2026; `library.ts` handles both.
- Spotify only lists tracks for playlists the user owns or co-edits. It no longer gives tempo data, so the
  beat is a fixed 100 BPM.
- **Lyrics**: Spotify's API has none, so `spotify/lyrics.ts` asks LRCLIB by song name, first artist, album and
  length, preferring time-stamped (synced) lyrics. Results are cached per song for the visit.
- Recently Played needs the `user-read-recently-played` scope (added Oct 2026). People who signed in before
  that must sign out and back in.
- Play modes (`player.ts`): **browser** (Web Playback SDK, desktop + Premium), **phone** (Spotify Connect:
  tells the Spotify app on the device to play), **link** (free accounts: open in Spotify), **sample** (pretend).

## 3D assets (Blender)

Models are generated by scripts, not hand-edited. Change the script, re-run it, commit the script and the .glb.

```bash
pip install bpy            # Blender as a Python module (5.x); needs a matching Python version
python blender/jewelcase.py   # -> public/models/jewelcase.glb
python blender/rooftop.py     # -> public/models/rooftop.glb
python blender/shelf.py       # -> public/models/shelf.glb (stretched to each row's length in the app)
```

- Scripts are written in three.js coordinates (y up, +z toward the viewer) and convert to Blender's z-up.
- Object and material names matter: the app finds parts by name (`Booklet`, `LidShell`, `Billboard_0`, ...)
  and swaps in its own materials.
- glTF flips V on export, so `JewelCase.tsx` flips the booklet and spine UVs back. If art shows upside down
  or mirrored, look there first.

## Testing

- Use sample mode. A cloud container usually **can't reach Spotify or the live site**, so real sign-in and
  real cover art can only be checked by David on a real device. Say so instead of claiming it works.
- Visual checks: build, run `npm run preview`, and take screenshots with Playwright (Chromium) at desktop
  (1280x760) and phone (390x800, touch) sizes. Headless Chromium renders WebGL in software, so it runs at a
  few frames per second; wait several seconds before screenshots and don't judge speed from it.
- Check Street and the main flow: welcome, line/shelf, swipe, pull out, open, play (sample).

## Deploying

- Vercel is linked to the GitHub repo. Merges to the default branch deploy to production automatically,
  and every push makes a preview deployment.
- With the Vercel MCP tools, leave out `teamId` (it returns 403).

## Conventions

- TypeScript, React function components, no semicolons, single quotes, 2-space indent, lines up to ~120.
- Short comments that say why, in plain words. Match the surrounding code.
- Commit messages: short summary line, then a few bullet points.
- Keep the phone layout working. It was a launch requirement.

## Open items

- Real 120 fps and real Spotify cover art haven't been verified on a device from the agent side.
