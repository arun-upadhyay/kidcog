import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { playSound } from '../games/sounds';
import { ANIMALS, type Animal } from '../explore/animals';
import { soundKey } from '../explore/animalQuiz';
import { hasRecording, playRecording } from '../explore/animalSounds';
import { colors, spacing } from '../theme';
import { useNative } from './common';

/**
 * Animal sounds, two ways to play:
 *  - Free play: tap an animal, it jumps and plays its real recorded call.
 *  - Guess who: a mystery sound plays; find the animal that makes it.
 * Sounds play only when the child taps (no surprise audio).
 */
// Never put a text-to-speech imitation on this sound board. An animal appears
// only when the app bundles a real recording for it.
const SINGERS = ANIMALS.filter(a => a.says && hasRecording(a.key));
const GROUPS: { title: string; test: (a: Animal) => boolean }[] = [
  { title: '🏡 Farm and home', test: a => a.homes[0] === 'farm' || a.homes[0] === 'house' },
  { title: '🐦 Birds', test: a => a.kind === 'bird' && a.homes[0] !== 'farm' },
  { title: '🐞 Little bugs', test: a => a.kind === 'insect' },
  { title: '🌍 Wild animals', test: () => true },
];
const grouped = (() => {
  const left = [...SINGERS];
  return GROUPS.map(g => {
    const mine = left.filter(g.test);
    mine.forEach(a => left.splice(left.indexOf(a), 1));
    return { title: g.title, animals: mine };
  }).filter(g => g.animals.length);
})();

type Pulse = { key: number; kind: 'sing' | 'right' | 'wrong' };

function Cell({ animal, pulse, onPress, width }: { animal: Animal; pulse: Pulse | null; onPress: () => void; width: string }) {
  const jump = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const bubble = useRef(new Animated.Value(0)).current;
  const [bubbleText, setBubbleText] = useState('');

  useEffect(() => {
    if (!pulse) return;
    if (pulse.kind === 'wrong') {
      shake.setValue(0);
      Animated.sequence([0, 1, 2, 3].map(i => Animated.timing(shake, { toValue: i % 2 ? -1 : 1, duration: 60, useNativeDriver: useNative })).concat(
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: useNative }))).start();
      return;
    }
    setBubbleText(pulse.kind === 'right' ? '🎉 Yes!' : `${animal.says}!`);
    jump.setValue(0); bubble.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: useNative }),
        Animated.spring(jump, { toValue: 0, friction: 3, tension: 120, useNativeDriver: useNative }),
      ]),
      Animated.sequence([
        Animated.timing(bubble, { toValue: 1, duration: 200, useNativeDriver: useNative }),
        Animated.delay(900),
        Animated.timing(bubble, { toValue: 2, duration: 400, useNativeDriver: useNative }),
      ]),
    ]).start();
  }, [pulse, animal.says, jump, shake, bubble]);

  return (
    <View style={{ width: width as `${number}%`, padding: spacing(0.5) }}>
      <Animated.View style={[styles.bubble, {
        opacity: bubble.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 1, 0] }),
        transform: [{ translateY: bubble.interpolate({ inputRange: [0, 1, 2], outputRange: [10, -6, -22] }) }, { scale: bubble.interpolate({ inputRange: [0, 1, 2], outputRange: [0.6, 1, 1] }) }],
      }]} pointerEvents="none">
        <Text style={styles.bubbleText} numberOfLines={1}>{bubbleText}</Text>
      </Animated.View>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Play real ${animal.name} sound`}
        style={({ pressed }) => [styles.cell, pulse?.kind === 'right' && styles.cellRight, pressed && styles.cellPressed]}>
        <Animated.Text style={[styles.cellEmoji, {
          transform: [
            { translateY: jump.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
            { scale: jump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] }) },
            { rotate: shake.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] }) },
          ],
        }]}>{animal.emoji}</Animated.Text>
        <Text style={styles.cellLabel} numberOfLines={1}>{animal.name}</Text>
      </Pressable>
    </View>
  );
}

/** A little burst of stars when a mystery animal is found. */
function Burst({ id }: { id: number }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!id) return;
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start();
  }, [id, t]);
  if (!id) return null;
  const bits = ['⭐', '🎉', '✨', '🌟', '🎈', '✨', '⭐', '🎉'];
  return (
    <View style={styles.burst} pointerEvents="none">
      {bits.map((b, i) => {
        const angle = (i / bits.length) * Math.PI * 2;
        return (
          <Animated.Text key={i} style={[styles.burstBit, {
            opacity: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(angle) * 120] }) },
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(angle) * 90] }) },
              { scale: t.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.3, 1] }) },
            ],
          }]}>{b}</Animated.Text>
        );
      })}
    </View>
  );
}

export default function SoundBoard() {
  const { width } = useWindowDimensions();
  const columns = width < 380 ? 3 : width < 620 ? 4 : 6;
  const cellWidth = `${100 / columns}%`;
  const [mode, setMode] = useState<'free' | 'guess'>('free');
  const [pulses, setPulses] = useState<Record<string, Pulse>>({});
  const [mystery, setMystery] = useState<Animal | null>(null);
  const [found, setFound] = useState(false);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState(0);
  const [burst, setBurst] = useState(0);
  const counter = useRef(0);

  const pulse = (key: string, kind: Pulse['kind']) => setPulses(p => ({ ...p, [key]: { key: ++counter.current, kind } }));

  const playMystery = (a: Animal) => {
    // The sound only, never the name.
    playRecording(a.key);
  };
  const nextMystery = () => {
    const pool = SINGERS.filter(a => a.key !== mystery?.key);
    const next = pool[Math.floor(Math.random() * pool.length)]!;
    setMystery(next); setFound(false); setMisses(0);
    playMystery(next);
  };

  const tap = (a: Animal) => {
    if (mode === 'free' || !mystery) {
      pulse(a.key, 'sing');
      playRecording(a.key);
      return;
    }
    if (found) return;
    if (soundKey(a.says!) === soundKey(mystery.says!)) {
      playSound('yay');
      pulse(a.key, 'right');
      setFound(true); setScore(s => s + 1); setBurst(b => b + 1);
    } else {
      playSound('oops');
      pulse(a.key, 'wrong');
      setMisses(m => m + 1);
    }
  };

  return (
    <View style={{ gap: spacing(1.5) }}>
      <View style={styles.modes} accessibilityRole="tablist">
        {([['free', '🎵 Tap and listen'], ['guess', '❓ Guess who']] as const).map(([key, label]) => (
          <Pressable key={key} onPress={() => { setMode(key); setMystery(null); setFound(false); }} accessibilityRole="tab" accessibilityState={{ selected: mode === key }}
            style={[styles.modeTab, mode === key && styles.modeTabOn]}>
            <Text style={[styles.modeText, mode === key && styles.modeTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'guess' ? (
        <View style={styles.guessCard}>
          <Burst id={burst} />
          {!mystery ? (
            <>
              <Text style={styles.guessTitle}>Listen to a mystery sound, then find the animal!</Text>
              <Pressable onPress={nextMystery} accessibilityRole="button" style={({ pressed }) => [styles.bigButton, pressed && styles.cellPressed]}>
                <Text style={styles.bigButtonText}>🔊 Play a mystery sound</Text>
              </Pressable>
            </>
          ) : found ? (
            <>
              <Text style={styles.guessEmoji}>{mystery.emoji}</Text>
              <Text style={styles.guessTitle}>Yes! The {mystery.name} says “{mystery.says}”!</Text>
              <Pressable onPress={nextMystery} accessibilityRole="button" style={({ pressed }) => [styles.bigButton, pressed && styles.cellPressed]}>
                <Text style={styles.bigButtonText}>🔊 Next mystery sound</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.guessEmoji}>❓</Text>
              <Text style={styles.guessTitle}>{misses === 0 ? 'Who makes this sound? Tap the animal!' : misses === 1 ? 'Not that one. Listen again!' : `Hint: it says “${mystery.says}”`}</Text>
              <Pressable onPress={() => playMystery(mystery)} accessibilityRole="button" style={({ pressed }) => [styles.bigButton, styles.bigButtonSoft, pressed && styles.cellPressed]}>
                <Text style={[styles.bigButtonText, styles.bigButtonSoftText]}>🔊 Hear it again</Text>
              </Pressable>
            </>
          )}
          {score > 0 ? <Text style={styles.score} accessibilityLabel={`${score} found`}>{'⭐'.repeat(Math.min(score, 10))}{score > 10 ? ` ${score}` : ''}</Text> : null}
        </View>
      ) : (
        <Text style={styles.freeHint}>Tap any animal to hear a real recording! 👂</Text>
      )}

      {grouped.map(g => (
        <View key={g.title}>
          <Text style={styles.groupTitle}>{g.title}</Text>
          <View style={styles.grid}>
            {g.animals.map(a => <Cell key={a.key} animal={a} pulse={pulses[a.key] ?? null} onPress={() => tap(a)} width={cellWidth} />)}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: 'row', backgroundColor: '#F1EBE2', borderRadius: 999, padding: 4, alignSelf: 'center' },
  modeTab: { paddingHorizontal: spacing(2), paddingVertical: spacing(1), borderRadius: 999, minHeight: 44, justifyContent: 'center' },
  modeTabOn: { backgroundColor: '#FFFFFF', shadowColor: '#4A3728', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  modeText: { fontSize: 16, fontWeight: '800', color: colors.inkSoft },
  modeTextOn: { color: '#4E3590' },
  freeHint: { fontSize: 17, fontWeight: '800', color: '#5E5249', textAlign: 'center' },

  guessCard: { alignItems: 'center', gap: spacing(1.25), backgroundColor: '#FFF4D6', borderRadius: 24, borderWidth: 2, borderColor: '#F4C966', padding: spacing(2), overflow: 'visible' },
  guessEmoji: { fontSize: 60 },
  guessTitle: { fontSize: 19, lineHeight: 26, fontWeight: '900', color: '#5A3B08', textAlign: 'center' },
  bigButton: { backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(3), minHeight: 56, justifyContent: 'center' },
  bigButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  bigButtonSoft: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F4C966' },
  bigButtonSoftText: { color: '#7A4E08' },
  score: { fontSize: 22, letterSpacing: 2 },
  burst: { position: 'absolute', top: '40%', left: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  burstBit: { position: 'absolute', fontSize: 28 },

  groupTitle: { fontSize: 18, fontWeight: '900', color: '#3F3126', marginBottom: spacing(0.5), marginTop: spacing(0.5) },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(0.5) },
  cell: { alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#EADFD0', paddingVertical: spacing(1.25), minHeight: 100 },
  cellRight: { borderColor: '#3F9A6E', backgroundColor: '#E3F2EA' },
  cellPressed: { transform: [{ scale: 0.94 }] },
  cellEmoji: { fontSize: 44 },
  cellLabel: { fontSize: 13, fontWeight: '800', color: '#5E5249', marginTop: 4, paddingHorizontal: 4 },
  bubble: { position: 'absolute', top: -4, left: 0, right: 0, alignItems: 'center', zIndex: 3 },
  bubbleText: { backgroundColor: '#4E3590', color: '#FFFFFF', fontSize: 14, fontWeight: '900', paddingHorizontal: spacing(1.25), paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
});
