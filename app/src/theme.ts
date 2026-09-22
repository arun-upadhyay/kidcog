import type { TextStyle } from 'react-native';

export const colors = {
  bg: '#F7F5F2',
  surface: '#FFFFFF',
  ink: '#1E1B18',
  inkSoft: '#6B6259',
  line: '#E4DFD8',
  accent: '#2F6F5E',
  accentSoft: '#E3EFEA',
  warn: '#B45309',
  danger: '#B4413A',
} as const;

export const spacing = (n: number): number => n * 8;

export const type = {
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  heading: { fontSize: 19, fontWeight: '700', color: colors.ink },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  soft: { fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, color: colors.inkSoft },
} satisfies Record<string, TextStyle>;
