# Public catalog mood pilot

The classifier accepts only MusicBrainz core catalog facts: recording title, credited
artist names, and recording ID. It does not receive Spotify API response objects,
playlist names, user identifiers, listening history, artwork, lyrics, MusicBrainz
annotations, ratings, or genre tags.

MusicBrainz core data is CC0. Its supplementary tags and annotations have different
terms and are intentionally excluded. Public availability alone is not the license test.

- Core/supplementary license distinction: https://github.com/metabrainz/musicbrainz-docs/blob/main/musicbrainz_database/index.rst
- API identification and rate limits: https://musicbrainz.org/doc/MusicBrainz_API
- Jev request schema: https://docs.typesafe.ai/introduction/quickstart

## Data flow

The current song title, artist, and duration are lookup inputs to MusicBrainz, not
classifier inputs. The resolver requires one exact normalized title/artist match with
duration within five seconds. Multiple recording IDs are treated as ambiguous. It then
fetches that canonical recording and rechecks the match. Only allowlisted fields from
that response are used to construct Jev's state. This preserves provenance; it is not a
claim that every use of a streaming service's lookup metadata is automatically permitted.

Jev estimates mood from recognition of the recording. It does not listen to audio or
measure tempo. It must choose unknown for unfamiliar recordings. Confidence thresholds
are initial heuristics, not calibrated music-classification accuracy measurements.

## Local setup

Add `TYPESAFE_API_KEY` to the ignored `.env.local` file and restart `npm run dev`.
Never use a `VITE_` prefix: the key is server-only. No key is needed for manual mood selection.
Open `/character-preview.html`, enter title, artist, and duration, and select **Find song mood**.
The preview shows the matched public recording and an estimated mood, or the fallback reason.

In local development, all already-loaded real tracks enter a shared lookup queue,
whether playing or not. Album tracks, shelf/search songs, and opened track lists share
the same session cache. Only one lookup runs at a time, with a 2.2-second gap after
each result; missing setup stops the queue after the first request. The current song
can move ahead of queued tracks. Signing out clears the queue/cache and ignores stale
responses. The Street host reads the same result as the song label.

Small mood labels appear in track lists (including the booklet), the focused single-song
shelf label, and the now-playing bar. They show an ellipsis while queued/loading and
`Unrated` when no reliable estimate exists. Sample mode makes no catalog requests;
production remains without a classifier endpoint, so its labels are `Unrated`.
Sample mode and production retain the existing automatic animation cycle.

Single-song cases also carry the label floating just outside the right edge of their
front cover, aligned with the bottom corner, in both themes. The badge follows the lid, uses shared small textures, and does
not alter the source album art or intercept case clicks. Albums and playlists have no
cover badge because they do not have one song mood. Desktop/phone cover, opening, and
label-update checks passed in `output/dj-volt/labels-1792637686354/`.

The Vite middleware is deliberately a local pilot, not a deployed public paid API.
It checks same-origin POSTs, bounds requests, keeps the key on the server, serializes
MusicBrainz calls at least 1.1 seconds apart, backs off on 429/503, limits in-flight
lookups, deduplicates, and caches up to 200 results. The upstream calls have timeouts.
Before hosting this endpoint, add authenticated access, distributed rate/budget limits,
and a shared catalog cache. MusicBrainz's free hosted API is for non-commercial use;
evaluate its commercial service terms if Playback becomes commercial.

## Animation scope

Sixteen mood families now select compatible subsets of the existing sixteen routines.
An unknown mood uses the rooftop groove. The existing eight-beat selection boundary
and full recovery/holster behavior remain in place. There are no new generated cels in
this change. The planned 64 routines, quiet behaviors, energy/style dimensions, and
regional choreography research remain outstanding.

## Verification

Run `node --test scripts/test-song-mood.mjs` for the source boundary, matching, ambiguity,
confidence, caching, missing-key, and upstream-failure fixtures. These mock external
services; they do not establish live MusicBrainz/Jev availability or classification quality.
Run `npm run build` and `scripts/verify-volt.mjs` for the existing renderer checks.

Verified for this pilot: five server fixture tests passed; the production build passed
in an identical temporary checkout (the workspace type-check process was killed).
`scripts/verify-song-mood.mjs` exercised all 16 mood families plus unknown, complete
recovery, real missing-key middleware behavior, a simulated successful classifier
response, and desktop/phone layout. Evidence: `output/dj-volt/moods-1792636583494/`.
The desktop and phone sample flows also passed in Street and Paper:
`output/dj-volt/app-1792636547701/`. `public-mood-preview.png` shows the local setup state.

For background labels, run `node --test scripts/test-song-mood-queue.mjs` and
`node scripts/verify-mood-labels.mjs` (with `PLAYWRIGHT_MODULE` if needed).
The browser fixture uses sample songs and simulated classifier responses to verify
labels before playback; it does not establish live classification accuracy.
The four queue tests and five source-boundary tests passed. Desktop and phone label
checks passed in both themes, before playback and after starting the same song:
`output/dj-volt/labels-1792637528686/`. The duplicate fixture identities produced one
lookup. `song-mood-labels.png` shows the phone UI with a simulated Dreamy result.
