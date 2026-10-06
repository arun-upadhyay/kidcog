# Animal sound credits

All recordings here are **CC0 1.0 or public-domain works**, so they may be used
in the app without payment or attribution. Credits are kept anyway, so it is
always clear where each sound came from.

| File | Original | Recorded by | Prepared by |
|---|---|---|---|
| cow.mp3 | [Cow moos](https://freesound.org/people/josephsardin/sounds/177253/) | josephsardin | [DJ WoodZ, Animal-Sounds](https://github.com/DJWoodZ/Animal-Sounds) (CC0 1.0) |
| pig.mp3 | [Pig - Multiple Snorts 3](https://freesound.org/people/JarredGibb/sounds/233182/) | JarredGibb | DJ WoodZ (CC0 1.0) |
| sheep.mp3 | [Flock of sheep pass by](https://freesound.org/people/sandeepkurissery/sounds/245183/) | sandeepkurissery | DJ WoodZ (CC0 1.0) |
| hen.mp3 | [Chicken Single Alarm Call](https://freesound.org/people/Rudmer_Rotteveel/sounds/316920/) | Rudmer_Rotteveel | DJ WoodZ (CC0 1.0) |

The following real field recordings came through the
[WilhelmSFX](https://github.com/Wh1teDuke/WilhelmSFX) CC0 sound bank. KidCog
downsampled the WAV files to 22.05 kHz mono to keep the mobile download small;
no synthetic voice was added.

| KidCog file | Original recording |
|---|---|
| dog.wav | [Single dog bark — kwahmah_02](https://freesound.org/people/kwahmah_02/sounds/277058/) |
| cat.wav | [Cat meow — Countrygirls13](https://freesound.org/people/Countrygirls13/sounds/763906/) |
| horse.wav | [Horse — madklown](https://freesound.org/people/madklown/sounds/184503/) |
| rooster.wav | [Rooster crow — harrisonlace](https://freesound.org/people/harrisonlace/sounds/842587/) |
| duck.wav | [Ducks — D4XX](https://freesound.org/people/D4XX/sounds/607226/) |
| goat.wav | [Goat — beskhu](https://freesound.org/people/beskhu/sounds/273911/) |
| mouse.wav | [Mouse recording — SieuAmThanh](https://freesound.org/people/SieuAmThanh/sounds/397651/) |
| lion.wav | [Lion growl — LilMati](https://freesound.org/people/LilMati/sounds/516829/) |
| bear.mp3 | [Grizzly vocalization — US National Park Service](https://www.nps.gov/yell/learn/photosmultimedia/grizzlysounds.htm) |
| wolf.wav | [Wild wolf howl — betchkal](https://freesound.org/people/betchkal/sounds/500646/) |
| snake.wav | [Snake — florianreichelt](https://freesound.org/people/florianreichelt/sounds/423454/) |
| frog.mp3 | [Frog — katzlbt](https://freesound.org/people/katzlbt/sounds/361117/) |
| owl.wav | [Owl hooting — Gerent](https://freesound.org/people/Gerent/sounds/558397/) |
| dove.wav | [Dove call — 5ro4](https://freesound.org/people/5ro4/sounds/795719/) |
| cricket.wav | [Single cricket — HECKFRICKER](https://freesound.org/people/HECKFRICKER/sounds/753271/) |
| mosquito.wav | [Mosquito — danielp27](https://freesound.org/people/danielp27/sounds/409354/) |

Animals without a verified recording do not appear in Animal Sounds and do not
show a “Hear it” button. They are never replaced by somebody speaking the sound.

## Adding more

1. Use only sounds you are allowed to put in an app: CC0 / public domain is
   simplest (for example from freesound.org, filtered to "Creative Commons 0").
   CC BY is fine too if you add the credit to this table.
2. Keep it short (1–3 seconds), mono mp3, named after the animal's `key` in
   `src/explore/animals.ts` (for example `lion.mp3`).
3. Add it to `RECORDINGS` in `src/explore/animalSounds.ts` and to
   `RECORDED_CALLS` in `src/explore/recordings.ts` (that also adds it to the
   "Listen! Which animal makes this sound?" questions).
