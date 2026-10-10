import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Owl, { type OwlMood } from '../components/Owl';
import { playSound } from '../games/sounds';
import { spacing } from '../theme';
import { GameFrame, GameSurface, WinCard, randomInt, useNative, useUsableHeight } from './common';

/**
 * Magic Add: Owl the wizard asks for a magic number ("Make 5!"). The child
 * taps number stones that add up to it: 2 + 3, or 1 + 1 + 3. When the total
 * is just right the stones vanish in a puff of sparkles and new ones drop in.
 * Too much? The stones wobble, Owl says "oops", and the child simply tries
 * again. Five magic numbers fill Owl's star jar and win the level.
 *
 * The board always holds at least one pair that makes the number, so a child
 * is never stuck (and "New stones" reshuffles if they want a fresh start).
 */

export type AddLevel = { targets: [number, number]; values: [number, number] };
export const ADD_LEVELS: AddLevel[] = [
  { targets: [3, 5], values: [1, 2] }, // 1s and 2s, like counting on fingers
  { targets: [4, 7], values: [1, 4] },
  { targets: [6, 10], values: [1, 5] },
  { targets: [10, 10], values: [1, 9] }, // make ten
  { targets: [11, 15], values: [1, 9] },
];
export const MAKES_PER_LEVEL = 5;
/** A sensible first level for the child's age (4 → 1, 5 → 2, 6 → 3, 7 → 4). */
export const defaultAddLevel = (age?: number) => Math.min(4, Math.max(1, (age ?? 4) - 3));

/** The stone colours, by number (a 2 always looks like a 2). */
const STONES = ['#2BA59A', '#7650C7', '#E5533D', '#E0A514', '#2F7BDB', '#2F9A5B', '#D9488F', '#8A6BC9', '#F08A24'];
const LIPS = ['#1C766E', '#54369A', '#B23A27', '#B07F08', '#1D57A6', '#1F7042', '#A7306A', '#6448A3', '#BD6512'];

type Stone = { id: number; value: number };

/** Fill `count` stones (keeping the ones given), making sure the target can be made. */
export function makeStones(count: number, target: number, level: AddLevel, nextId: () => number, keep: (Stone | null)[] = []): Stone[] {
  const [lo, hi] = level.values;
  const stones = Array.from({ length: count }, (_, i) => keep[i] ?? { id: nextId(), value: randomInt(lo, hi) });
  if (!canMake(stones.map(s => s.value), target)) plant(stones, target, level, nextId, keep);
  return stones;
}

/** True when some stones on the board add up to the target. */
export function canMake(values: number[], target: number) {
  const reach = new Set([0]);
  for (const v of values) for (const r of [...reach]) if (r + v <= target) reach.add(r + v);
  return reach.has(target);
}

/** Put in a few stones that make the target: as few as the level's numbers allow (two at least). */
function plant(stones: Stone[], target: number, level: AddLevel, nextId: () => number, keep: (Stone | null)[]) {
  const [lo, hi] = level.values;
  const k = Math.min(stones.length, Math.max(2, Math.ceil(target / hi)));
  const parts = Array.from({ length: k }, () => lo);
  for (let rest = target - lo * k; rest > 0; rest--) {
    const open = parts.map((v, i) => i).filter(i => parts[i]! < hi);
    const i = open[Math.floor(Math.random() * open.length)]!;
    parts[i]! += 1;
  }
  // Prefer the new slots, so the stones the child is looking at stay put.
  const mix = <T,>(list: T[]) => list.map(v => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const slots = [...mix(stones.map((_, i) => i).filter(i => !keep[i])), ...mix(stones.map((_, i) => i).filter(i => keep[i]))];
  parts.forEach((value, n) => { stones[slots[n]!] = { id: nextId(), value }; });
}

const pickTarget = (level: AddLevel, previous?: number) => {
  const [lo, hi] = level.targets;
  let t = randomInt(lo, hi);
  for (let tries = 0; t === previous && lo !== hi && tries < 5; tries++) t = randomInt(lo, hi);
  return t;
};

export default function MagicAdd({ level: startLevel, onBack, onFinish }: {
  level: number; onBack: () => void; onFinish: (stars: number, nextLevel: number) => void;
}) {
  const [level, setLevel] = useState(Math.min(ADD_LEVELS.length, Math.max(1, startLevel)));
  const config = ADD_LEVELS[level - 1]!;
  const [boardWidth, setBoardWidth] = useState(320);
  const screenHeight = useUsableHeight();
  // Phones turned sideways: the board goes beside the magic number.
  const side = boardWidth >= 560 && screenHeight < 520;
  const compact = screenHeight < 800;
  const columns = side || boardWidth >= 420 ? 5 : 4;
  const rows = compact ? 3 : 4;
  const gap = 8;
  // Height left for the stones after the app bar, the game frame, the magic number and the pot.
  const spare = screenHeight - (side ? 215 : compact ? 395 : 455);
  const across = side ? boardWidth * 0.6 : boardWidth;
  const stoneSize = Math.floor(Math.max(44, Math.min((across - gap * (columns - 1)) / columns, (spare - gap * (rows - 1)) / rows, 96)));

  const idRef = useRef(0);
  const nextId = useCallback(() => ++idRef.current, []);
  const [target, setTarget] = useState(() => pickTarget(config));
  const [stones, setStones] = useState<Stone[]>(() => makeStones(columns * rows, target, config, nextId));
  const [picked, setPicked] = useState<number[]>([]); // stone ids, in the order tapped
  const [made, setMade] = useState(0);
  const [overs, setOvers] = useState(0);
  const [mood, setMood] = useState<OwlMood>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [won, setWon] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const wobble = useRef(new Animated.Value(0)).current;
  const vanish = useRef(new Animated.Value(1)).current;
  const potPop = useRef(new Animated.Value(1)).current;

  const reset = useCallback((lvl: number) => {
    const c = ADD_LEVELS[lvl - 1]!;
    const t = pickTarget(c);
    setTarget(t); setStones(makeStones(columns * rows, t, c, nextId)); setPicked([]); setMade(0); setOvers(0);
    setMood('idle'); setMessage(null); setWon(null); setBusy(false); vanish.setValue(1);
  }, [columns, nextId, vanish]);
  useEffect(() => { reset(level); }, [level]); // eslint-disable-line react-hooks/exhaustive-deps
  // A wider board (rotating an iPad) needs more stones.
  useEffect(() => {
    setStones(list => list.length === columns * rows ? list : makeStones(columns * rows, target, config, nextId, list.slice(0, columns * rows)));
  }, [columns]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = picked.reduce((sum, id) => sum + (stones.find(s => s.id === id)?.value ?? 0), 0);
  const sum = picked.map(id => stones.find(s => s.id === id)?.value ?? 0);

  function tap(stone: Stone) {
    if (busy || won !== null) return;
    if (picked.includes(stone.id)) { setPicked(picked.filter(id => id !== stone.id)); setMessage(null); return; }
    playSound('flip');
    const next = [...picked, stone.id];
    const nextTotal = total + stone.value;
    setPicked(next);
    Animated.sequence([
      Animated.timing(potPop, { toValue: 1.15, duration: 90, useNativeDriver: useNative }),
      Animated.spring(potPop, { toValue: 1, friction: 4, useNativeDriver: useNative }),
    ]).start();
    if (nextTotal === target) magic(next);
    else if (nextTotal > target) tooMuch();
    else { setMood('thinking'); setMessage(null); }
  }

  function magic(ids: number[]) {
    setBusy(true); setMood('happy'); setMessage('✨ Magic! ✨');
    playSound('yay');
    Animated.timing(vanish, { toValue: 0, duration: 380, easing: Easing.in(Easing.back(2)), useNativeDriver: useNative }).start(() => {
      const count = made + 1;
      setMade(count);
      if (count >= MAKES_PER_LEVEL) {
        const stars = overs <= 1 ? 3 : overs <= 3 ? 2 : 1;
        setWon(stars); playSound('tada'); onFinish(stars, Math.min(ADD_LEVELS.length, level + 1));
        setBusy(false); vanish.setValue(1);
        return;
      }
      // New stones drop in where the magic ones were; a new magic number appears.
      const t = pickTarget(config, target);
      setTarget(t);
      setStones(list => makeStones(list.length, t, config, nextId, list.map(s => (ids.includes(s.id) ? null : s))));
      setPicked([]); setMessage(null); setMood('idle');
      vanish.setValue(1);
      setBusy(false);
    });
  }

  function tooMuch() {
    setBusy(true); setMood('oops'); setMessage('Too much! Try again 🙂'); setOvers(o => o + 1);
    playSound('oops');
    Animated.sequence([
      Animated.timing(wobble, { toValue: 1, duration: 70, useNativeDriver: useNative }),
      Animated.timing(wobble, { toValue: -1, duration: 70, useNativeDriver: useNative }),
      Animated.timing(wobble, { toValue: 1, duration: 70, useNativeDriver: useNative }),
      Animated.timing(wobble, { toValue: 0, duration: 70, useNativeDriver: useNative }),
    ]).start(() => {
      setPicked([]); setBusy(false);
      setTimeout(() => { setMessage(m => (m?.startsWith('Too much') ? null : m)); setMood(m => (m === 'oops' ? 'idle' : m)); }, 700);
    });
  }

  function newStones() {
    if (busy) return;
    playSound('whoosh');
    setPicked([]); setMessage(null); setMood('idle');
    setStones(makeStones(columns * rows, target, config, nextId));
  }

  const shuffleButton = (small: boolean) => (
    <Pressable onPress={newStones} accessibilityRole="button" accessibilityLabel="↺ New stones" hitSlop={6}
      style={({ pressed }) => [styles.shuffle, small && styles.shuffleSmall, pressed && { opacity: 0.7 }]}>
      <Text style={styles.shuffleText}>{small ? '↺ New' : '↺ New stones'}</Text>
    </Pressable>
  );

  const hint = `Tap numbers that make ${target} ✨`;
  return (
    <GameFrame emoji="🪄" title="Magic Add" level={level} onBack={onBack} hint={hint}>
      <GameSurface theme="purple" eyebrow="OWL'S MAGIC POT" title="Make the magic number! 🪄" badgeLabel="MADE" badge={`${made} / ${MAKES_PER_LEVEL}`} onWidth={setBoardWidth}>
        <View style={[styles.play, side && styles.playSide]}>
          <View style={[styles.side, side && styles.sideColumn]}>
            {/* The magic number, Owl the wizard and the star jar */}
            <View style={[styles.head, side && styles.headSide]}>
              <Owl size={compact ? 44 : 64} mood={mood} outfit={{ hat: 'wizard' }} />
              <View style={[styles.targetBox, compact && styles.targetBoxCompact]} accessible accessibilityRole="header" accessibilityLabel={`Make ${target}`}>
                <Text style={styles.targetLabel}>MAKE</Text>
                <Text style={[styles.target, compact && styles.targetCompact]}>{target}</Text>
              </View>
              {compact ? shuffleButton(true) : (
                <View style={styles.jar} accessibilityLabel={`${made} of ${MAKES_PER_LEVEL} stars in the jar`}>
                  {Array.from({ length: MAKES_PER_LEVEL }, (_, i) => <Text key={i} style={[styles.jarStar, i >= made && styles.jarStarEmpty]}>{i < made ? '⭐' : '☆'}</Text>)}
                </View>
              )}
            </View>
            {compact ? <View style={styles.jarRow} accessibilityLabel={`${made} of ${MAKES_PER_LEVEL} stars in the jar`}>
              {Array.from({ length: MAKES_PER_LEVEL }, (_, i) => <Text key={i} style={[styles.jarStarSmall, i >= made && styles.jarStarEmpty]}>{i < made ? '⭐' : '☆'}</Text>)}
            </View> : null}

            {/* The pot: what the tapped stones add up to so far */}
            <Animated.View style={[styles.pot, compact && styles.potCompact, total > target && styles.potOver, total === target && total > 0 && styles.potMagic, { transform: [{ scale: potPop }] }]}
              accessibilityLiveRegion="polite" accessibilityLabel={message ?? (sum.length ? `${sum.join(' plus ')} makes ${total}` : 'Tap the numbers')}>
              <Text style={[styles.potText, compact && styles.potTextCompact]} numberOfLines={1} adjustsFontSizeToFit>
                {message ?? (sum.length ? `${sum.join(' + ')} = ${total}` : '🫕 Tap the numbers!')}
              </Text>
            </Animated.View>
          </View>

          {/* The number stones */}
          <View style={[styles.board, { width: columns * stoneSize + gap * (columns - 1), gap }]} accessibilityLabel={`Number stones. Make ${target}`}>
            {stones.map(stone => {
              const on = picked.includes(stone.id);
              const colour = (stone.value - 1) % STONES.length;
              return (
                <Animated.View key={stone.id} style={{ width: stoneSize, height: stoneSize, transform: on ? [
                  { translateX: wobble.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
                  { scale: vanish },
                  { rotate: vanish.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
                ] : [] }}>
                  <Pressable
                    onPress={() => tap(stone)}
                    accessibilityRole="button"
                    accessibilityLabel={`Number ${stone.value}`}
                    accessibilityState={{ selected: on }}
                    testID="magic-stone"
                    style={({ pressed }) => [styles.stone, {
                      borderRadius: stoneSize / 2,
                      backgroundColor: STONES[colour], borderColor: LIPS[colour],
                      borderBottomWidth: on ? 3 : Math.max(5, stoneSize * 0.09),
                    }, on && styles.stoneOn, pressed && styles.stonePressed]}
                  >
                    <Text style={[styles.stoneText, { fontSize: stoneSize * 0.46 }]}>{stone.value}</Text>
                    <View style={[styles.shine, { width: stoneSize * 0.26, height: stoneSize * 0.13, borderRadius: stoneSize }]} />
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </View>

        {compact ? null : shuffleButton(false)}
      </GameSurface>
      {won !== null ? (
        <WinCard stars={won} message={`You made ${MAKES_PER_LEVEL} magic numbers!`} onExit={onBack} onAgain={() => reset(level)}
          onNext={level < ADD_LEVELS.length ? () => setLevel(level + 1) : undefined} />
      ) : null}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  play: { alignSelf: 'stretch', alignItems: 'center', gap: 8 },
  playSide: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing(2) },
  side: { alignSelf: 'stretch', gap: 6 },
  sideColumn: { alignSelf: 'center', flex: 1, maxWidth: 300 },
  headSide: { justifyContent: 'center' },
  targetBoxCompact: { paddingVertical: 0, minWidth: 86, borderBottomWidth: 5 },
  targetCompact: { fontSize: 34, lineHeight: 40 },
  jarRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  jarStarSmall: { fontSize: 15 },
  potCompact: { minHeight: 40 },
  potTextCompact: { fontSize: 18 },
  shuffleSmall: { minHeight: 40, paddingHorizontal: spacing(1.25) },
  head: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1) },
  targetBox: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 26, borderWidth: 3, borderBottomWidth: 7, borderColor: '#9B7EDE', paddingHorizontal: spacing(2.5), paddingVertical: spacing(0.5), minWidth: 104 },
  targetLabel: { fontSize: 12, letterSpacing: 2, fontWeight: '900', color: '#7650C7' },
  target: { fontSize: 46, lineHeight: 52, fontWeight: '900', color: '#4E3590', textShadowColor: '#D9CCFA', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0.01 },
  jar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: 76, gap: 1 },
  jarStar: { fontSize: 18 },
  jarStarEmpty: { color: '#B9A3EC' },
  pot: { alignSelf: 'stretch', minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 999, borderWidth: 2.5, borderColor: '#D9CCFA', paddingHorizontal: spacing(2) },
  potOver: { borderColor: '#F3B7A9', backgroundColor: '#FFF0EC' },
  potMagic: { borderColor: '#FFC83D', backgroundColor: '#FFF4D2' },
  potText: { fontSize: 22, fontWeight: '900', color: '#4E3590' },
  board: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  stone: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  stoneOn: { borderColor: '#FFC83D', borderWidth: 4, transform: [{ translateY: 3 }], shadowColor: '#FFC83D', shadowOpacity: 0.9, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 6 },
  stonePressed: { transform: [{ scale: 0.94 }] },
  stoneText: { fontWeight: '900', color: '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.25)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0.01 },
  shine: { position: 'absolute', top: '13%', left: '22%', backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-30deg' }] },
  shuffle: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing(2), borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2.5, borderBottomWidth: 4, borderColor: '#D9CCFA' },
  shuffleText: { fontSize: 15, fontWeight: '900', color: '#60439B' },
});
