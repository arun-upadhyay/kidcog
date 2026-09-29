import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Owl from '../components/Owl';
import Button from '../components/Button';
import { colors, spacing, CONTENT_MAX_WIDTH, GUTTER } from '../theme';

export type Dir = 'up' | 'down' | 'left' | 'right';
export type GameKey = 'snake' | 'bubbles' | 'maze' | 'trace';
export const useNative = Platform.OS !== 'web';

/** The board size that fits the screen: full width on a phone, capped on a laptop. */
export function useBoardSize(max = 460) {
  const { width, height } = useWindowDimensions();
  return Math.floor(Math.min(width - GUTTER * 2, max, CONTENT_MAX_WIDTH - GUTTER * 2, height * 0.55));
}

/** Shared responsive adventure panel for every Play Zone game. */
export function GameSurface({ theme, eyebrow, title, badgeLabel, badge, onWidth, children }: {
  theme: 'green' | 'blue' | 'purple' | 'coral'; eyebrow: string; title: string;
  badgeLabel: string; badge: string | number; onWidth: (width: number) => void; children: React.ReactNode;
}) {
  const [panelWidth, setPanelWidth] = useState(320);
  // Fill the panel inside its 12px padding on either side.
  // The game screen scrolls when the board and controls exceed its height.
  const boardSize = Math.max(1, panelWidth - 24);
  useEffect(() => { onWidth(boardSize); }, [boardSize, onWidth]);
  const palette = {
    green: ['#F2F7EC', '#235E46'], blue: ['#EDF7FF', '#286A98'],
    purple: ['#F3EEFF', '#60439B'], coral: ['#FFF0E9', '#A44530'],
  }[theme];
  return <View onLayout={e => setPanelWidth(e.nativeEvent.layout.width)}
    style={{ width: '100%', maxWidth: 760, alignItems: 'center', gap: 12, padding: 12, backgroundColor: palette[0], borderRadius: 28 }}>
    <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 4 }}>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '900', color: palette[1] }}>{eyebrow}</Text>
      <Text style={{ fontSize: 23, fontWeight: '900', color: palette[1], marginTop: 5 }}>{title}</Text></View>
      <View style={{ backgroundColor: '#FFF1BD', borderWidth: 2, borderColor: '#F3D273', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, fontWeight: '900', color: '#805218', letterSpacing: 1 }}>{badgeLabel}</Text>
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#805218' }}>{badge}</Text>
      </View>
    </View>
    {children}
  </View>;
}

export function GameStartCard({ emoji, title, hint, onStart, resume = false }: {
  emoji: string; title: string; hint: string; onStart: () => void; resume?: boolean;
}) {
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(235,245,240,0.35)', alignItems: 'center', justifyContent: 'center' }]}>
    <View style={{ width: '86%', maxWidth: 330, padding: 12, gap: 8, alignItems: 'center', borderRadius: 26, backgroundColor: '#FFFCF3', borderWidth: 2, borderColor: '#FFFFFF' }}>
      <Text style={{ fontSize: 32 }}>{emoji}</Text>
      <Text style={{ fontSize: 20, fontWeight: '900', color: '#4E3590', textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' }}>{hint}</Text>
      <Pressable accessibilityRole="button" onPress={onStart} style={({ pressed }) => ({ backgroundColor: '#7650C7', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 28, opacity: pressed ? 0.8 : 1 })}>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF' }}>{resume ? '▶ Keep going' : '▶ Tap to start'}</Text>
      </Pressable>
    </View>
  </View>;
}

/** Arrow keys on a computer keyboard (web). */
export function useArrowKeys(onDir: (dir: Dir) => void, enabled = true) {
  const handler = useRef(onDir);
  handler.current = onDir;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return;
    const map: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    const onKey = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (!dir) return;
      e.preventDefault(); // don't scroll the page
      handler.current(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}

/** Swipe in any direction on the board. */
export function useSwipe(onDir: (dir: Dir) => void) {
  const handler = useRef(onDir);
  handler.current = onDir;
  return useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
    onPanResponderRelease: (_e, g) => {
      if (Math.max(Math.abs(g.dx), Math.abs(g.dy)) < 18) return;
      handler.current(Math.abs(g.dx) > Math.abs(g.dy) ? (g.dx > 0 ? 'right' : 'left') : (g.dy > 0 ? 'down' : 'up'));
    },
  }), []);
}

/** Big arrow buttons for small fingers (and anyone without a keyboard). */
export function DirPad({ onDir, disabled }: { onDir: (dir: Dir) => void; disabled?: boolean }) {
  const key = (dir: Dir, label: string) => (
    <Pressable key={dir} onPress={() => onDir(dir)} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Go ${dir}`}
      style={({ pressed }) => [styles.padKey, pressed && styles.padKeyPressed, disabled && { opacity: 0.4 }]}>
      <Text style={styles.padText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.pad}>
      <View style={styles.padRow}>{key('left', '◀')}{key('up', '▲')}{key('down', '▼')}{key('right', '▶')}</View>
    </View>
  );
}

/** The frame around every game: back, title, level, stars. */
export function GameFrame({ emoji, title, level, onBack, children, hint }: {
  emoji: string; title: string; level: number; onBack: () => void; children: React.ReactNode; hint?: string;
}) {
  return (
    <View style={styles.frame}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to the Play Zone" hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
          <Text style={styles.backText}>← Games</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{emoji} {title}</Text>
        <Text style={styles.level}>Level {level}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

/** "You did it!" with the happy owl, 1–3 stars and what to do next. */
export function WinCard({ stars, message, onNext, nextLabel = 'Next level ▶', onAgain, onExit }: {
  stars: number; message: string; onNext?: () => void; nextLabel?: string; onAgain: () => void; onExit: () => void;
}) {
  const pop = useRef(new Animated.Value(0.6)).current;
  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 5, useNativeDriver: useNative }).start(); }, [pop]);
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <Animated.View style={[styles.winCard, { transform: [{ scale: pop }] }]}>
        <Owl mood="happy" size={96} />
        <Text style={styles.winTitle}>You did it!</Text>
        <Text style={styles.winStars} accessibilityLabel={`${stars} stars`}>{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text>
        <Text style={styles.winText}>{message}</Text>
        <View style={{ alignSelf: 'stretch', gap: spacing(1) }}>
          {onNext ? <Button title={nextLabel} onPress={onNext} /> : null}
          <Button title="Play again ↻" variant="secondary" onPress={onAgain} />
          <Pressable onPress={onExit} accessibilityRole="button" style={styles.exit}><Text style={styles.exitText}>Choose another game</Text></Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

export const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: 'center', gap: spacing(1.5) },
  topBar: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  back: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(1.5), borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  backText: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  title: { flex: 1, fontSize: 20, fontWeight: '900', color: '#3F3126', textAlign: 'center' },
  level: { fontSize: 13, fontWeight: '900', color: '#4E3590', backgroundColor: '#EEE9FF', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: 4, overflow: 'hidden' },
  hint: { fontSize: 16, fontWeight: '800', color: '#513A27', textAlign: 'center' },
  pad: { alignItems: 'center', gap: spacing(1) },
  padRow: { flexDirection: 'row', gap: spacing(1) },
  padKey: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#EEE9FF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center' },
  padKeyPressed: { backgroundColor: '#D9CCFA', transform: [{ scale: 0.95 }] },
  padText: { fontSize: 22, color: '#4E3590', fontWeight: '900' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(42,33,24,0.35)', alignItems: 'center', justifyContent: 'center', padding: GUTTER, zIndex: 20 },
  winCard: { width: '100%', maxWidth: 380, backgroundColor: colors.surface, borderRadius: 28, padding: spacing(3), alignItems: 'center', gap: spacing(1.25) },
  winTitle: { fontSize: 28, fontWeight: '900', color: colors.primary },
  winStars: { fontSize: 34, letterSpacing: 4, color: '#E0AA2F' },
  winText: { fontSize: 16, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
  exit: { alignSelf: 'center', minHeight: 40, justifyContent: 'center' },
  exitText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
