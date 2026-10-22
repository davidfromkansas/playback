# Public musical-context pilot

This is an opt-in pilot, not enabled library-wide. Run `node --env-file=.env.local scripts/evaluate-song-context.mjs` to evaluate the fixed 20-song manifest. It stops on provider unavailability and saves each result; unattempted entries are not passes. This exercises coverage and behavior, not calibrated mood accuracy.

## Source boundary

Spotify-derived lookup inputs are not sent to Jev. The existing resolver verifies a MusicBrainz recording by title, artist and duration. The pilot requests its explicit Wikidata links, then reads structured genre (P136) and instrumentation (P870) facts and their English labels. If the recording has no direct link, exactly one linked performance work may provide composition context. Medleys are excluded; composition context is explicitly labelled as not recording-specific. Artist-wide genre guesses are never substituted.

Each evidence object retains source URL, entity ID, license and scope. Wikidata structured data is CC0: https://www.wikidata.org/wiki/Wikidata:Licensing . MusicBrainz core facts remain CC0. Wikipedia prose, lyrics, annotations, supplementary MusicBrainz tags, artwork, and Spotify response objects are excluded from this first pilot. This avoids silently treating arbitrary public descriptions as freely licensed data.

## Classification

Jev evaluates supplied musical evidence instead of being asked whether it recognizes the recording. It answers mood, energy and evidence sufficiency independently. Mood requires both confidence gates plus the selected-choice probability gate. Missing context makes no paid Jev call; insufficient context and uncertain answers stay Unrated. Genre alone is explicitly insufficient to force a mood. Energy is optional (`unknown` unless its own thresholds pass); existing choreography continues to use the accepted mood.

Successful results are cached by public recording ID and profile version in addition to the lookup query cache. Source URLs remain in results and mood tooltips. The server bounds links, claims, request duration and cache size; only fixed MusicBrainz/Wikidata API origins are fetched. Returned text is treated as data, never instructions.

## Rollout gate

`TYPESAFE_CONTEXT_PILOT=true` enables this path in local Vite middleware after a developer reviews the pilot. It is intentionally absent from the user's environment by default. The production site still has no classifier backend. A full-library rollout requires adequate matching/context coverage and manually reviewed mood outcomes; fixtures alone do not establish that.

The normal (non-enriched) behavior remains unchanged. Client timeout is 60 seconds to accommodate the additional bounded catalog calls. Enrichment results use profile version `public-context-2`.

## Verification

`node --test scripts/test-song-context.mjs scripts/test-song-mood.mjs scripts/test-song-mood-queue.mjs scripts/test-remix.mjs` covers source allowlists, URL filtering, deprecated claims, instrumentation, no-evidence/no-paid-call behavior, evidence gating, composition scoping, medleys, canonical-result caching and existing queue/collection behavior. Twenty tests passed. Production build passed in the equivalent temporary checkout.

`baseline-evaluation.json` retains the interrupted first live run (direct recording links only). `evaluation.json` records the final composition-aware pilot, including any early provider failure. Neither report claims that unmatched/unavailable songs have been classified.

The composition-aware live run attempted 4 of 20 songs: two had no unambiguous match, Billie Jean had composition genre evidence but Jev returned uncertain, and the fourth stopped on a catalog failure. No mood was accepted. The remaining 16 songs were not attempted. This does not yet justify a library-wide rollout.
