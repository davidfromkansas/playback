# Playback

Your Spotify library as a 3D collection of CDs. Sign in with Spotify, swipe through your CDs,
pull one out, open the case and play it. A dancing host character keeps you company.

The app uses a Jet Set Radio-style rooftop with a swipeable collection of jewel cases.

Open an album, playlist or Liked Songs CD to see its track list inside the left cover. The booklet scrolls continuously, looping from the last track back to the first. With reduced motion enabled it stays still; the full track panel remains scrollable. Individual-song CDs show lyrics there during playback.

Working on the code? Start with [AGENTS.md](AGENTS.md).

Built with Vite, React, Three.js (React Three Fiber) and React Spring.

## Try it without Spotify

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5180 and press **Try it with sample CDs**.

For filming, open `/?demo=1` to bypass Spotify sign-in, including existing sessions.
The demo includes recognizable pop and a smaller soul, indie, hip-hop and electronic selection.
Track facts and bundled covers come from the public Apple iTunes catalog. Collections, listening
history and mood assignments are curated fixtures, not an imported account or Jev results.
Playback is silent and simulated; mood labels, Remix and DJ reactions work without API requests.
Album CDs contain demo selections, not necessarily complete albums.

## Hook up Spotify

1. Go to the [Spotify developer dashboard](https://developer.spotify.com/dashboard) and create an app
   (your account needs Spotify Premium for the app to work).
2. Tick **Web API** and **Web Playback SDK**.
3. Add Redirect URIs for every address the app runs on, for example
   `http://127.0.0.1:5180/` for local testing and `https://playback-fm.vercel.app/` once it's online.
   Spotify doesn't accept `localhost`, so use `127.0.0.1`.
4. Under **User Management**, add the Spotify email of each tester (up to 5).
5. Put the Client ID in `.env` (already set for the main Playback app). To use your own app, override it in `.env.local`.

There's no server and no client secret: login uses Spotify's PKCE flow in the browser.

An optional local DJ mood pilot uses a Vite middleware endpoint, separate from Spotify login.
It resolves a song against MusicBrainz's CC0 catalog and sends only canonical title/artist/recording
facts to Jev. Set `TYPESAFE_API_KEY` in `.env.local` to try it, or use the manual mood selector
at `/character-preview.html` without a key. This endpoint is not deployed in production.
See [the data flow and setup](docs/dj-volt/public-song-moods.md). An opt-in
[public-context pilot](docs/song-context/README.md) adds linked Wikidata musical facts;
its initial live results do not yet justify enabling it across the library.

The Street view's **Remix** toggle groups songs into mood rows. It loads recent
plays first, then all available liked songs, top tracks, saved albums and accessible
playlists. Sample mode previews the layout with labelled demo moods. Real mood
sorting uses the local Jev setup above; existing Spotify users may need to sign out
and back in for the new top-tracks permission. [Remix details](docs/remix/README.md).
The VOLT—01 Miniamp player has playback controls, elapsed time, a seek slider and a collapsible visualizer.
“Visual mode” is decorative animation, not a measurement of Spotify audio. It freezes when paused or reduced motion is enabled.

## How playback works

| Where | What happens |
| --- | --- |
| Desktop browser, Premium | Music plays right in the tab (Web Playback SDK). |
| Phone browser, Premium | Phone browsers can't play Spotify audio, so Playback tells the Spotify app on the phone to play. The Spotify app needs to be open. |
| Free account | The CD opens in Spotify instead. |
| Sample mode | Pretend playback so you can try the animations. |

## Spotify limits to know

- Development-mode apps allow 5 users, each added by hand in the dashboard.
- Spotify only lists the songs of playlists you own or co-edit. Followed playlists still play as a whole.
- Spotify no longer gives new apps a song's tempo, so the host dances to a steady 100 BPM beat.

While inspecting a CD, use **Tracks** to open the selectable track list and **Back to collection** to return it. The booklet stays front and center; shelf signs hide and the edges of the scene dim. VOLT—01 docks bottom-right and starts collapsed on phones. Playback controls live in the player once a CD has started.
