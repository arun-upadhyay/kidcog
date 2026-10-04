import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Owl from './Owl';
import { playSound } from '../games/sounds';
import { colors, spacing } from '../theme';

const native = Platform.OS !== 'web';

/**
 * Shown the moment a child taps "I'm finished!", while the answers are being
 * checked: the owl cheers and the round's stars pop in one by one, so the
 * child celebrates straight away instead of watching a spinner. The results
 * screen replaces it as soon as it is ready.
 */
export default function RoundDoneOverlay({ childName, stars }: { childName?: string | undefined; stars: number }) {
  const shown = Math.min(stars, 10);
  const [count, setCount] = useState(0);
  const hop = useRef(new Animated.Value(0)).current;
  const pops = useRef(Array.from({ length: 10 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(hop, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: native }),
      Animated.delay(400),
    ]));
    loop.start();
    playSound('tada');
    const timers = Array.from({ length: shown }, (_, i) => setTimeout(() => {
      setCount(i + 1);
      playSound('pop');
      Animated.spring(pops[i]!, { toValue: 1, friction: 4, tension: 160, useNativeDriver: native }).start();
    }, 450 + i * 280));
    return () => { loop.stop(); timers.forEach(clearTimeout); };
  }, [hop, pops, shown]);

  return (
    <View style={styles.overlay} accessibilityViewIsModal accessibilityLiveRegion="polite">
      <Animated.View style={{ transform: [{ translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -22] }) }] }}>
        <Owl mood="happy" size={120} />
      </Animated.View>
      <Text style={styles.title}>{childName ? `Great job, ${childName}!` : 'Great job!'}</Text>
      <Text style={styles.sub}>You finished! 🎉</Text>
      <View style={styles.stars} accessibilityLabel={`${stars} stars`}>
        {pops.slice(0, shown).map((p, i) => (
          <Animated.Text key={i} style={[styles.star, { opacity: p, transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: p.interpolate({ inputRange: [0, 1], outputRange: ['-120deg', '0deg'] }) }] }]}>⭐</Animated.Text>
        ))}
      </View>
      {stars > 0 ? <Text style={styles.count}>+{count >= shown ? stars : count} {stars === 1 ? 'star' : 'stars'}</Text> : null}
      <View style={styles.waiting}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.waitingText}>Getting your surprise ready…</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFF8EF', alignItems: 'center', justifyContent: 'center', padding: spacing(3), gap: spacing(1), zIndex: 50 },
  title: { fontSize: 32, fontWeight: '900', color: colors.primary, textAlign: 'center', marginTop: spacing(1) },
  sub: { fontSize: 20, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  stars: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, maxWidth: 320, minHeight: 50, marginTop: spacing(1) },
  star: { fontSize: 40 },
  count: { fontSize: 22, fontWeight: '900', color: '#8A5A0A', backgroundColor: colors.happySoft, borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: 4, overflow: 'hidden' },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginTop: spacing(3) },
  waitingText: { fontSize: 15, fontWeight: '700', color: colors.inkSoft },
});
