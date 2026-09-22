/**
 * Age profiles.
 *
 * A four-year-old and an eleven-year-old need genuinely different apps, not the
 * same app with bigger buttons. One cannot read, cannot type, tires after a few
 * minutes, and should not be shown a percentage. The other can do all of those
 * things and would find a read-aloud voice patronising.
 *
 * Rather than scatter `if (age < 8)` through the screens, everything that
 * differs lives here, and the profile travels to the app with the test. Adding
 * a band later — a teen profile, a pre-school profile — means adding an entry
 * to PROFILES and nothing else.
 *
 * The rules encoded below are not arbitrary:
 *   - readAloud, because most children under 7 cannot read a sentence reliably.
 *   - openAnswerMode 'voice', because they cannot type one either.
 *   - maxQuestions, because sustained attention at 4-5 runs out well before
 *     fourteen questions do.
 *   - showTimer false, because a visible countdown makes young children rush
 *     and distress rather than think.
 *   - showScoreToChild false, because "40%" means failure to a five-year-old
 *     and means very little to anyone else either.
 */

import type { AgeProfile, AgeProfileKey } from './types.js';

export const PROFILES: Record<AgeProfileKey, AgeProfile> = {
  early: {
    key: 'early',
    label: 'Early years',
    ageBand: [4, 7],
    readAloud: true,
    openAnswerMode: 'voice',
    maxQuestions: 8,
    showTimer: false,
    showScoreToChild: false,
    celebrateEachAnswer: true,
    uiScale: 1.35,
  },
  middle: {
    key: 'middle',
    label: 'Middle years',
    ageBand: [8, 12],
    readAloud: false,
    openAnswerMode: 'text',
    maxQuestions: 20,
    showTimer: true,
    showScoreToChild: true,
    celebrateEachAnswer: false,
    uiScale: 1,
  },
};

/**
 * Which profile an age falls into. Unknown ages get `early`: if we are guessing
 * about a child, guessing younger is the safer error — a nine-year-old finds a
 * read-aloud button mildly annoying, whereas a five-year-old handed a text box
 * simply cannot continue.
 */
export function profileForAge(age?: number): AgeProfile {
  if (age === undefined || Number.isNaN(age)) return PROFILES.early;
  for (const profile of Object.values(PROFILES)) {
    if (age >= profile.ageBand[0] && age <= profile.ageBand[1]) return profile;
  }
  // Older than every band: use the oldest one rather than falling back to early.
  return age > PROFILES.middle.ageBand[1] ? PROFILES.middle : PROFILES.early;
}
