import type { TextStyle } from 'react-native';

/**
 * Two palettes, because the audiences are different people.
 *
 * `kid` is what a four-year-old sees: warm, high-contrast, friendly. It is
 * deliberately not neon — saturated primaries everywhere are tiring to look at
 * and make it harder to tell which thing is currently selected.
 *
 * `parent` is the calmer palette for the results and report, which are adult
 * reading material.
 *
 * Contrast note: every text colour below sits at 4.5:1 or better against the
 * surface it is used on. If you change these, re-check that — young children
 * and their tired parents both benefit, and it is an accessibility requirement
 * rather than a preference.
 */
export const colors = {
  // shared
  bg: '#FFF9F0',
  surface: '#FFFFFF',
  ink: '#2A2118',
  inkSoft: '#6B6259',
  line: '#EADFD0',

  // kid-facing
  primary: '#E8724F',
  primarySoft: '#FDEAE3',
  happy: '#F2B441',
  happySoft: '#FEF3DC',
  go: '#3F9A6E',
  goSoft: '#E3F2EA',
  cool: '#4A8FC4',
  coolSoft: '#E5F0F8',

  // parent-facing
  accent: '#2F6F5E',
  accentSoft: '#E3EFEA',
  warn: '#B45309',
  danger: '#B4413A',
} as const;

export const spacing = (n: number): number => n * 8;

/**
 * Scale multiplier from the age profile. A four-year-old's finger is no bigger
 * than an adult's, but their aim is far worse, so targets grow rather than the
 * layout simply zooming.
 */
export const scaled = (n: number, uiScale = 1): number => Math.round(n * uiScale);

export const type = {
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  soft: { fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: colors.inkSoft },
} satisfies Record<string, TextStyle>;

/** Rotating accent colours so consecutive answer cards are distinguishable. */
export const OPTION_COLORS = [
  { bg: colors.coolSoft, border: colors.cool },
  { bg: colors.happySoft, border: colors.happy },
  { bg: colors.goSoft, border: colors.go },
  { bg: colors.primarySoft, border: colors.primary },
] as const;

/** Rotated so a child sees variety rather than the same word every time. */
export const PRAISE = ['Nice one!', 'Good thinking!', 'Well done!', 'Great!', 'Super!'] as const;
