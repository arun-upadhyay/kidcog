import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Owl from '../components/Owl';
import { colors, spacing, column, GUTTER } from '../theme';

const ADVENTURES = [
  {
    icon: '🧩',
    title: 'Thinking quests',
    description: 'Spot patterns, predict what happens next, and solve playful puzzles.',
    tint: '#EEE8FF',
    border: '#8A6BC9',
  },
  {
    icon: '📚',
    title: 'Story sparks',
    description: 'Listen, imagine, and share big ideas through tiny stories.',
    tint: '#FFF0D7',
    border: '#E7A934',
  },
  {
    icon: '🎤',
    title: 'Word adventures',
    description: 'Talk about pictures, feelings, funny words, and creative answers.',
    tint: '#E4F3EC',
    border: '#4A9E75',
  },
  {
    icon: '🎮',
    title: 'Play Zone',
    description: 'Guide a snake, pop bubbles, trace shapes, and explore mazes.',
    tint: '#E4F1FC',
    border: '#5B9FD1',
  },
] as const;

function AdventureCard({ item, index, wide, reduceMotion, onChoose }: {
  item: typeof ADVENTURES[number];
  index: number;
  wide: boolean;
  reduceMotion: boolean;
  onChoose: (title: string) => void;
}) {
  const entrance = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const bounce = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduceMotion) { entrance.setValue(1); return; }
    Animated.timing(entrance, {
      toValue: 1,
      duration: 460,
      delay: 180 + index * 110,
      easing: Easing.out(Easing.back(1.15)),
      useNativeDriver: true,
    }).start();
  }, [entrance, index, reduceMotion]);

  const press = () => {
    if (reduceMotion) { onChoose(item.title); return; }
    Animated.sequence([
      Animated.timing(bounce, { toValue: 0.96, duration: 70, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 1, duration: 90, useNativeDriver: true }),
    ]).start(() => onChoose(item.title));
  };

  return (
    <Animated.View style={[
      styles.cardWrap,
      wide ? styles.cardWide : styles.cardPhone,
      {
        opacity: entrance,
        transform: [
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: bounce },
        ],
      },
    ]}>
      <Pressable
        onPress={press}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.description} Parent sign-in required to start.`}
        style={({ pressed }) => [styles.card, { backgroundColor: item.tint, borderColor: item.border }, pressed && styles.pressed]}
      >
        <View style={[styles.iconBubble, { borderColor: item.border }]}><Text style={styles.cardIcon}>{item.icon}</Text></View>
        <View style={styles.cardCopy}>
          <Text style={[styles.cardTitle, { color: item.border }]}>{item.title}</Text>
          <Text style={styles.cardBody}>{item.description}</Text>
          <Text style={[styles.explore, { color: item.border }]}>Tap to explore  →</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function WelcomeScreen({ onChoose, onParentSignIn }: {
  onChoose: (title: string) => void;
  onParentSignIn: () => void;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 680;
  const [reduceMotion, setReduceMotion] = useState(false);
  const float = useRef(new Animated.Value(0)).current;
  const sparkle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) { float.setValue(0); sparkle.setValue(0); return; }
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const twinkle = Animated.loop(Animated.sequence([
      Animated.timing(sparkle, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(sparkle, { toValue: 0.25, duration: 800, useNativeDriver: true }),
    ]));
    floating.start(); twinkle.start();
    return () => { floating.stop(); twinkle.stop(); };
  }, [float, reduceMotion, sparkle]);

  const floatStyle = useMemo(() => ({
    transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }],
  }), [float]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.topNav}>
            <View style={styles.topBrand}>
              <Owl size={42} />
              <View>
                <Text style={styles.topBrandName}>KidCog</Text>
                <Text style={styles.topBrandTagline}>Play, discover, and grow</Text>
              </View>
            </View>
            <Pressable
              onPress={onParentSignIn}
              accessibilityRole="button"
              accessibilityLabel="Parent sign in"
              style={({ pressed }) => [styles.topSignIn, pressed && styles.pressed]}
            >
              <Text style={styles.topSignInText}>{wide ? 'Parent sign in' : 'Sign in'}</Text>
            </Pressable>
          </View>
          <View style={styles.hero}>
            <Animated.Text style={[styles.sparkle, styles.sparkleLeft, { opacity: sparkle }]}>✨</Animated.Text>
            <Animated.Text style={[styles.sparkle, styles.sparkleRight, floatStyle]}>⭐</Animated.Text>
            <Animated.View style={floatStyle}><Owl size={wide ? 104 : 88} /></Animated.View>
            <View style={styles.brandPill}><Text style={styles.brandPillText}>KIDCOG ADVENTURES</Text></View>
            <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>Ready for a little adventure?</Text>
            <Text style={styles.subtitle}>Play, discover, and grow with short activities made for curious minds.</Text>
            <View style={styles.promiseRow}>
              <View style={styles.promise}><Text>⏱️</Text><Text style={styles.promiseText}>A few minutes</Text></View>
              <View style={styles.promise}><Text>🌈</Text><Text style={styles.promiseText}>No wrong ideas</Text></View>
              <View style={styles.promise}><Text>🛡️</Text><Text style={styles.promiseText}>Grown-up guided</Text></View>
            </View>
          </View>

          <View style={styles.sectionHeading}>
            <Text style={styles.eyebrow}>CHOOSE YOUR PATH</Text>
            <Text accessibilityRole="header" style={styles.heading}>What sounds fun today?</Text>
          </View>
          <View style={styles.grid}>
            {ADVENTURES.map((item, index) => (
              <AdventureCard key={item.title} item={item} index={index} wide={wide} reduceMotion={reduceMotion} onChoose={onChoose} />
            ))}
          </View>

          <View style={styles.grownUpCard}>
            <View style={styles.lockBubble}><Text style={styles.lock}>🔐</Text></View>
            <View style={styles.grownUpCopy}>
              <Text style={styles.grownUpTitle}>Grown-up checkpoint</Text>
              <Text style={styles.grownUpBody}>Choose any adventure first. A parent or guardian signs in before play begins.</Text>
            </View>
            <Pressable onPress={onParentSignIn} accessibilityRole="button" style={({ pressed }) => [styles.parentButton, pressed && styles.pressed]}>
              <Text style={styles.parentButtonText}>Parent sign in</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingVertical: spacing(3) },
  container: { paddingHorizontal: GUTTER, paddingBottom: spacing(4), ...column },
  topNav: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), marginBottom: spacing(2), paddingBottom: spacing(1.5), borderBottomWidth: 1, borderBottomColor: colors.line },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), flexShrink: 1 },
  topBrandName: { color: colors.primary, fontSize: 20, lineHeight: 23, fontWeight: '900' },
  topBrandTagline: { color: colors.inkSoft, fontSize: 11, lineHeight: 14, fontWeight: '700' },
  topSignIn: { minHeight: 44, justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(2) },
  topSignInText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  hero: { alignItems: 'center', paddingTop: spacing(1), paddingBottom: spacing(3), position: 'relative' },
  sparkle: { position: 'absolute', fontSize: 30 },
  sparkleLeft: { left: '12%', top: spacing(5) },
  sparkleRight: { right: '12%', top: spacing(2) },
  brandPill: { backgroundColor: '#EEE8FF', borderRadius: 999, paddingHorizontal: spacing(2), paddingVertical: 7, marginTop: spacing(1) },
  brandPillText: { color: '#60439B', fontSize: 12, fontWeight: '900', letterSpacing: 1.4 },
  title: { color: colors.ink, textAlign: 'center', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: spacing(1.5) },
  titleWide: { fontSize: 42, lineHeight: 48 },
  subtitle: { color: colors.inkSoft, textAlign: 'center', fontSize: 17, lineHeight: 25, maxWidth: 570, marginTop: spacing(1) },
  promiseRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(1), marginTop: spacing(2) },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing(1.5), paddingVertical: 8 },
  promiseText: { color: colors.inkSoft, fontSize: 12, fontWeight: '800' },
  sectionHeading: { marginBottom: spacing(2) },
  eyebrow: { color: colors.primary, fontSize: 12, letterSpacing: 1.5, fontWeight: '900' },
  heading: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '900', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing(1.5) },
  cardWrap: { marginBottom: spacing(0.5) },
  cardWide: { width: '48.8%' },
  cardPhone: { width: '100%' },
  card: { minHeight: 170, borderWidth: 2, borderRadius: 24, padding: spacing(2), flexDirection: 'row', gap: spacing(1.5) },
  pressed: { opacity: 0.82 },
  iconBubble: { width: 62, height: 62, borderRadius: 31, borderWidth: 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  cardIcon: { fontSize: 31 },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  cardBody: { color: colors.ink, fontSize: 14, lineHeight: 20, marginTop: 5 },
  explore: { fontSize: 13, fontWeight: '900', marginTop: 'auto', paddingTop: spacing(1) },
  grownUpCard: { marginTop: spacing(2), backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1.5, borderRadius: 22, padding: spacing(2), flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), flexWrap: 'wrap' },
  lockBubble: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  lock: { fontSize: 23 },
  grownUpCopy: { flex: 1, minWidth: 190 },
  grownUpTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  grownUpBody: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 3 },
  parentButton: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing(2) },
  parentButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
