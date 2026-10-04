import React, { useEffect, useRef, useState } from 'react';
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
import { CATEGORY_NAMES, CATEGORY_VISUALS } from '../categoryVisuals';
import type { TraitKey } from '../types';
import { colors, spacing } from '../theme';

/**
 * The front door for visitors who are not signed in: show what KidCog is in
 * pictures (floating animals and toys, every game and activity as a tile), and
 * send any tap on to the parent sign-up. Children cannot start anything here.
 *
 * Built from what works in apps for 4–7 year olds: pictures before words, big
 * tap targets, a friendly character, gentle motion, and a clear grown-up path.
 * Motion stops when the device asks for reduced motion.
 */

type Tile = { key: string; icon: string; name: string; background: string; border: string };

const FEATURED = [
  { key: 'animals', title: 'Animal Explorer', line: '79 animals, real sounds and fun facts', icons: ['🦁', '🐘', '🐧', '🦋'], background: '#FFF1C9', border: '#E7B23C', ink: '#7A4E08' },
  { key: 'playzone', title: 'Play Zone', line: 'Snake, bubbles, mazes and tracing', icons: ['🐍', '🫧', '🦉', '✏️'], background: '#EEE8FF', border: '#9B7EDE', ink: '#4E3590' },
] as const;

const GAMES: Tile[] = [
  { key: 'snake', icon: '🐍', name: 'Number Snake', background: '#E5F5EA', border: '#63AA7D' },
  { key: 'bubbles', icon: '🫧', name: 'Bubble Pop', background: '#E5F3FF', border: '#68A8D6' },
  { key: 'maze', icon: '🌀', name: 'Maze Runner', background: '#EEE9FF', border: '#A68AE2' },
  { key: 'trace', icon: '✏️', name: 'Trace & Draw', background: '#FFE9E3', border: '#E88970' },
  { key: 'animal-quiz', icon: '🦒', name: 'Animal quiz', background: '#FFF3CE', border: '#DDAE35' },
  { key: 'animal-sounds', icon: '🐮', name: 'Animal sounds', background: '#FDE6E8', border: '#D87882' },
];

const tiles = (keys: TraitKey[]): Tile[] => keys.map(key => ({ key, icon: CATEGORY_VISUALS[key].icon, name: CATEGORY_NAMES[key], background: CATEGORY_VISUALS[key].background, border: CATEGORY_VISUALS[key].border }));

const SECTIONS: { title: string; icon: string; tiles: Tile[] }[] = [
  { title: 'Games', icon: '🎮', tiles: GAMES },
  { title: 'Thinking', icon: '🧠', tiles: tiles(['abstract_concepts', 'beyond_experience', 'generalization', 'cause_effect', 'challenge_seeking', 'curiosity', 'original_methods', 'observant']) },
  { title: 'Feelings', icon: '💛', tiles: tiles(['perfectionism', 'strong_ideas', 'questions_authority', 'motivation_focus', 'humor', 'sensitivity_others']) },
  { title: 'Words', icon: '📚', tiles: tiles(['extensive_vocabulary', 'advanced_reading', 'self_motivated_writing', 'viewpoint_mood_intention', 'advanced_spelling']) },
  { title: 'Numbers', icon: '🔢', tiles: tiles(['mental_math', 'strategy_games', 'categories_hierarchies', 'intuitive_problem_solving', 'how_things_work']) },
];

/** Things drifting in the background: where they sit (% of the screen), size and pace. */
const FLOATERS = [
  { icon: '🦁', left: 4, top: 8, size: 44, ms: 5200 },
  { icon: '⭐', left: 88, top: 5, size: 30, ms: 3800 },
  { icon: '🎈', left: 78, top: 20, size: 42, ms: 6000 },
  { icon: '🦋', left: 14, top: 30, size: 34, ms: 4400 },
  { icon: '☁️', left: 60, top: 2, size: 52, ms: 7000 },
  { icon: '🐘', left: 90, top: 42, size: 44, ms: 5600 },
  { icon: '🧩', left: 2, top: 52, size: 34, ms: 4800 },
  { icon: '🚀', left: 82, top: 66, size: 36, ms: 5000 },
  { icon: '🐠', left: 8, top: 74, size: 34, ms: 4600 },
  { icon: '🌈', left: 46, top: 88, size: 40, ms: 6400 },
  { icon: '🐝', left: 30, top: 14, size: 26, ms: 3600 },
  { icon: '✨', left: 70, top: 34, size: 26, ms: 3000 },
  { icon: '🍎', left: 92, top: 86, size: 30, ms: 4200 },
  { icon: '🐧', left: 22, top: 92, size: 34, ms: 5400 },
  { icon: '🎨', left: 58, top: 56, size: 28, ms: 4900 },
  { icon: '🔢', left: 36, top: 62, size: 26, ms: 4100 },
];

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => sub?.remove();
  }, []);
  return reduce;
}

/** A looping 0 → 1 → 0 value, or a still 0 when motion is reduced. */
function useWave(ms: number, still: boolean, delay = 0) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (still) { value.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(value, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [value, ms, still, delay]);
  return value;
}

function Floater({ item, index, still }: { item: typeof FLOATERS[number]; index: number; still: boolean }) {
  const wave = useWave(item.ms, still, (index % 5) * 250);
  const dir = index % 2 === 0 ? 1 : -1;
  return (
    <Animated.Text
      style={[styles.floater, {
        left: `${item.left}%`, top: `${item.top}%`, fontSize: item.size,
        transform: [
          { translateY: wave.interpolate({ inputRange: [0, 1], outputRange: [0, -26] }) },
          { translateX: wave.interpolate({ inputRange: [0, 1], outputRange: [0, 14 * dir] }) },
          { rotate: wave.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${10 * dir}deg`] }) },
        ],
      }]}>
      {item.icon}
    </Animated.Text>
  );
}

function Background({ still }: { still: boolean }) {
  return (
    <View style={styles.background} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.blob, { backgroundColor: '#FFE3D6', width: 380, height: 380, top: -120, left: -140 }]} />
      <View style={[styles.blob, { backgroundColor: '#E8E0FF', width: 420, height: 420, top: '30%', right: -180 }]} />
      <View style={[styles.blob, { backgroundColor: '#DDF2E5', width: 360, height: 360, bottom: -140, left: '20%' }]} />
      {FLOATERS.map((item, i) => <Floater key={item.icon + i} item={item} index={i} still={still} />)}
    </View>
  );
}

/** Springs in once, and squishes when tapped. */
function Pop({ index, still, children, style }: { index: number; still: boolean; children: React.ReactNode; style?: object }) {
  const enter = useRef(new Animated.Value(still ? 1 : 0)).current;
  useEffect(() => {
    if (still) { enter.setValue(1); return; }
    Animated.timing(enter, { toValue: 1, duration: 420, delay: 80 + Math.min(index, 12) * 45, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }).start();
  }, [enter, index, still]);
  return (
    <Animated.View style={[style, { opacity: enter, transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

export default function WelcomeScreen({ onChoose, onParentSignIn }: {
  /** Any activity was tapped: go to the parent sign-up for it. */
  onChoose: (title: string) => void;
  onParentSignIn: () => void;
}) {
  const { width } = useWindowDimensions();
  const still = useReduceMotion();
  const wide = width >= 720;
  const columns = width < 360 ? 2 : width < 600 ? 3 : width < 860 ? 4 : 6;
  // Phone tiles are about 110px wide: smaller picture so two-line names fit.
  const compact = columns === 3;
  const owlBob = useWave(1700, still);

  return (
    <View style={styles.screen}>
      <Background still={still} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.topNav}>
            <View style={styles.topBrand}>
              <Owl size={40} />
              <Text style={styles.topBrandName}>KidCog</Text>
            </View>
            <Pressable onPress={onParentSignIn} accessibilityRole="button" accessibilityLabel="Parent sign in"
              style={({ pressed }) => [styles.topSignIn, pressed && styles.pressed]}>
              <Text style={styles.topSignInText}>{wide ? 'Parent sign in' : 'Sign in'}</Text>
            </Pressable>
          </View>

          {/* Hero */}
          <View style={[styles.hero, wide && styles.heroWide]}>
            <View style={styles.owlStage}>
              <View style={styles.bubble}><Text style={styles.bubbleText}>Hoo! Let's play! 🎉</Text></View>
              <Animated.View style={{ transform: [{ translateY: owlBob.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }] }}>
                <Owl size={wide ? 150 : 118} mood="happy" />
              </Animated.View>
            </View>
            <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
              <Text accessibilityRole="header" style={[styles.title, wide && styles.titleWide]}>Ready for a little adventure?</Text>
              <Text style={[styles.subtitle, wide && styles.leftText]}>Games, animals, stories and puzzles for curious 4 to 7 year olds.</Text>
              <View style={[styles.ctaRow, wide && styles.ctaRowWide]}>
                <Pressable onPress={() => onChoose('every adventure')} accessibilityRole="button" accessibilityLabel="Start playing, free"
                  style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
                  <Text style={styles.ctaText}>▶  Start playing, free</Text>
                </Pressable>
                <Pressable onPress={onParentSignIn} accessibilityRole="button" accessibilityLabel="I already have an account"
                  style={({ pressed }) => [styles.ctaSecondary, pressed && styles.pressed]}>
                  <Text style={styles.ctaSecondaryText}>I have an account</Text>
                </Pressable>
              </View>
              <View style={[styles.promiseRow, wide && styles.ctaRowWide]}>
                {[['⏱️', 'A few minutes'], ['🌈', 'No wrong ideas'], ['🚫', 'No ads'], ['🛡️', 'Grown-up guided']].map(([icon, text]) => (
                  <View key={text} style={styles.promise}><Text style={styles.promiseIcon}>{icon}</Text><Text style={styles.promiseText}>{text}</Text></View>
                ))}
              </View>
            </View>
          </View>

          {/* Big two */}
          <View style={[styles.featuredRow, wide && styles.featuredRowWide]}>
            {FEATURED.map((f, i) => (
              <Pop key={f.key} index={i} still={still} style={wide ? styles.featuredWide : styles.featuredPhone}>
                <Pressable onPress={() => onChoose(f.title)} accessibilityRole="button" accessibilityLabel={`${f.title}. ${f.line}`}
                  style={({ pressed }) => [styles.featured, { backgroundColor: f.background, borderColor: f.border }, pressed && styles.pressed]}>
                  <View style={styles.featuredIcons}>
                    {f.icons.map((icon, j) => <Text key={icon} style={[styles.featuredIcon, { transform: [{ rotate: `${(j - 1.5) * 8}deg` }] }]}>{icon}</Text>)}
                  </View>
                  <Text style={[styles.featuredTitle, { color: f.ink }]}>{f.title}</Text>
                  <Text style={[styles.featuredLine, { color: f.ink }]}>{f.line}</Text>
                  <View style={[styles.playPill, { backgroundColor: f.border }]}><Text style={styles.playPillText}>▶ Play</Text></View>
                </Pressable>
              </Pop>
            ))}
          </View>

          {/* Everything, in pictures */}
          <View style={styles.sectionHeading}>
            <Text style={styles.eyebrow}>30+ THINGS TO PLAY</Text>
            <Text accessibilityRole="header" style={styles.heading}>What sounds fun today?</Text>
          </View>
          {SECTIONS.map(section => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.icon}  {section.title}</Text>
              <View style={styles.grid}>
                {section.tiles.map((t, i) => (
                  <Pop key={t.key} index={i} still={still} style={{ width: `${100 / columns}%`, padding: spacing(0.75) }}>
                    <Pressable onPress={() => onChoose(t.name)} accessibilityRole="button" accessibilityLabel={`${t.name}. Parent sign-in required to start.`}
                      style={({ pressed }) => [styles.tile, { backgroundColor: t.background, borderColor: t.border }, pressed && styles.tilePressed]}>
                      <View style={[styles.tileBubble, compact && styles.tileBubbleCompact, { borderColor: t.border }]}><Text style={[styles.tileIcon, compact && styles.tileIconCompact]}>{t.icon}</Text></View>
                      <Text style={[styles.tileName, compact && styles.tileNameCompact]} numberOfLines={3}>{t.name}</Text>
                    </Pressable>
                  </Pop>
                ))}
              </View>
            </View>
          ))}

          {/* How it works, in three pictures */}
          <View style={styles.steps}>
            {[['👪', 'A grown-up signs up', 'Free, in a minute'], ['🧒', 'Add your child', 'Just a nickname and age'], ['⭐', 'Play and earn stars', 'Stickers, levels and an album']].map(([icon, title, line], i) => (
              <View key={title} style={[styles.step, wide && styles.stepWide]}>
                <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{i + 1}</Text></View>
                <Text style={styles.stepIcon}>{icon}</Text>
                <Text style={styles.stepTitle}>{title}</Text>
                <Text style={styles.stepLine}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grownUpCard}>
            <View style={styles.lockBubble}><Text style={styles.lock}>🔐</Text></View>
            <View style={styles.grownUpCopy}>
              <Text style={styles.grownUpTitle}>Grown-up checkpoint</Text>
              <Text style={styles.grownUpBody}>Pick anything above. A parent or guardian signs in before play begins.</Text>
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
  screen: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.55 },
  floater: { position: 'absolute', opacity: 0.38 },
  scroll: { flexGrow: 1, paddingVertical: spacing(2) },
  container: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: spacing(2), paddingBottom: spacing(5) },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },

  topNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), marginBottom: spacing(1) },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  topBrandName: { color: '#5D439B', fontSize: 24, fontWeight: '900' },
  topSignIn: { minHeight: 44, justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CABAF0', borderRadius: 999, paddingHorizontal: spacing(2) },
  topSignInText: { color: '#5D439B', fontSize: 15, fontWeight: '900' },

  hero: { alignItems: 'center', paddingVertical: spacing(2), gap: spacing(1) },
  heroWide: { flexDirection: 'row', justifyContent: 'center', gap: spacing(5), paddingVertical: spacing(4) },
  owlStage: { alignItems: 'center' },
  bubble: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: spacing(1.75), paddingVertical: spacing(1), borderWidth: 2, borderColor: '#F4C966', marginBottom: spacing(1) },
  bubbleText: { fontSize: 15, fontWeight: '900', color: '#7A4E08' },
  heroCopy: { alignItems: 'center', maxWidth: 560 },
  heroCopyWide: { alignItems: 'flex-start' },
  title: { color: colors.ink, textAlign: 'center', fontSize: 34, lineHeight: 40, fontWeight: '900' },
  titleWide: { fontSize: 48, lineHeight: 54, textAlign: 'left' },
  subtitle: { color: colors.inkSoft, textAlign: 'center', fontSize: 18, lineHeight: 26, marginTop: spacing(1) },
  leftText: { textAlign: 'left' },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(1.25), marginTop: spacing(2.5) },
  ctaRowWide: { justifyContent: 'flex-start' },
  cta: { minHeight: 58, justifyContent: 'center', backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing(3.5), shadowColor: '#E8724F', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  ctaText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  ctaSecondary: { minHeight: 58, justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: spacing(3), borderWidth: 2, borderColor: colors.line },
  ctaSecondaryText: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  promiseRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(0.75), marginTop: spacing(2) },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.9)', borderColor: colors.line, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing(1.5), paddingVertical: 7 },
  promiseIcon: { fontSize: 14 },
  promiseText: { color: colors.inkSoft, fontSize: 13, fontWeight: '800' },

  featuredRow: { gap: spacing(1.5), marginTop: spacing(2) },
  featuredRowWide: { flexDirection: 'row' },
  featuredPhone: { width: '100%' },
  featuredWide: { flex: 1 },
  featured: { borderRadius: 28, borderWidth: 3, padding: spacing(2.5), alignItems: 'center', gap: 6, shadowColor: '#4A3728', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  featuredIcons: { flexDirection: 'row', gap: spacing(0.5), marginBottom: 4 },
  featuredIcon: { fontSize: 46 },
  featuredTitle: { fontSize: 26, fontWeight: '900' },
  featuredLine: { fontSize: 15, fontWeight: '700', textAlign: 'center', opacity: 0.85 },
  playPill: { borderRadius: 999, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1), marginTop: spacing(1) },
  playPillText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },

  sectionHeading: { marginTop: spacing(4), marginBottom: spacing(1), alignItems: 'center' },
  eyebrow: { color: colors.primary, fontSize: 13, letterSpacing: 1.6, fontWeight: '900' },
  heading: { color: colors.ink, fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  section: { marginTop: spacing(2) },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#3F3126', marginBottom: spacing(0.5), paddingHorizontal: spacing(0.75) },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { aspectRatio: 1, borderRadius: 24, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', padding: spacing(1), gap: spacing(0.75) },
  tilePressed: { transform: [{ scale: 0.93 }] },
  tileBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { fontSize: 34 },
  tileBubbleCompact: { width: 50, height: 50, borderRadius: 25 },
  tileIconCompact: { fontSize: 27 },
  tileNameCompact: { fontSize: 13, lineHeight: 16 },
  tileName: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: '#3F3126', textAlign: 'center' },

  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5), marginTop: spacing(4) },
  step: { width: '100%', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 24, borderWidth: 1.5, borderColor: colors.line, padding: spacing(2), alignItems: 'center', gap: 4 },
  stepWide: { width: undefined, flex: 1 },
  stepNumber: { position: 'absolute', top: spacing(1.25), left: spacing(1.25), width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: colors.primary, fontWeight: '900', fontSize: 15 },
  stepIcon: { fontSize: 46 },
  stepTitle: { fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  stepLine: { fontSize: 14, color: colors.inkSoft, textAlign: 'center' },

  grownUpCard: { marginTop: spacing(2), backgroundColor: '#FFFFFF', borderColor: colors.line, borderWidth: 1.5, borderRadius: 22, padding: spacing(2), flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), flexWrap: 'wrap' },
  lockBubble: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  lock: { fontSize: 23 },
  grownUpCopy: { flex: 1, minWidth: 190 },
  grownUpTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  grownUpBody: { color: colors.inkSoft, fontSize: 13, lineHeight: 18, marginTop: 3 },
  parentButton: { backgroundColor: colors.primary, borderRadius: 14, minHeight: 46, justifyContent: 'center', paddingHorizontal: spacing(2) },
  parentButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
