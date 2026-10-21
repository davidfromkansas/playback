# Playback

Your Spotify library as a 3D shelf of CDs. Sign in with Spotify, slide along the shelf,
pull a CD out, open the case and play it. Styled like a paper-cutout rhythm game, with an
dancing host character, tap-along rhythm buttons and a mood meter.

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
