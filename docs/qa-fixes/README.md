# QA fixes after merging main

Merged origin/main at 22eb10b (VOLT—01 Miniamp, Street-only interface, and persistent case Back action), preserving Remix, DJ Volt routines, and song mood labels.

- Shelf shortcuts ignore focused form controls and buttons.
- Phone search occupies a full row instead of shrinking between buttons.
- Focused title and empty-row feedback follow the measured header height, including expanded errors.
- Empty-row feedback is responsive DOM text; neighboring 3D signs have bounded widths.
- Remix collection loading survives toggle changes. Explicit library reload/signout replaces it; toggling is no longer advertised as retry.
- Progress separates checked songs from sorted songs and distinguishes catalog mismatches, uncertain estimates, and provider failures.
- Catalog resolution accepts a clearly closer duration match while rejecting ties and incompatible versions. Classifier confidence thresholds remain unchanged.

Validation: production build and 14 catalog/queue/collection tests pass. Direct browser checks confirmed readable phone search, Enter remaining in the mood picker, and readable empty-row messages using labelled sample moods. Real-library revalidation was limited by Spotify's Too many requests response. The missing Playwright dependency prevented running the pre-existing Spotify rate-limit script in this checkout.

Remaining limitation: the public title/artist catalog input does not guarantee a reliable musical-mood estimate. Improved matching and diagnostics are not proof of successful live classification; uncertain songs remain Unrated. No audio or Spotify history is sent to Jev.
