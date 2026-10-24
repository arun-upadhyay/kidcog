import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Owl from '../components/Owl';
import { useSoundEffects } from '../games/sounds';
import { setMusicOn, useMusicOn } from './gameMusic';
import Button from '../components/Button';
import { colors, spacing, CONTENT_MAX_WIDTH, GUTTER } from '../theme';
import { speak, stopSpeaking } from '../speech';
import { isAudioFocused, subscribeAudioFocus } from '../audioFocus';

/** Active games stop when a child switches tabs/apps; resuming is deliberate. */
export function usePauseWhenAway(pause: () => void) {
  const latest = useRef(pause);
  latest.current = pause;
  useEffect(() => {
    if (!isAudioFocused()) latest.current();
    return subscribeAudioFocus(active => { if (!active) latest.current(); });
  }, []);
}

export type Dir = 'up' | 'down' | 'left' | 'right';
export type GameKey = import('./learningContent').LearningKey | 'animals' | 'snake' | 'bubbles' | 'maze' | 'trace' | 'dots' | 'add' | 'states' | 'art-music';
export const useNative = Platform.OS !== 'web';

// Declare before touch-down: changing scrollEnabled after a gesture begins
// is too late to prevent the browser from taking over a drawing stroke.
export const drawingTouchStyle = Platform.OS === 'web'
  ? ({ touchAction: 'none', userSelect: 'none', overscrollBehavior: 'contain' } as object)
  : undefined;


/**
 * The height a game can really use: the window minus the status bar / notch
 * and the home bar. Sizing boards from the whole window put the controls under
 * the home bar on notched iPhones and most Androids.
 */
export function useUsableHeight() {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return height - insets.top - insets.bottom;
}

/**
 * Games sit inside a scrolling page (so small screens can still reach every
 * control). While a finger is on a game board the page must not scroll, or a
 * swipe or a traced line would move the page instead of the snake or the pen.
 * Boards call lock(true) when touched and lock(false) when the finger lifts.
 */
export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});
/** A stable lock function (safe to call from PanResponders created once). */
export function useScrollLock() {
  const lock = useContext(ScrollLockContext);
  const ref = useRef(lock);
  ref.current = lock;
  return useMemo(() => (locked: boolean) => ref.current(locked), []);
}

/** The board size that fits the screen: full width on a phone, capped on a laptop. */
export function useBoardSize(max = 460) {
  const { width } = useWindowDimensions();
  const height = useUsableHeight();
  return Math.floor(Math.min(width - GUTTER * 2, max, CONTENT_MAX_WIDTH - GUTTER * 2, height * 0.55));
}

/** Shared responsive adventure panel for every Play Zone game. */
export function GameSurface({ theme, eyebrow, title, badgeLabel, badge, onWidth, children }: {
  theme: 'green' | 'blue' | 'purple' | 'coral'; eyebrow: string; title: string;
  badgeLabel: string; badge: string | number; onWidth: (width: number) => void; children: React.ReactNode;
}) {
  const [panelWidth, setPanelWidth] = useState(320);
  const height = useUsableHeight();
  const compact = height < 650;
  const landscape = height < 450;
  // Fill the panel inside its 12px padding on either side.
  // Short screens use a compact header; games reserve height for their controls.
  const boardSize = Math.max(1, panelWidth - 24);
  useEffect(() => { onWidth(boardSize); }, [boardSize, onWidth]);
  const palette = {
    green: ['#F2F7EC', '#235E46'], blue: ['#EDF7FF', '#286A98'],
    purple: ['#F3EEFF', '#60439B'], coral: ['#FFF0E9', '#A44530'],
  }[theme];
  return <View onLayout={e => setPanelWidth(e.nativeEvent.layout.width)}
    style={{ width: '100%', maxWidth: 1000, alignItems: 'center', gap: compact ? 4 : 12, padding: 12, backgroundColor: palette[0], borderRadius: 28 }}>
    {!landscape && <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 4 }}>
      <View style={{ flex: 1 }}><Text style={{ fontSize: 10, letterSpacing: 1.4, fontWeight: '900', color: palette[1] }}>{eyebrow}</Text>
      <Text style={{ fontSize: compact ? 16 : 23, fontWeight: '900', color: palette[1], marginTop: 5 }}>{title}</Text></View>
      <View style={{ backgroundColor: '#FFF1BD', borderWidth: 2, borderColor: '#F3D273', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 9, fontWeight: '900', color: '#805218', letterSpacing: 1 }}>{badgeLabel}</Text>
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#805218' }}>{badge}</Text>
      </View>
    </View>}
    {children}
  </View>;
}

export function GameStartCard({ emoji, title, hint, onStart, resume = false }: {
  emoji: string; title: string; hint: string; onStart: () => void; resume?: boolean;
}) {
  const height = useUsableHeight();
  const compact = height < 650;
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(235,245,240,0.35)', alignItems: 'center', justifyContent: 'center' }]}>
    <View style={{ width: '86%', maxWidth: 330, padding: 12, gap: 8, alignItems: 'center', borderRadius: 26, backgroundColor: '#FFFCF3', borderWidth: 2, borderColor: '#FFFFFF' }}>
      {!compact && <Text style={{ fontSize: 32 }}>{emoji}</Text>}
      {!compact && <Text style={{ fontSize: 20, fontWeight: '900', color: '#4E3590', textAlign: 'center' }}>{title}</Text>}
      <Text style={{ fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' }}>{hint}</Text>
      <Pressable accessibilityRole="button" accessibilityHint={hint} onPress={onStart} style={({ pressed }) => ({ backgroundColor: '#7650C7', borderRadius: 18, paddingVertical: 14, paddingHorizontal: compact ? 12 : 28, opacity: pressed ? 0.8 : 1 })}>
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
export function useSwipe(onDir: (dir: Dir) => void, allowChildPress = false) {
  const handler = useRef(onDir);
  handler.current = onDir;
  const lock = useScrollLock();
  return useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !allowChildPress,
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => lock(true),
    onPanResponderTerminate: () => lock(false),
    onPanResponderRelease: (_e, g) => {
      lock(false);
      if (Math.max(Math.abs(g.dx), Math.abs(g.dy)) < 18) return;
      handler.current(Math.abs(g.dx) > Math.abs(g.dy) ? (g.dx > 0 ? 'right' : 'left') : (g.dy > 0 ? 'down' : 'up'));
    },
  }), [lock, allowChildPress]);
}

/** Big arrow buttons for small fingers (and anyone without a keyboard). */
export function DirPad({ onDir, disabled, optional = false }: { onDir: (dir: Dir) => void; disabled?: boolean; optional?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const key = (dir: Dir, label: string) => (
    <Pressable key={dir} onPress={() => onDir(dir)} disabled={disabled} accessibilityRole="button" accessibilityLabel={`Go ${dir}`}
      style={({ pressed }) => [styles.padKey, pressed && styles.padKeyPressed, disabled && { opacity: 0.4 }]}>
      <Text style={styles.padText}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={styles.pad}>
      {optional ? <Pressable accessibilityRole="button" accessibilityLabel="Arrow controls" accessibilityState={{ expanded }} onPress={() => setExpanded(v => !v)} style={{ minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' }}><Text style={{ color: '#5D439B', fontWeight: '700' }}>{expanded ? 'Hide arrows ▴' : 'Use arrows ▾'}</Text></Pressable> : null}
      {!optional || expanded ? <>
        <View style={styles.padRow}>{key('up', '▲')}</View>
        <View style={styles.padRow}>{key('left', '◀')}{key('down', '▼')}{key('right', '▶')}</View>
      </> : null}
    </View>
  );
}

/** What Owl says when a game opens (and again on ?). Games with a hint use it. */
const INTROS: Record<string, string> = {
  'Number Snake': 'Hi, I am Owl! Help the snake eat the numbers in order: one, then two, then three. Use the arrows, or swipe!',
  'Bubble Pop': 'Bubbles are floating up! Listen to the rule, then pop only the bubbles that match.',
  'Maze Runner': 'Help me find my way to the flag! Tap a glowing space beside me, or swipe to move. Pick up stars on the way.',
  'Trace & Draw': 'Let us write! Put your finger on the green dot and follow the line.',
  'Dot to Dot': 'Join the dots: one, then two, then three. Watch a picture appear!',
  'Magic Add': 'Abracadabra! Tap the numbers that add up to my magic number. Too much? Just try again!',
};
const plain = (text: string) => text.replace(/\p{Extended_Pictographic}|\uFE0F/gu, '').replace(/\s+/g, ' ').trim();

/** A big round button for the game's top bar (✕, ?, 🎵). */
function RoundButton({ icon, label, colour, lip, onPress, size }: { icon: string; label: string; colour: string; lip: string; onPress: () => void; size: number }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: colour, borderColor: lip, borderBottomWidth: pressed ? 2 : 5 }, pressed && { marginTop: 3 }]}>
      <Text style={[styles.roundIcon, { fontSize: size * 0.42 }]}>{icon}</Text>
    </Pressable>
  );
}

/**
 * Owl pops up in the corner and tells the child what to do (spoken out loud
 * when the game opens, and again on ?). It never blocks the game: taps go
 * straight through it, and it slides away after a few seconds.
 */
function OwlIntro({ text, nonce, top }: { text: string; nonce: number; top: number }) {
  const slide = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  const { width } = useWindowDimensions();
  useEffect(() => {
    if (!nonce) return;
    setShown(true);
    slide.setValue(0);
    Animated.spring(slide, { toValue: 1, friction: 6, useNativeDriver: useNative }).start();
    const timer = setTimeout(() => {
      Animated.timing(slide, { toValue: 0, duration: 260, useNativeDriver: useNative }).start(() => setShown(false));
    }, Math.min(9000, 2500 + text.length * 55));
    return () => clearTimeout(timer);
  }, [nonce, slide, text]);
  if (!shown) return null;
  return (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={[styles.intro, { top, maxWidth: Math.min(460, width - 24), opacity: slide, transform: [
      { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
    ] }]}>
      <Owl mood="happy" size={width < 400 ? 54 : 72} />
      <View style={styles.introBubble}><Text style={[styles.introText, width < 400 && styles.introTextSmall]}>{text}</Text></View>
    </Animated.View>
  );
}

/**
 * The frame around every game: a big ✕ to leave, the game's name and level,
 * ? to hear how to play again, and 🎵 for the music. When the game opens, Owl
 * pops up and says how to play.
 */
export function GameFrame({ emoji, title, level, onBack, children, hint, intro }: {
  emoji: string; title: string; level: number; onBack: () => void; children: React.ReactNode; hint?: string;
  /** What Owl says when the game opens; defaults to the game's usual words, then the hint. */
  intro?: string;
}) {
  const { width } = useWindowDimensions();
  const screenHeight = useUsableHeight();
  const musicOn = useMusicOn();
  const sounds = useSoundEffects();
  const words = intro ?? INTROS[title] ?? hint ?? '';
  const [introNonce, setIntroNonce] = useState(0);
  const big = width >= 700;
  const size = big ? 64 : screenHeight < 700 ? 44 : 52;
  // In a browser on a computer or tablet: one tap makes the game fill the whole screen.
  const canFull = Platform.OS === 'web' && big && typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!canFull) return;
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    return () => { document.removeEventListener('fullscreenchange', sync); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  }, [canFull]);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  };
  const sayIntro = (out: boolean) => {
    setIntroNonce(n => n + 1);
    if (out && words) { stopSpeaking(); void speak(plain(words)); }
  };
  // Owl explains the game as it opens (the tap that opened it lets the browser play sound).
  useEffect(() => { sayIntro(sounds); return () => stopSpeaking(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={styles.frame}>
      <View style={styles.topBar}>
        <RoundButton icon="✕" label="Back to the Play Zone" colour="#E5533D" lip="#B23A27" onPress={onBack} size={size} />
        <View style={[styles.titlePill, !big && styles.titlePillStacked]}>
          <Text style={[styles.title, big && styles.titleBig]} numberOfLines={1}>{emoji} {title}</Text>
          <Text style={[styles.level, !big && styles.levelSmall]}>Level {level}</Text>
        </View>
        <RoundButton icon="?" label="How to play" colour="#2F7BDB" lip="#1D57A6" onPress={() => sayIntro(true)} size={size} />
        {canFull ? <RoundButton icon={full ? '⤡' : '⤢'} label={full ? 'Leave full screen' : 'Full screen'} colour="#2F9A5B" lip="#1F7042" onPress={toggleFull} size={size} /> : null}
        <RoundButton icon={musicOn ? '🎵' : '🔇'} label={musicOn ? 'Turn the music off' : 'Turn the music on'} colour="#FFC83D" lip="#D29A0E" onPress={() => setMusicOn(!musicOn)} size={size} />
      </View>
      {hint ? (
        <View style={styles.hintRow}>
          <Text style={styles.hint}>{hint}</Text>
          {/* Tap to hear the rule: most players can't read it yet. */}
          <Pressable onPress={() => { stopSpeaking(); void speak(plain(hint)); }}
            accessibilityRole="button" accessibilityLabel={`Hear: ${hint}`} hitSlop={12}
            style={({ pressed }) => [styles.hintSpeaker, pressed && { transform: [{ scale: 0.9 }] }]}>
            <Text style={styles.hintSpeakerText}>🔊</Text>
          </Pressable>
        </View>
      ) : null}
      {children}
      {words ? <OwlIntro text={words} nonce={introNonce} top={size + 8} /> : null}
    </View>
  );
}

/** The bright sky, clouds and hills behind every game (fills the whole screen). */
export function GameScene() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8FD8F8" />
            <Stop offset="0.55" stopColor="#D8F1FB" />
            <Stop offset="1" stopColor="#FFF6E5" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#sky)" />
        <Path d="M0 88 Q18 78 36 86 T72 84 T100 82 L100 100 L0 100 Z" fill="#BFE7B9" />
        <Path d="M0 94 Q22 86 46 93 T100 90 L100 100 L0 100 Z" fill="#A4DB9C" />
      </Svg>
      {[{ left: '6%', top: '7%', s: 1 }, { left: '72%', top: '4%', s: 1.3 }, { left: '40%', top: '15%', s: 0.8 }].map((c, i) => (
        <View key={i} style={[styles.cloud, { left: c.left as `${number}%`, top: c.top as `${number}%`, transform: [{ scale: c.s }] }]}>
          <View style={[styles.puff, { width: 60, height: 34, left: 0, top: 14 }]} />
          <View style={[styles.puff, { width: 44, height: 44, left: 14, top: 0 }]} />
          <View style={[styles.puff, { width: 36, height: 30, left: 40, top: 12 }]} />
        </View>
      ))}
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
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
  roundIcon: { color: '#FFFFFF', fontWeight: '900' },
  titlePill: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(1), backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 999, borderWidth: 2.5, borderColor: '#FFFFFF', paddingHorizontal: spacing(1.5), minHeight: 46 },
  title: { flexShrink: 1, fontSize: 18, fontWeight: '900', color: '#3F3126', textAlign: 'center' },
  titleBig: { fontSize: 24 },
  level: { fontSize: 13, fontWeight: '900', color: '#4E3590', backgroundColor: '#EEE9FF', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: 4, overflow: 'hidden' },
  intro: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-start', gap: 4, zIndex: 30 },
  introBubble: { flexShrink: 1, backgroundColor: '#FFFFFF', borderRadius: 22, borderTopLeftRadius: 6, borderWidth: 3, borderColor: '#FFC83D', paddingHorizontal: spacing(1.75), paddingVertical: spacing(1.25), marginTop: spacing(2), shadowColor: '#2A2118', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  introText: { fontSize: 17, lineHeight: 23, fontWeight: '800', color: '#3F3126' },
  introTextSmall: { fontSize: 15, lineHeight: 20 },
  titlePillStacked: { flexDirection: 'column', gap: 0, paddingVertical: 3 },
  levelSmall: { fontSize: 11, paddingVertical: 1, paddingHorizontal: 8 },
  cloud: { position: 'absolute', width: 80, height: 50 },
  puff: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(1), alignSelf: 'center', maxWidth: '100%', backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 999, paddingHorizontal: spacing(1.75), paddingVertical: 3 },
  // Negative margin: the speaker sits beside the hint without making the row
  // taller, so the games keep their board and controls on screen.
  hintSpeaker: { width: 32, height: 32, marginVertical: -6, borderRadius: 16, backgroundColor: '#EEE9FF', borderWidth: 1.5, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center' },
  hintSpeakerText: { fontSize: 15 },
  hint: { flexShrink: 1, fontSize: 16, fontWeight: '800', color: '#513A27', textAlign: 'center' },
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
