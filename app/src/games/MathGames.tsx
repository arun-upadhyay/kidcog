import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, scaled, spacing } from '../theme';
import type { GameProps } from './GameView';
import { NumberChoices, ThingGroup, styles as parts, thingSize, useWiggle } from './parts';
import { playSound } from './sounds';

/** Tap each picture to count it (a number appears on it), then pick the number. */
export function CountGame({ spec, s, status, pick, tried }: GameProps<'count'>) {
  const [order, setOrder] = useState<number[]>([]);
  const size = thingSize(spec.count, s) * 1.15;
  const toggle = (i: number) => {
    setOrder(list => (list.includes(i) ? list.filter(x => x !== i) : [...list, i]));
    playSound('pop');
  };
  return (
    <View>
      <View style={[parts.card, styles.countCard]}>
        {Array.from({ length: spec.count }, (_, i) => {
          const at = order.indexOf(i);
          return (
            <Pressable key={i} onPress={() => toggle(i)} accessibilityRole="button" accessibilityLabel={at >= 0 ? `Counted ${at + 1}` : `${spec.thing.name}, not counted yet`}
              style={({ pressed }) => [styles.countItem, at >= 0 && styles.countItemOn, pressed && { transform: [{ scale: 0.92 }] }]}>
              <Text style={{ fontSize: size }}>{spec.thing.emoji}</Text>
              {at >= 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{at + 1}</Text></View> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.counter}>{order.length > 0 ? `You counted ${order.length}` : 'Tap each one to count'}</Text>
      <NumberChoices choices={spec.choices} answer={spec.answer} status={status} tried={tried} onPick={pick} s={s} />
    </View>
  );
}

/** Two groups; the second slides in to join the first. */
export function AddGame({ spec, s, status, pick, tried }: GameProps<'add'>) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const timer = setTimeout(() => {
      playSound('whoosh');
      Animated.timing(slide, { toValue: 1, duration: 650, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
    }, 400);
    return () => clearTimeout(timer);
  }, [slide]);
  return (
    <View>
      <View style={styles.addRow}>
        <View style={[parts.card, styles.addPanel]}><ThingGroup emoji={spec.thing.emoji} count={spec.a} s={s} /><Text style={styles.groupNum}>{spec.a}</Text></View>
        <Text style={[styles.plus, { fontSize: scaled(34, s) }]}>+</Text>
        <Animated.View style={[styles.addPanelWrap, { opacity: slide, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
          <View style={[parts.card, styles.addPanel, { backgroundColor: colors.coolSoft, borderColor: '#A8CBE6' }]}><ThingGroup emoji={spec.thing.emoji} count={spec.b} s={s} /><Text style={styles.groupNum}>{spec.b}</Text></View>
        </Animated.View>
      </View>
      <NumberChoices choices={spec.choices} answer={spec.answer} status={status} tried={tried} onPick={pick} s={s} />
    </View>
  );
}

/** Some fly away (up and fading); how many are left? "Watch again" replays it. */
export function SubtractGame({ spec, s, status, pick, tried }: GameProps<'subtract'>) {
  const fly = useRef(new Animated.Value(0)).current;
  const size = thingSize(spec.start, s) * 1.1;
  const play = (delay: number) => {
    fly.setValue(0);
    setTimeout(() => {
      playSound('whoosh');
      Animated.timing(fly, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }, delay);
  };
  useEffect(() => { play(700); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const staying = spec.start - spec.away;
  return (
    <View>
      <View style={[parts.card, styles.countCard, { paddingTop: spacing(4) }]}>
        {Array.from({ length: spec.start }, (_, i) => {
          const leaves = i >= staying;
          const style = leaves
            ? { opacity: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] }), transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, -34 - (i % 3) * 8] }) }, { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['0deg', i % 2 ? '14deg' : '-14deg'] }) }] }
            : null;
          return <Animated.Text key={i} style={[{ fontSize: size, margin: 2 }, style]}>{spec.thing.emoji}</Animated.Text>;
        })}
      </View>
      <Pressable onPress={() => play(0)} accessibilityRole="button" style={styles.again}>
        <Text style={styles.againText}>🔁 Watch again</Text>
      </Pressable>
      <NumberChoices choices={spec.choices} answer={spec.answer} status={status} tried={tried} onPick={pick} s={s} />
    </View>
  );
}

/** Two groups side by side; tap the one with more (or fewer). */
export function CompareGame({ spec, s, status, pick, tried }: GameProps<'compare'>) {
  return (
    <View style={styles.compareRow}>
      {spec.groups.map((group, i) => (
        <ComparePanel key={i} index={i} s={s} emoji={group.thing.emoji} count={group.count}
          state={(status === 'right' || status === 'failed') && i === spec.answer ? 'right' : tried.includes(i) ? 'tried' : 'idle'}
          disabled={status === 'right' || status === 'failed' || tried.includes(i)} onPress={() => pick(i)} />
      ))}
    </View>
  );
}
function ComparePanel({ index, s, emoji, count, state, disabled, onPress }: { index: number; s: number; emoji: string; count: number; state: 'idle' | 'tried' | 'right'; disabled: boolean; onPress: () => void }) {
  const [shake, run] = useWiggle();
  useEffect(() => { if (state === 'tried') run(); }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }] }}>
      <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: state === 'right' }} accessibilityLabel={index === 0 ? 'Left side' : 'Right side'}
        style={({ pressed }) => [parts.card, styles.comparePanel, state === 'right' && styles.panelRight, state === 'tried' && { opacity: 0.5 }, pressed && { transform: [{ scale: 0.97 }] }]}>
        <ThingGroup emoji={emoji} count={count} s={s} />
      </Pressable>
    </Animated.View>
  );
}

/** A number line; the animal hops to the answer when the child gets it. */
export function NumberLineGame({ spec, s, status, pick, tried }: GameProps<'numberline'>) {
  const step = scaled(42, s);
  const pad = step * 0.6;
  const x = useRef(new Animated.Value(pad + spec.start * step)).current;
  const y = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollView>(null);
  useEffect(() => {
    if (status !== 'right') return;
    const dir = Math.sign(spec.hop);
    const hops = Array.from({ length: Math.abs(spec.hop) }, (_, i) => Animated.parallel([
      Animated.timing(x, { toValue: pad + (spec.start + dir * (i + 1)) * step, duration: 320, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(y, { toValue: -22, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]));
    Animated.sequence(hops).start();
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps
  const width = pad * 2 + spec.max * step;
  const animal = scaled(30, s);
  return (
    <View style={[parts.card, { paddingHorizontal: 0 }]}>
      <ScrollView horizontal ref={scroller} showsHorizontalScrollIndicator
        onLayout={() => scroller.current?.scrollTo({ x: Math.max(0, pad + Math.min(spec.start, spec.start + spec.hop) * step - step * 2), animated: false })}>
        <View style={{ width, height: scaled(120, s) }}>
          <Animated.Text style={[styles.hopper, { fontSize: animal, left: -animal / 2, transform: [{ translateX: x }, { translateY: y }] }]}>{spec.animal.emoji}</Animated.Text>
          <View style={[styles.line, { left: pad, width: spec.max * step, top: scaled(66, s) }]} />
          {Array.from({ length: spec.max + 1 }, (_, n) => {
            const isTried = tried.includes(n);
            const isAnswer = (status === 'right' || status === 'failed') && n === spec.answer;
            const tick = scaled(34, s);
            return (
              <Pressable key={n} onPress={() => pick(n)} disabled={status === 'right' || status === 'failed' || isTried}
                accessibilityRole="button" accessibilityLabel={String(n)}
                style={({ pressed }) => [styles.tick, { width: tick, height: tick, borderRadius: tick / 2, left: pad + n * step - tick / 2, top: scaled(66, s) - tick / 2 },
                  n === spec.start && styles.tickStart, isAnswer && styles.tickRight, isTried && { opacity: 0.35 }, pressed && { transform: [{ scale: 0.9 }] }]}>
                <Text style={[styles.tickText, isAnswer && { color: '#FFFFFF' }]}>{n}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** A ten-frame: how many more to make 10? The empty boxes fill in green when solved. */
export function TenFrameGame({ spec, s, status, pick, tried }: GameProps<'tenframe'>) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (status === 'right' || status === 'failed') Animated.timing(fill, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, [status, fill]);
  const cell = scaled(50, s);
  return (
    <View>
      <View style={[parts.card, { alignSelf: 'center' }]}>
        <View style={[styles.frame, { width: cell * 5 + 12 }]}>
          {Array.from({ length: 10 }, (_, i) => (
            <View key={i} style={[styles.cell, { width: cell, height: cell }]}>
              {i < spec.filled ? <View style={[styles.dot, { width: cell * 0.62, height: cell * 0.62, borderRadius: cell }]} />
                : <Animated.View style={[styles.dot, styles.dotNew, { width: cell * 0.62, height: cell * 0.62, borderRadius: cell, opacity: fill, transform: [{ scale: fill }] }]} />}
            </View>
          ))}
        </View>
      </View>
      <NumberChoices choices={spec.choices} answer={spec.answer} status={status} tried={tried} onPick={pick} s={s} />
    </View>
  );
}

/** A picture (or a sum) and two big thumbs. */
export function TrueFalseGame({ spec, s, status, pick, tried }: GameProps<'truefalse'>) {
  const isSum = /[0-9]/.test(spec.picture);
  return (
    <View>
      <View style={[parts.card, { paddingVertical: spacing(3) }]}>
        <Text style={isSum ? [styles.sum, { fontSize: scaled(40, s) }] : { fontSize: scaled(72, s) }}>{spec.picture}</Text>
      </View>
      <View style={styles.thumbRow}>
        {([true, false] as const).map(v => {
          const isTried = tried.includes(v);
          const isAnswer = (status === 'right' || status === 'failed') && v === spec.answer;
          return (
            <Pressable key={String(v)} onPress={() => pick(v)} disabled={status === 'right' || status === 'failed' || isTried}
              accessibilityRole="button" accessibilityLabel={v ? 'True' : 'False'}
              style={({ pressed }) => [styles.thumb, v ? styles.thumbYes : styles.thumbNo, isAnswer && styles.panelRight, isTried && { opacity: 0.4 }, pressed && { transform: [{ scale: 0.95 }] }]}>
              <Text style={{ fontSize: scaled(40, s) }}>{v ? '👍' : '👎'}</Text>
              <Text style={styles.thumbText}>{v ? 'True' : 'False'}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  countCard: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(0.5) },
  countItem: { padding: 4, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  countItemOn: { backgroundColor: colors.happySoft, borderColor: colors.happy },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#FFFFFF', fontWeight: '900', fontSize: 13 },
  counter: { textAlign: 'center', marginTop: spacing(1.25), fontSize: 16, fontWeight: '800', color: colors.inkSoft },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  addPanelWrap: { flex: 1 },
  addPanel: { flex: 1, minHeight: 110, justifyContent: 'center', gap: spacing(1) },
  groupNum: { fontSize: 18, fontWeight: '900', color: colors.inkSoft },
  plus: { fontWeight: '900', color: colors.primary },
  again: { alignSelf: 'center', marginTop: spacing(1), paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.coolSoft },
  againText: { fontWeight: '800', color: '#2F6F9D', fontSize: 14 },
  compareRow: { flexDirection: 'row', gap: spacing(1.5) },
  comparePanel: { minHeight: 140, justifyContent: 'center' },
  panelRight: { borderColor: colors.go, borderWidth: 4, backgroundColor: colors.goSoft },
  hopper: { position: 'absolute', top: 4 },
  line: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: '#D9C8B0' },
  tick: { position: 'absolute', backgroundColor: colors.surface, borderWidth: 2.5, borderColor: '#CDB89C', alignItems: 'center', justifyContent: 'center' },
  tickStart: { borderColor: colors.primary, borderWidth: 3 },
  tickRight: { backgroundColor: colors.go, borderColor: colors.go },
  tickText: { fontWeight: '900', fontSize: 14, color: colors.ink },
  frame: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, backgroundColor: '#CDB89C', padding: 2, borderRadius: 8 },
  cell: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dot: { backgroundColor: colors.primary },
  dotNew: { backgroundColor: colors.go },
  sum: { fontWeight: '900', color: colors.ink, letterSpacing: 2 },
  thumbRow: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(2) },
  thumb: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing(2), borderRadius: 24, borderWidth: 3 },
  thumbYes: { backgroundColor: colors.goSoft, borderColor: '#8CCBA9' },
  thumbNo: { backgroundColor: colors.primarySoft, borderColor: '#F2A28E' },
  thumbText: { fontSize: 18, fontWeight: '900', color: colors.ink },
});
