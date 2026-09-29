import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { playSound } from '../games/sounds';
import { colors, spacing } from '../theme';
import { GameSurface, GameStartCard, GameFrame, WinCard, randomInt, useNative } from './common';

/**
 * Bubble Pop: bubbles float up; pop only the ones that match the rule
 * ("pop the bubbles with 3 apples", "pop the triangles", "pop even numbers").
 * A wrong tap just wobbles the bubble. Missed bubbles float away; no penalty.
 */
type Rule = { hint: string; goal: number; spawnMs: number; riseMs: number; make: (target: boolean) => string };

const FRUIT = ['🍎', '⭐', '🐟', '🌸', '🍓', '🐞'];
const SHAPES = ['🔺', '🔵', '🟩', '⭐', '🔶', '💜'];
const SHAPE_NAMES: Record<string, string> = { '🔺': 'triangles', '🔵': 'circles', '🟩': 'squares', '⭐': 'stars', '🔶': 'diamonds', '💜': 'hearts' };
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
const other = (n: number, min: number, max: number) => { let v = n; while (v === n) v = randomInt(min, max); return v; };

function ruleFor(level: number): Rule {
  switch (level) {
    case 1: {
      const n = randomInt(1, 3); const f = pick(FRUIT);
      return { hint: `Pop the bubbles with ${n} ${f}`, goal: 8, spawnMs: 1100, riseMs: 8000, make: t => f.repeat(t ? n : other(n, 1, 3)) };
    }
    case 2: {
      const s = pick(SHAPES);
      return { hint: `Pop the ${SHAPE_NAMES[s]} ${s}`, goal: 10, spawnMs: 950, riseMs: 7500, make: t => (t ? s : pick(SHAPES.filter(x => x !== s))) };
    }
    case 3: {
      const n = randomInt(2, 5); const f = pick(FRUIT);
      return { hint: `Pop the bubbles with ${n} ${f}`, goal: 10, spawnMs: 900, riseMs: 7000, make: t => f.repeat(t ? n : other(n, 1, 5)) };
    }
    case 4:
      return { hint: 'Pop the numbers bigger than 5', goal: 12, spawnMs: 850, riseMs: 6500, make: t => String(t ? randomInt(6, 10) : randomInt(1, 5)) };
    default:
      return { hint: 'Pop the even numbers (2, 4, 6…)', goal: 12, spawnMs: 800, riseMs: 6000, make: t => String(t ? randomInt(1, 10) * 2 : randomInt(0, 9) * 2 + 1) };
  }
}

type Bubble = { id: number; x: number; label: string; target: boolean; rise: Animated.Value; wobble: Animated.Value; hue: string };
const HUES = ['#DDEFFF', '#FFE3EC', '#E6F7E9', '#FFF3CC', '#EEE8FF'];

export default function BubblePop({ level: startLevel, onBack, onFinish }: {
  level: number; onBack: () => void; onFinish: (stars: number, nextLevel: number) => void;
}) {
  const [level, setLevel] = useState(Math.min(5, Math.max(1, startLevel)));
  const [width, setBoardWidth] = useState(320);
  const height = Math.round(width * 0.9);
  const size = Math.min(110, Math.round(width / 4.3));
  const [rule, setRule] = useState(() => ruleFor(level));
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [popped, setPopped] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const nextId = useRef(0);
  const sinceTarget = useRef(0);

  const reset = useCallback((lvl = level) => {
    setRule(ruleFor(lvl)); setBubbles([]); setPopped(0); setMistakes(0); setWon(null); setRunning(false); sinceTarget.current = 0;
  }, [level]);
  useEffect(() => { reset(level); }, [level]); // eslint-disable-line react-hooks/exhaustive-deps

  // New bubbles while playing: about 45% match, and never more than 3 misses in a row.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      const target = sinceTarget.current >= 2 || Math.random() < 0.45;
      sinceTarget.current = target ? 0 : sinceTarget.current + 1;
      const b: Bubble = { id: ++nextId.current, x: randomInt(0, width - size), label: rule.make(target), target, rise: new Animated.Value(0), wobble: new Animated.Value(0), hue: HUES[nextId.current % HUES.length]! };
      setBubbles(list => [...list, b]);
      Animated.timing(b.rise, { toValue: 1, duration: rule.riseMs + randomInt(-600, 600), easing: Easing.linear, useNativeDriver: useNative })
        .start(({ finished }) => { if (finished) setBubbles(list => list.filter(x => x.id !== b.id)); });
    }, rule.spawnMs);
    return () => clearInterval(timer);
  }, [running, rule, width, size]);

  // Pausing freezes the bubbles where they are.
  useEffect(() => { if (!running) bubbles.forEach(b => b.rise.stopAnimation()); }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  function tap(b: Bubble) {
    if (!running) return;
    if (b.target) {
      playSound('pop');
      setBubbles(list => list.filter(x => x.id !== b.id));
      const count = popped + 1;
      setPopped(count);
      if (count >= rule.goal) {
        setRunning(false);
        const stars = mistakes <= 1 ? 3 : mistakes <= 3 ? 2 : 1;
        setWon(stars); playSound('tada'); onFinish(stars, Math.min(5, level + 1));
      }
    } else {
      playSound('oops');
      setMistakes(m => m + 1);
      Animated.sequence([
        Animated.timing(b.wobble, { toValue: 1, duration: 70, useNativeDriver: useNative }),
        Animated.timing(b.wobble, { toValue: -1, duration: 70, useNativeDriver: useNative }),
        Animated.timing(b.wobble, { toValue: 0, duration: 70, useNativeDriver: useNative }),
      ]).start();
    }
  }

  return (
    <GameFrame emoji="🫧" title="Bubble Pop" level={level} onBack={onBack} hint={rule.hint}>
      <GameSurface theme="blue" eyebrow="THE BUBBLE SKY" title="Pop, pop, hooray! 🫧" badgeLabel="POPPED" badge={`${popped} / ${rule.goal}`} onWidth={setBoardWidth}>
      <View style={styles.meter} accessibilityLabel={`${popped} of ${rule.goal} popped`}>
        <View style={[styles.meterFill, { width: `${(popped / rule.goal) * 100}%` }]} />
        <Text style={styles.meterText}>{popped} / {rule.goal}</Text>
      </View>
      <View style={[styles.sky, { width, height }]}>
        {bubbles.map(b => (
          <Animated.View key={b.id} style={[styles.bubbleWrap, { left: b.x, width: size, height: size, transform: [
            { translateY: b.rise.interpolate({ inputRange: [0, 1], outputRange: [height, -size] }) },
            { translateX: b.wobble.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) },
          ] }]}>
            <Pressable onPress={() => tap(b)} accessibilityRole="button" accessibilityLabel={`Bubble ${b.label}`}
              style={[styles.bubble, { borderRadius: size / 2, backgroundColor: b.hue }]}>
              <Text style={[styles.bubbleText, { fontSize: b.label.length > 3 ? size * 0.2 : size * 0.3 }]} numberOfLines={2}>{b.label}</Text>
              <View style={[styles.shine, { width: size * 0.22, height: size * 0.12, borderRadius: size }]} />
            </Pressable>
          </Animated.View>
        ))}
        {!running && won === null ? (
          <GameStartCard emoji="🫧" title="Ready to pop?" hint={rule.hint} onStart={() => { setBubbles([]); setRunning(true); }} resume={popped > 0} />
        ) : null}
      </View>
      {running ? <Pressable onPress={() => setRunning(false)} style={styles.pause} accessibilityRole="button"><Text style={styles.pauseText}>⏸ Pause</Text></Pressable> : null}
      </GameSurface>
      {won !== null ? (
        <WinCard stars={won} message={`You popped ${rule.goal} bubbles!`} onExit={onBack} onAgain={() => reset(level)}
          onNext={level < 5 ? () => setLevel(level + 1) : undefined} />
      ) : null}
    </GameFrame>
  );
}

const styles = StyleSheet.create({
  meter: { width: '100%', height: 26, borderRadius: 13, backgroundColor: '#F3EEE7', overflow: 'hidden', justifyContent: 'center' },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: '#8FD3A5' },
  meterText: { textAlign: 'center', fontSize: 14, fontWeight: '900', color: '#2F5D43' },
  sky: { backgroundColor: '#EAF6FF', borderRadius: 24, borderWidth: 3, borderColor: '#A8D4EF', overflow: 'hidden' },
  bubbleWrap: { position: 'absolute', top: 0 },
  bubble: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#2F7FC1', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, padding: 6 },
  bubbleText: { fontWeight: '900', color: '#3F3126', textAlign: 'center' },
  shine: { position: 'absolute', top: '14%', left: '22%', backgroundColor: 'rgba(255,255,255,0.8)', transform: [{ rotate: '-30deg' }] },
  start: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.72)', alignItems: 'center', justifyContent: 'center', gap: spacing(0.75), padding: spacing(2) },
  startText: { fontSize: 24, fontWeight: '900', color: '#2F7FC1' },
  startSub: { fontSize: 16, fontWeight: '800', color: '#513A27', textAlign: 'center' },
  pause: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(2) },
  pauseText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
