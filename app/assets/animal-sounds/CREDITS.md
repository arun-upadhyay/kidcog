# Animal sound credits

All recordings here are licensed **CC0 1.0** (public domain dedication), so they
may be used in the app without payment or attribution. Credits are kept anyway,
so it is always clear where each sound came from.

| File | Original | Recorded by | Prepared by |
|---|---|---|---|
| cow.mp3 | [Cow moos](https://freesound.org/people/josephsardin/sounds/177253/) | josephsardin | [DJ WoodZ, Animal-Sounds](https://github.com/DJWoodZ/Animal-Sounds) (CC0 1.0) |
| pig.mp3 | [Pig - Multiple Snorts 3](https://freesound.org/people/JarredGibb/sounds/233182/) | JarredGibb | DJ WoodZ (CC0 1.0) |
| sheep.mp3 | [Flock of sheep pass by](https://freesound.org/people/sandeepkurissery/sounds/245183/) | sandeepkurissery | DJ WoodZ (CC0 1.0) |
| hen.mp3 | [Chicken Single Alarm Call](https://freesound.org/people/Rudmer_Rotteveel/sounds/316920/) | Rudmer_Rotteveel | DJ WoodZ (CC0 1.0) |

Animals without a recording are voiced by the app's read-aloud voice.

## Adding more

1. Use only sounds you are allowed to put in an app: CC0 / public domain is
   simplest (for example from freesound.org, filtered to "Creative Commons 0").
   CC BY is fine too if you add the credit to this table.
2. Keep it short (1–3 seconds), mono mp3, named after the animal's `key` in
   `src/explore/animals.ts` (for example `lion.mp3`).
3. Add it to `RECORDINGS` in `src/explore/animalSounds.ts` and to
   `RECORDED_CALLS` in `src/explore/recordings.ts` (that also adds it to the
   "Listen! Which animal makes this sound?" questions).
