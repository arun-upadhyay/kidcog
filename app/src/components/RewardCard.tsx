import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { avatarEmoji, avatarName } from '../avatars';
import type { RoundReward } from '../progress';
import { playSound } from '../games/sounds';
import { colors, spacing } from '../theme';

/** "You won 4 stars and a new sticker!", popping in with a fanfare. */
export default function RewardCard({ reward }: { reward: RoundReward }) {
  const pop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    playSound('tada');
    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }),
        Animated.timing(spin, { toValue: 1, duration: 700, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      ]),
    ]).start();
  }, [pop, spin]);
  if (reward.stars === 0 && !reward.sticker) return null;
  return (
    <Animated.View style={[styles.card, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }]} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <Text style={styles.bigStar}>⭐</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>+{reward.stars} {reward.stars === 1 ? 'star' : 'stars'}!</Text>
          <Text style={styles.sub}>{reward.totalStars} {reward.totalStars === 1 ? 'star' : 'stars'} altogether</Text>
        </View>
      </View>
      {reward.sticker ? (
        <View style={[styles.row, styles.stickerRow]}>
          <Animated.View style={[styles.sticker, { transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['-180deg', '-8deg'] }) }, { scale: spin }] }]}>
            <Text style={styles.stickerEmoji}>{avatarEmoji(reward.sticker)}</Text>
          </Animated.View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>New sticker: {avatarName(reward.sticker)}!</Text>
            <Text style={styles.sub}>It’s in your sticker book.</Text>
          </View>
        </View>
      ) : null}
      {reward.levelChange === 1 ? <Text style={styles.level}>🚀 You’re getting so good! Next time the games get a little trickier.</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', marginTop: spacing(2), backgroundColor: colors.happySoft, borderRadius: 24, borderWidth: 2, borderColor: colors.happy, padding: spacing(2), gap: spacing(1.5) },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  stickerRow: { borderTopWidth: 1.5, borderTopColor: '#F5D48A', paddingTop: spacing(1.5) },
  bigStar: { fontSize: 44 },
  title: { fontSize: 19, fontWeight: '900', color: '#6B4A08' },
  sub: { fontSize: 14, fontWeight: '600', color: '#8A6A2A', marginTop: 2 },
  sticker: { width: 58, height: 58, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  stickerEmoji: { fontSize: 38 },
  level: { fontSize: 14, fontWeight: '800', color: '#6B4A08' },
});
