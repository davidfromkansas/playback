# Street texture sources

Generated with the built-in imagegen tool for this project, then mechanically resized to power-of-two 1024px WebP atlases. No Spotify artwork or existing characters were generated.

- signs.webp: four columns × two rows, eight text-free enamel/neon sign grounds. Real Japanese labels are drawn by tokyoArt.ts using the locally bundled Dela Gothic One subset. Copy: 音楽, レコード, カラオケ, ゲーム, CD, ラジオ, ダンス, 渋谷. Long vowel marks rotate for vertical typesetting.
- posters.webp: two columns × two rows, fictional PLAYBACK FM / NIGHT SHIFT / LOVE BYTE / BASS CLUB posters. Also supplies two idle-screen compositions.
- surfaces.webp: two columns × two rows: weathered concrete, graffiti shutter, window blinds, rooftop concrete. Canvas blending reduces wear intensity before mapping.
- sign-font.ttf: Dela Gothic One subset from Google Fonts, licensed under SIL OFL (FONT-LICENSE.txt).

Generation direction: flat orthographic game atlases; Y2K Tokyo, cel shading, black ink, bold screenprint colors; no real brands. Sign grounds deliberately contain no generated lettering. Japanese glyphs are deterministic. Runtime maps share generated sources, rather than downloading an image per building.
