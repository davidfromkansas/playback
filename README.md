# Playback

Your Spotify library as a 3D collection of CDs. Sign in with Spotify, swipe through your CDs,
pull one out, open the case and play it. A dancing host character keeps you company.

Two looks, switched from the top bar:
- **Street** (default): a Jet Set Radio-style rooftop with a swipeable line of real-looking jewel cases.
- **Paper**: a pastel paper-cutout room with a shelf of CD spines, tap-along rhythm buttons and a mood meter.

Open an album, playlist or Liked Songs CD to see its track list inside the left cover. The booklet scrolls continuously, looping from the last track back to the first. With reduced motion enabled it stays still; the full track panel remains scrollable. Individual-song CDs show lyrics there during playback.

Working on the code? Start with [AGENTS.md](AGENTS.md).

Built with Vite, React, Three.js (React Three Fiber) and React Spring.

## Try it without Spotify

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173 and press **Try it with sample CDs**.

## Hook up Spotify

1. Go to the [Spotify developer dashboard](https://developer.spotify.com/dashboard) and create an app
   (your account needs Spotify Premium for the app to work).
2. Tick **Web API** and **Web Playback SDK**.
3. Add Redirect URIs for every address the app runs on, for example
   `http://127.0.0.1:5173/` for local testing and `https://your-site.vercel.app/` once it's online.
   Spotify doesn't accept `localhost`, so use `127.0.0.1`.
4. Under **User Management**, add the Spotify email of each tester (up to 5).
5. Put the Client ID in `.env` (already set for the main Playback app). To use your own app, override it in `.env.local`.

There's no server and no client secret: login uses Spotify's PKCE flow in the browser.

An optional local DJ mood pilot uses a Vite middleware endpoint, separate from Spotify login.
It resolves a song against MusicBrainz's CC0 catalog and sends only canonical title/artist/recording
facts to Jev. Set `TYPESAFE_API_KEY` in `.env.local` to try it, or use the manual mood selector
at `/character-preview.html` without a key. This endpoint is not deployed in production.
See [the data flow and setup](docs/dj-volt/public-song-moods.md).

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
- Spotify no longer gives new apps a song's tempo, so the rhythm bar follows a steady 100 BPM beat.
