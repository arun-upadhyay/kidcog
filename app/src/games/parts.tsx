import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, scaled, spacing } from '../theme';
import type { Status } from './GameView';

/** A quick side-to-side shake, for "not that one". */
export function useWiggle(): [Animated.Value, () => void] {
  const x = useRef(new Animated.Value(0)).current;
  const run = () => {
    x.setValue(0);
    Animated.sequence([
      Animated.timing(x, { toValue: 1, duration: 60, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(x, { toValue: -1, duration: 90, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0.6, duration: 80, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 70, easing: Easing.linear, useNativeDriver: true }),
    ]).start();
  };
  return [x, run];
}

/** Emoji size that keeps a group readable however many there are. */
export function thingSize(count: number, s: number) {
  return scaled(count <= 5 ? 38 : count <= 8 ? 32 : 27, s);
}

/** Big number buttons. A wrong pick shakes and fades; the right one turns green. */
export function NumberChoices({ choices, answer, status, tried, onPick, s }: {
  choices: number[]; answer: number; status: Status; tried: unknown[]; onPick: (n: number) => void; s: number;
}) {
  return (
    <View style={styles.choiceRow} accessibilityRole="radiogroup">
      {choices.map(n => (
        <NumberTile key={n} n={n} s={s} onPress={() => onPick(n)}
          state={status === 'right' && n === answer ? 'right' : status === 'failed' && n === answer ? 'reveal' : tried.includes(n) ? 'tried' : 'idle'}
          disabled={status === 'right' || status === 'failed' || tried.includes(n)} />
      ))}
    </View>
  );
}

function NumberTile({ n, s, onPress, state, disabled }: { n: number; s: number; onPress: () => void; state: 'idle' | 'tried' | 'right' | 'reveal'; disabled: boolean }) {
  const [shake, run] = useWiggle();
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state === 'tried') run();
    if (state === 'right') {
      pop.setValue(0.8);
      Animated.spring(pop, { toValue: 1, friction: 3, tension: 160, useNativeDriver: true }).start();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps
  const size = scaled(68, s);
  return (
    <Animated.View style={{ transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }, { scale: pop }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="radio"
        accessibilityState={{ checked: state === 'right', disabled }}
        accessibilityLabel={String(n)}
        style={({ pressed }) => [
          styles.tile, { width: size, height: size, borderRadius: size * 0.3 },
          state === 'right' && styles.tileRight, state === 'reveal' && styles.tileReveal, state === 'tried' && styles.tileTried,
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        <Text style={[styles.tileText, { fontSize: scaled(30, s) }, state === 'right' && { color: '#FFFFFF' }, state === 'tried' && { color: colors.inkSoft }]}>{n}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** A group of the same picture, wrapped into neat rows. */
export function ThingGroup({ emoji, count, s, style, faded = 0 }: { emoji: string; count: number; s: number; style?: object; faded?: number }) {
  const size = thingSize(count, s);
  return (
    <View style={[styles.group, style]} accessibilityLabel={`${count}`}>
      {Array.from({ length: count }, (_, i) => (
        <Text key={i} style={{ fontSize: size, opacity: i >= count - faded ? 0.18 : 1 }}>{emoji}</Text>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  choiceRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing(1.5), marginTop: spacing(2.5) },
  tile: { backgroundColor: colors.surface, borderWidth: 3, borderColor: '#E3D4BF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tileRight: { backgroundColor: colors.go, borderColor: colors.go },
  tileReveal: { borderColor: colors.go, borderWidth: 4, backgroundColor: colors.goSoft },
  tileTried: { opacity: 0.45, borderStyle: 'dashed' },
  tileText: { fontWeight: '900', color: colors.ink },
  group: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4 },
  card: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 2, borderColor: colors.line, padding: spacing(2), alignItems: 'center' },
});
