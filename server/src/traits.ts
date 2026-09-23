/**
 * The Intellectual Ability traits.
 *
 * Taken from the structure of the Harmony Public Schools GATE parent referral
 * rating scale. Worth being precise about what that form is: a PARENT rating
 * scale. An adult who knows the child scores each trait 0-5 from their own
 * observation over months. It is not a test the child sits.
 *
 * So this app cannot replace it, and should not imply it does. What it can do
 * is give a parent evidence for some of those rows — a child who worked out a
 * cause-and-effect item unprompted is something you can point at when rating
 * "sees cause and effect", rather than rating it on a vague impression.
 *
 * The traits differ in how reachable they are, and pretending otherwise would
 * produce confident numbers with nothing behind them:
 *
 *   `measurable: 'direct'`    a question can show it
 *   `measurable: 'inferred'`  only visible in HOW a child answers, so it comes
 *                             from the model reading open responses
 *   `measurable: 'behaviour'` only visible in what a child chooses to do, so
 *                             it is measured by an actual choice in the app
 *
 * A trait with no evidence in a session is reported as "not seen", never as
 * zero. Absence of evidence is not evidence of absence, and a parent reading a
 * 0 next to "demonstrates great curiosity" would take it as the latter.
 */

export type TraitKey =
  | 'abstract_concepts'
  | 'beyond_experience'
  | 'generalization'
  | 'cause_effect'
  | 'challenge_seeking'
  | 'curiosity'
  | 'original_methods'
  | 'observant'
  | 'perfectionism'
  | 'strong_ideas'
  | 'questions_authority'
  | 'motivation_focus'
  | 'humor'
  | 'sensitivity_others';

export type Measurability = 'direct' | 'inferred' | 'behaviour';

export interface TraitMeta {
  key: TraitKey;
  group?: 'intellectual' | 'social_emotional';
  /** Wording kept close to the form, so a parent can match rows to rows. */
  label: string;
  /** What this looks like in a child, in plain language. */
  blurb: string;
  measurable: Measurability;
}

export const TRAITS: Record<TraitKey, TraitMeta> = {
  perfectionism: { key: 'perfectionism', label: 'Perfectionism', blurb: 'Explores caring about work while handling mistakes and knowing when to finish.', measurable: 'direct', group: 'social_emotional' },
  strong_ideas: { key: 'strong_ideas', label: 'Strong ideas, beliefs, and opinions', blurb: 'Explains an opinion and considers other viewpoints without needing to argue.', measurable: 'direct', group: 'social_emotional' },
  questions_authority: { key: 'questions_authority', label: 'Questions authority', blurb: 'Asks thoughtful questions about rules and reasons, with respect and safety.', measurable: 'direct', group: 'social_emotional' },
  motivation_focus: { key: 'motivation_focus', label: 'Motivation for and intense focus on tasks', blurb: 'Explores interest, effort, and strategies for staying with a chosen task.', measurable: 'direct', group: 'social_emotional' },
  humor: { key: 'humor', label: 'Humor, original jokes, and puns', blurb: 'Plays with ideas and words in a kind, imaginative way.', measurable: 'direct', group: 'social_emotional' },
  sensitivity_others: { key: 'sensitivity_others', label: 'Sensitive to the needs of others', blurb: 'Notices how someone may feel and suggests thoughtful ways to help.', measurable: 'direct', group: 'social_emotional' },
  abstract_concepts: {
    key: 'abstract_concepts',
    label: 'Comprehends abstract ideas and concepts',
    blurb:
      'Works with an idea that has no physical form — a rule, a category, a relationship — rather than only with concrete things.',
    measurable: 'direct',
  },
  beyond_experience: {
    key: 'beyond_experience',
    label: 'Considers problems outside their own experience',
    blurb:
      'Reasons about a situation they have never been in, instead of only what has happened to them.',
    measurable: 'direct',
  },
  generalization: {
    key: 'generalization',
    label: 'Makes quick and valid generalizations',
    blurb: 'Spots the rule behind a few examples and carries it correctly into a new case.',
    measurable: 'direct',
  },
  cause_effect: {
    key: 'cause_effect',
    label: 'Sees cause and effect',
    blurb: 'Works out what led to what, and what would follow from a change.',
    measurable: 'direct',
  },
  observant: {
    key: 'observant',
    label: 'Is keenly observant',
    blurb: 'Notices detail and difference that others pass over.',
    measurable: 'direct',
  },
  challenge_seeking: {
    key: 'challenge_seeking',
    label: 'Chooses and enjoys challenging tasks',
    blurb: 'Given the option of something easy or something hard, reaches for the hard one.',
    // Measured by an actual choice in the app. No question can ask a child
    // whether they enjoy difficulty and get a useful answer.
    measurable: 'behaviour',
  },
  curiosity: {
    key: 'curiosity',
    label: 'Demonstrates great curiosity; asks how, why, what if',
    blurb: 'Wonders beyond the question asked — raises their own questions and possibilities.',
    measurable: 'inferred',
  },
  original_methods: {
    key: 'original_methods',
    label: 'Chooses original methods',
    blurb: 'Reaches a correct answer by an unusual route, rather than the expected one.',
    measurable: 'inferred',
  },
};

export const TRAIT_KEYS = Object.keys(TRAITS) as TraitKey[];

/** The order the form lists them in, which is the order a parent will read. */
export const TRAIT_ORDER: TraitKey[] = [
  'abstract_concepts',
  'beyond_experience',
  'generalization',
  'cause_effect',
  'challenge_seeking',
  'curiosity',
  'original_methods',
  'observant',
  'perfectionism',
  'strong_ideas',
  'questions_authority',
  'motivation_focus',
  'humor',
  'sensitivity_others',
];

/** A 1–5 activity evidence indicator, not the school's norm-based rating. */
export function formScaleFor(percent: number): { value: number; label: string } {
  if (percent >= 90) return { value: 5, label: 'Strong evidence' };
  if (percent >= 70) return { value: 4, label: 'Clear evidence' };
  if (percent >= 45) return { value: 3, label: 'Developing evidence' };
  if (percent >= 20) return { value: 2, label: 'Some evidence' };
  return { value: 1, label: 'Limited evidence' };
}

export const CATEGORY_GROUPS = [
  { key: 'intellectual' as const, label: 'Intellectual Ability' },
  { key: 'social_emotional' as const, label: 'Social/Emotional/Behavioral' },
];
