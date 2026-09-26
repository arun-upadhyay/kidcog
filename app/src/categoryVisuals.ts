import type { TraitKey } from './types';

/**
 * The colour and emoji for each category and each group. Shared by the
 * category picker and the results screen, so a parent sees the same purple
 * brain for Intellectual Ability when they pick it and when they read the result.
 */
export const CATEGORY_VISUALS: Record<TraitKey, { icon: string; background: string; border: string }> = {
  abstract_concepts: { icon: '💭', background: '#EEE8FF', border: '#9B7EDE' },
  beyond_experience: { icon: '🌎', background: '#E5F3FF', border: '#65A7D8' },
  generalization: { icon: '🧩', background: '#FFF0D9', border: '#E5A13A' },
  cause_effect: { icon: '🔍', background: '#E2F5EC', border: '#55A77E' },
  challenge_seeking: { icon: '🏔️', background: '#FFE8E1', border: '#E87A5A' },
  curiosity: { icon: '🔭', background: '#E6F1FF', border: '#5A91D6' },
  original_methods: { icon: '🎨', background: '#FCE7F1', border: '#D878A4' },
  observant: { icon: '👀', background: '#FFF3CE', border: '#DDAE35' },
  perfectionism: { icon: '🌱', background: '#E5F4E7', border: '#6EAA72' },
  strong_ideas: { icon: '💬', background: '#EEE8FF', border: '#9278D0' },
  questions_authority: { icon: '⚖️', background: '#E4F2F5', border: '#579BA9' },
  motivation_focus: { icon: '🎯', background: '#FFE8E3', border: '#DF735B' },
  humor: { icon: '😄', background: '#FFF1C9', border: '#E0AA2F' },
  sensitivity_others: { icon: '💛', background: '#FDE6E8', border: '#D87882' },
  extensive_vocabulary: { icon: '💬', background: '#E8F0FF', border: '#668FD1' },
  advanced_reading: { icon: '📚', background: '#FFF0D9', border: '#D99A3B' },
  self_motivated_writing: { icon: '✍️', background: '#FCE7F1', border: '#C96F9B' },
  viewpoint_mood_intention: { icon: '🎭', background: '#EEE8FF', border: '#9278D0' },
  advanced_spelling: { icon: '🔤', background: '#E4F2F5', border: '#579BA9' },
  how_things_work: { icon: '⚙️', background: '#E5F3FF', border: '#65A7D8' },
  mental_math: { icon: '🔢', background: '#FFF3CE', border: '#DDAE35' },
  strategy_games: { icon: '♟️', background: '#E2F5EC', border: '#55A77E' },
  categories_hierarchies: { icon: '🗂️', background: '#FFE8E1', border: '#E87A5A' },
  intuitive_problem_solving: { icon: '💡', background: '#FEF3DC', border: '#E0AA2F' },
};

export const GROUP_VISUALS = {
  intellectual: { icon: '🧠', background: '#EEE9FF', border: '#A68AE2', ink: '#5D439B' },
  social_emotional: { icon: '💛', background: '#FFE9E3', border: '#E88970', ink: '#A84733' },
  verbal_linguistic: { icon: '📚', background: '#E5F3FF', border: '#68A8D6', ink: '#2F6F9D' },
  logical_mathematical: { icon: '🧩', background: '#E5F5EA', border: '#63AA7D', ink: '#34734E' },
} as const;

/**
 * Short, child-friendly names for the category tiles. The official Harmony
 * wording (e.g. "Comprehends abstract ideas and concepts") is still shown in the
 * detail sheet and in results, so parents can match it to the school form.
 */
export const CATEGORY_NAMES: Record<TraitKey, string> = {
  abstract_concepts: 'Big ideas',
  beyond_experience: 'Imagine that!',
  generalization: 'Spot the rule',
  cause_effect: 'What happens next?',
  challenge_seeking: 'Tricky challenges',
  curiosity: 'Why and how?',
  original_methods: 'New ways',
  observant: 'Sharp eyes',
  perfectionism: 'Oops, try again',
  strong_ideas: 'What I think',
  questions_authority: 'Why the rule?',
  motivation_focus: 'Stick with it',
  humor: 'Silly and funny',
  sensitivity_others: 'Kind hearts',
  extensive_vocabulary: 'Word wizard',
  advanced_reading: 'Story time',
  self_motivated_writing: 'Little writer',
  viewpoint_mood_intention: 'How do they feel?',
  advanced_spelling: 'Spelling fun',
  how_things_work: 'How it works',
  mental_math: 'Number magic',
  strategy_games: 'Game plans',
  categories_hierarchies: 'Sort it out',
  intuitive_problem_solving: 'Puzzle solver',
};

/** Short tab names for the four groups. */
export const GROUP_NAMES = {
  intellectual: 'Thinking',
  social_emotional: 'Feelings',
  verbal_linguistic: 'Words',
  logical_mathematical: 'Numbers',
} as const;
