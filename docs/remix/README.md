# Remix

The Street toolbar's Remix switch replaces the normal collection rows with the
16 existing mood families. A picker jumps directly to any mood. Finding a mood
and Unrated keep pending/unreliable songs visible. Row positions remain stable
as classifications arrive. Switching off restores the previous normal row;
search temporarily replaces Remix and Back returns to the selected mood.
Paper retains its normal shelf. Sample mode uses clearly labelled deterministic
demo moods and makes no classifier requests.

When enabled for a signed-in listener, the browser loads, in order:

1. Individual recently played tracks, newest first, paging backward with `before`
   until Spotify returns no new plays. This preserves songs even when the normal
   Recently Played row represents them as albums or playlists.
2. Every available page of Liked Songs (the normal case insert still caps at 200).
3. Top tracks for short, medium and long term, following each range's next pages.
4. Every accessible saved album and playlist, beyond the normal ten context rows.

Songs are deduplicated by Spotify URI. Recent songs get queue priority without
reversing their newest-first order. Reads are sequential inside the Remix loader,
respect Spotify's Retry-After duration, and can be cancelled when Remix is turned
off or the listener leaves. Partial failures retain everything loaded so far and
appear under the status card. Followed playlists Spotify won't expand are counted
as unavailable; local files and non-track items are excluded.

`user-top-read` is now requested at sign-in. Existing users may need to sign out
and back in to authorize top tracks. Refresh the library to include newly saved
albums and playlists beyond the existing 12-hour library cache.

## Jev setup and boundaries

This builds on the existing **local** public-catalog mood pilot. Configure
`TYPESAFE_API_KEY` in `.env.local` and restart Vite to enable actual classifications.
No key was supplied or exposed during implementation. The deployed site still
needs a hosted classification endpoint; production displays an explicit setup
status instead of pretending classifications succeeded.

Only a song's title, artist and duration are sent to the local public-catalog
resolver. The resolver verifies against MusicBrainz and sends canonical public
recording facts to Jev. Spotify tokens, recently played timestamps, affinity ranks,
playlists, library membership, artwork and listening history never enter Jev's
payload. Mood labels are estimates, not audio analysis.

Classification is serialized with the existing 2.2-second gap, so large collections
fill progressively and require the page to remain open. Results are reused for
the session, shared with song labels and DJ choreography. Missing configuration
stops the queue after one request. Unknown answers stay Unrated.

Spotify does not guarantee complete historical coverage. Pagination reads what
the account/API exposes; it does not recover a lifetime listening archive.
Official references: [recently played](https://developer.spotify.com/documentation/web-api/reference/get-recently-played),
[top tracks and time ranges](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks).

## Verification

- `node --test scripts/test-remix.mjs scripts/test-song-mood-queue.mjs scripts/test-song-mood.mjs`:
  13 passing tests. Includes 100 recent tracks, 300 liked songs, 12 saved albums,
  all three top ranges, both playlist item schemas, repeated-page termination,
  deduplication, partial permissions, cancellation, priority order and queue notifications.
- `scripts/verify-remix.mjs`: desktop 1280×760 and phone 390×800 sample mode,
  picker, normal-row restoration, Paper/Street switching, and zero demo API calls.
  Mocked authenticated Spotify/Jev checks verify progressive real-store grouping,
  Unrated fallback, missing setup, search/Back, sign-out and allowlisted request fields.
- `scripts/test-spotify-rate-limit.mjs`: actual browser API wrapper with mocked
  responses verifies waiting/retry and aborting during a 60-second Retry-After.
- `scripts/verify-volt-app.mjs`: normal sample browsing, pick/open/play/return, and Street/Paper/Street passed on desktop and phone.
- `npm run build`: passed in the identical temporary copy; existing large-bundle
  warning remains. The workspace's type checker was killed by the environment.

Playwright scripts accept `PLAYWRIGHT_MODULE` and `VOLT_URL`. Evidence is under
`output/remix/1792639275812/`. Screenshots here show sample music and a mocked
classification fixture, not live Spotify/Jev results. Real account permissions,
catalog coverage and mood quality still require a configured account/key test.
