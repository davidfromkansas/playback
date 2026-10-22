# Dance research and adaptation

## Viewed reference

[LittleBigWorld — PaRappa The Rapper Stage 1: Chop Chop Master Onion](https://www.youtube.com/watch?v=RMUX6b82Zbc)
was opened in the browser and inspected at 0:25, 0:30, 0:40 and 1:30. The important visual ideas are
clear bent-knee silhouettes, distinct arm accents, a large duck, and recovery to an upright rhythmic stance.
These are observations of gameplay poses, not extracted animation data or an exact motion capture.

Additional context:
- [GameSpot's Master Onion gameplay](https://www.gamespot.com/videos/parappa-the-rapper-remastered-training-with-chop-c/2300-6438035/)
  identifies the same training routine.
- [PlayStation's creator interview](https://blog.playstation.com/archive/2017/04/03/extended-play-how-parappa-the-rapper-ushered-in-a-music-game-revolution/)
  discusses the game's call-and-response structure.
- [Original game FAQ](https://ps.vgf.com/faqs/parappa/index.htm) describes the bonus stage's selectable
  dance styles. This is background for variety, not visual evidence of those moves.

## DJ Volt choreography

Keep his Asian male identity and skates; borrow the accent/recovery language rather than game artwork.
All routines start/end on the same existing neutral cel (24). Four two-beat loops make an eight-beat
phrase before cycling groove → punch → duck → wave. A requested preview routine switches at a loop boundary.
A pause completes the active routine's recovery before the microphone-lowering sequence.

- **Rooftop groove:** existing shoulder/knee groove.
- **Punch the beat:** anticipate, extend free arm, retract. Adapted from the lesson's punch accents.
- **Duck & bounce:** knees fold into a low position and rise through the same drawings in reverse.
  Adapted from the visible duck pose; complete recovery is retained.
- **Crowd wave:** original DJ variation using a broad overhead arm gesture and rhythmic knees;
  not claimed to be an exact move in the supplied video.

The mic stays in the right hand. New whole-body sources have one uniform scale per sheet. The canvas
is now 320×380 with ground Y=364 and root X=120, giving the raised hand room without shrinking individual poses.
CSS height changes proportionally to preserve the character's approximate visible body size.

## Rejected candidates

`punch-source.png` zero-based cel 7 has an extra-arm/microphone artifact and is never selected at runtime.
The chop was dropped in favor of a clean punch and reversed return. Other unused punch cels are retained for provenance.
`rejected-wave-touching.png` has touching figures between rows, so it was regenerated with more separation.
The duck's abrupt generated return was replaced by the reverse of its complete descending drawings.

Generated via the native tool; exact prompts/results are in `cycle-prompts.json`. Registration and hashes
are in `registration.json`. Slight cel-to-cel drawing differences remain. No frame interpolation or
silhouette crossfade is used. Source video footage and game sprites are not bundled with the app.

## Twelve additional dances

User selected all twelve from the researched shortlist. Primary reference/tutorial pages:

- Bart Simpson: https://www.steezy.co/posts/how-to-do-the-bart-simpson
- Running Man: https://www.steezy.co/posts/how-to-do-the-running-man
- Roger Rabbit: https://www.steezy.co/posts/how-to-do-the-roger-rabbit
- Cabbage Patch: https://www.steezy.co/posts/how-to-do-the-cabbage-patch
- Smurf: https://howcast.com/videos/505186-how-to-do-the-smurf-hip-hop-dancing/
- Locking points: https://www.howcast.com/videos/511784-how-to-do-locking-points-street-dance
- Arm wave: https://howcast.com/videos/505194-how-to-wave-hip-hop-dancing/
- Toprock / six-step: https://www.redbull.com/int-en/understand-the-basic-elements-of-breaking
- Baby freeze: https://www.sadlerswells.com/take-part/online-workshops/workshops-breaking/
- Backspin / windmill: https://www.redbull.com/ca-en/breaking-101-your-guide-to-a-cultural-phenom

These guide choreography descriptions; no third-party footage or game artwork is shipped.
New generated source IDs/prompts are in expanded-prompts.json and expanded-repairs.json.
Rejected background/crop variants remain in art/dj-volt/rejected-*.png.
