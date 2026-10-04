import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import type { GameSpec, PublicQuestion } from '../types';
import { colors, scaled, spacing } from '../theme';
import Owl, { type OwlMood } from '../components/Owl';
import { playSound } from './sounds';
import { SpeakerIcon } from '../components/Icons';
import { speak, stopSpeaking } from '../speech';
import { AddGame, CompareGame, CountGame, NumberLineGame, SubtractGame, TenFrameGame, TrueFalseGame } from './MathGames';
import { MatchGame, OddOneOutGame, OrderGame, PatternGame, ShapesGame, SortGame } from './ThinkingGames';

export type Status = 'playing' | 'tryagain' | 'right' | 'failed';

/** What each game component gets. */
export interface GameProps<K extends GameSpec['kind']> {
  spec: Extract<GameSpec, { kind: K }>;
  s: number;
  status: Status;
  /** Single-answer games: the child's pick. */
  pick: (value: unknown) => void;
  /** Values already tried and wrong (to mark them). */
  tried: unknown[];
  /** Step-by-step games: one wrong move. */
  slip: () => void;
  /** Step-by-step games: all done, with the final arrangement. */
  finish: (value: unknown) => void;
}

const PRAISE = ['Great job!', 'You got it!', 'Brilliant!', 'Super star!', 'Well done!', 'Amazing!', 'Yes! That’s it!'];
const HINTS: Partial<Record<GameSpec['kind'], string>> = {
  count: 'Tap each one and count out loud.',
  add: 'Count all of them together.',
  subtract: 'Count the ones that are still here.',
  compare: 'Look at both sides again.',
  numberline: 'Count the hops one at a time.',
  tenframe: 'Count the empty boxes.',
  pattern: 'Say the pattern out loud.',
  oddoneout: 'Which one is different from the rest?',
  truefalse: 'Think about it once more.',
};
const MULTI_STEP = new Set(['shapes', 'sort', 'order', 'match']);

function same(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** What the right answer looks like, when a child runs out of tries. */
function answerWords(spec: GameSpec): string {
  switch (spec.kind) {
    case 'compare': return spec.answer === 0 ? 'this side' : 'that side';
    case 'pattern': return spec.choices[spec.answer]?.emoji ?? '';
    case 'oddoneout': return spec.items[spec.answer]?.emoji ?? '';
    case 'truefalse': return spec.answer ? 'true 👍' : 'false 👎';
    case 'count': case 'add': case 'subtract': case 'tenframe': case 'numberline': return String(spec.answer);
    default: return '';
  }
}

/**
 * A play-and-learn game with instant, gentle feedback.
 *
 * Single-answer games get two tries: a wrong first pick gets "Almost!" and a
 * hint, never "wrong"; after the second the answer is shown kindly and the
 * child moves on. Step-by-step games (sorting, ordering, shapes, memory) just
 * count slips. Either way the result goes back as JSON for the server to
 * re-check and score.
 */
export default function GameView({ question, uiScale: s, value, onDone }: {
  question: PublicQuestion;
  uiScale: number;
  /** An answer already given (when coming back to this question). */
  value: string;
  onDone: (answer: string, solved: boolean) => void;
}) {
  const spec = question.game!;
  // Read once, when the game opens: an answer given just now must not swap
  // the game for the summary card mid-celebration.
  const [previous] = useState(() => { try { return value ? JSON.parse(value) as { solved?: boolean } : null; } catch { return null; } });
  const [status, setStatus] = useState<Status>(previous ? (previous.solved ? 'right' : 'failed') : 'playing');
  const [tried, setTried] = useState<unknown[]>([]);
  const [mood, setMood] = useState<OwlMood>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const mistakes = useRef(0);
  const done = status === 'right' || status === 'failed';

  const cheer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (status !== 'right') return;
    cheer.setValue(0);
    Animated.spring(cheer, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
  }, [status, cheer]);

  function complete(v: unknown, solved: boolean) {
    onDone(JSON.stringify({ v, mistakes: mistakes.current, solved }), solved);
  }
  function celebrate() {
    setStatus('right');
    setMood('happy');
    setMessage(PRAISE[Math.floor(Math.random() * PRAISE.length)]!);
    playSound('yay');
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
  function oops(text: string) {
    setMood('oops');
    setMessage(text);
    playSound('oops');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => setMood('idle'), 900);
  }

  const pick = (v: unknown) => {
    if (done) return;
    if (same(v, spec.answer)) {
      celebrate();
      complete(v, true);
      return;
    }
    setTried(list => [...list, v]);
    if (mistakes.current === 0) {
      mistakes.current = 1;
      setStatus('tryagain');
      oops(`Almost! Have another go. ${HINTS[spec.kind] ?? ''}`);
    } else {
      mistakes.current = 2;
      setStatus('failed');
      setMood('thinking');
      setMessage(`Good try! The answer is ${answerWords(spec)}.`);
      playSound('pop');
      complete(v, false);
    }
  };
  const slip = () => {
    if (done) return;
    mistakes.current += 1;
    if (spec.kind !== 'match') oops('Oops, not that one. Try another!');
  };
  const finish = (v: unknown) => {
    if (done) return;
    celebrate();
    if (spec.kind === 'match') playSound('tada');
    complete(v, true);
  };

  const props = { s, status, pick, tried, slip, finish };
  let body: React.ReactNode;
  switch (spec.kind) {
    case 'count': body = <CountGame {...props} spec={spec} />; break;
    case 'add': body = <AddGame {...props} spec={spec} />; break;
    case 'subtract': body = <SubtractGame {...props} spec={spec} />; break;
    case 'compare': body = <CompareGame {...props} spec={spec} />; break;
    case 'numberline': body = <NumberLineGame {...props} spec={spec} />; break;
    case 'tenframe': body = <TenFrameGame {...props} spec={spec} />; break;
    case 'truefalse': body = <TrueFalseGame {...props} spec={spec} />; break;
    case 'shapes': body = <ShapesGame {...props} spec={spec} />; break;
    case 'pattern': body = <PatternGame {...props} spec={spec} />; break;
    case 'sort': body = <SortGame {...props} spec={spec} />; break;
    case 'order': body = <OrderGame {...props} spec={spec} />; break;
    case 'match': body = <MatchGame {...props} spec={spec} />; break;
    case 'oddoneout': body = <OddOneOutGame {...props} spec={spec} />; break;
  }

  if (previous) {
    // Coming back to a finished game: show how it went rather than replaying it.
    return (
      <View style={[styles.doneCard, !previous.solved && styles.doneCardSoft]}>
        <Text style={{ fontSize: scaled(34, s) }}>{previous.solved ? '⭐' : '👍'}</Text>
        <Text style={styles.doneText}>{previous.solved ? 'You did this one!' : 'You had a go at this one.'}</Text>
      </View>
    );
  }

  const tone = status === 'right' ? styles.bannerRight : status === 'failed' ? styles.bannerSoft : styles.bannerTry;
  return (
    <View style={{ marginTop: spacing(2) }}>
      {body}
      <View style={styles.feedbackRow} accessibilityLiveRegion="polite">
        <Owl mood={mood} size={scaled(60, s)} />
        {message ? (
          <View style={[styles.banner, tone]}>
            {status === 'right' ? (
              <Animated.Text style={[styles.star, { transform: [{ scale: cheer.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: cheer.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) }] }]}>⭐</Animated.Text>
            ) : null}
            <Text style={[styles.bannerText, { fontSize: scaled(17, s) }]}>{message}</Text>
            {/* Pre-readers can hear the hint (only when they tap). */}
            <Pressable onPress={() => { stopSpeaking(); void speak(message); }} accessibilityRole="button" accessibilityLabel={`Hear: ${message}`} hitSlop={8}
              style={({ pressed }) => [styles.hear, { width: scaled(40, s), height: scaled(40, s), borderRadius: scaled(20, s) }, pressed && { transform: [{ scale: 0.9 }] }]}>
              <SpeakerIcon size={scaled(20, s)} color="#5D439B" />
            </Pressable>
          </View>
        ) : (
          <View style={[styles.banner, styles.bannerIdle]}>
            <Text style={[styles.bannerText, { fontSize: scaled(16, s), color: colors.inkSoft }]}>
              {MULTI_STEP.has(spec.kind) ? 'You can do it!' : 'Tap your answer!'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  feedbackRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), marginTop: spacing(2) },
  banner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing(1), borderRadius: 18, paddingVertical: spacing(1.25), paddingHorizontal: spacing(1.5), borderWidth: 2 },
  bannerIdle: { backgroundColor: colors.surface, borderColor: colors.line, borderStyle: 'dashed' },
  bannerRight: { backgroundColor: colors.goSoft, borderColor: '#8CCBA9' },
  bannerTry: { backgroundColor: colors.happySoft, borderColor: colors.happy },
  bannerSoft: { backgroundColor: colors.coolSoft, borderColor: '#A8CBE6' },
  bannerText: { flex: 1, fontWeight: '800', color: colors.ink, lineHeight: 24 },
  star: { fontSize: 30 },
  hear: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center' },
  doneCard: { marginTop: spacing(2), alignItems: 'center', gap: spacing(1), padding: spacing(3), borderRadius: 24, backgroundColor: colors.goSoft, borderWidth: 2, borderColor: '#8CCBA9' },
  doneCardSoft: { backgroundColor: colors.coolSoft, borderColor: '#A8CBE6' },
  doneText: { fontSize: 18, fontWeight: '900', color: colors.ink },
});
