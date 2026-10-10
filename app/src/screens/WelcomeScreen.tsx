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
import { ChunkyButton, OwlStage, PLAY, Ribbon, WaveBand, type PlayColour } from '../components/Playful';
import { PRIVACY_PATH, openPublicPage } from '../legal';
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
  { key: 'animals', title: 'Animal Explorer', line: '79 animals, real sounds and fun facts', icons: ['🦁', '🐘', '🐧', '🦋'], background: '#FFF1C9', border: '#E7B23C', ink: '#7A4E08', ribbon: '🔊 REAL ANIMAL SOUNDS', ribbonColour: 'coral' },
  { key: 'playzone', title: 'Play Zone', line: 'Snake, bubbles, mazes, tracing and dots', icons: ['🐍', '🫧', '🖍️', '✏️'], background: '#EEE8FF', border: '#9B7EDE', ink: '#4E3590', ribbon: '🆕 CONNECT THE DOTS', ribbonColour: 'grape' },
] as const;

const GAMES: Tile[] = [
  { key: 'snake', icon: '🐍', name: 'Number Snake', background: '#E5F5EA', border: '#63AA7D' },
  { key: 'bubbles', icon: '🫧', name: 'Bubble Pop', background: '#E5F3FF', border: '#68A8D6' },
  { key: 'maze', icon: '🌀', name: 'Maze Runner', background: '#EEE9FF', border: '#A68AE2' },
  { key: 'trace', icon: '✏️', name: 'Trace & Draw', background: '#FFE9E3', border: '#E88970' },
  { key: 'dots', icon: '🖍️', name: 'Connect the Dots', background: '#E3F1FB', border: '#5B9BD0' },
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

export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduce);
    return () => sub?.remove();
  }, []);
  return reduce;
}

/** A looping 0 → 1 → 0 value, or a still 0 when motion is reduced. */
export function useWave(ms: number, still: boolean, delay = 0) {
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

function PreviewTile({ tile, compact, still, onPress }: { tile: Tile; compact: boolean; still: boolean; onPress: () => void }) {
  const motion = useRef(new Animated.Value(0)).current;
  const hovering = useRef(false);
  const [hovered, setHovered] = useState(false);
  const animate = (toValue: number) => {
    if (still) { motion.setValue(toValue); return; }
    Animated.spring(motion, { toValue, damping: 11, stiffness: 250, mass: 0.65, useNativeDriver: true }).start();
  };
  const hoverIn = () => { hovering.current = true; setHovered(true); animate(1); };
  const hoverOut = () => { hovering.current = false; setHovered(false); animate(0); };
  return (
    <Animated.View style={{
      transform: [
        { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) },
        { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
      ],
    }}>
      <Pressable
        onPress={onPress}
        onHoverIn={hoverIn}
        onHoverOut={hoverOut}
        onPressIn={() => animate(1)}
        onPressOut={() => animate(hovering.current ? 1 : 0)}
        accessibilityRole="button"
        accessibilityLabel={`${tile.name}. Parent sign-in required to start.`}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: tile.background, borderColor: tile.border },
          hovered && styles.tileHovered,
          pressed && styles.tilePressed,
        ]}
      >
        <Animated.View style={[styles.tileBubble, compact && styles.tileBubbleCompact, { borderColor: tile.border }, {
          transform: [
            { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
            { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-6deg'] }) },
          ],
        }]}>
          <Text style={[styles.tileIcon, compact && styles.tileIconCompact]}>{tile.icon}</Text>
        </Animated.View>
        <Text style={[styles.tileName, compact && styles.tileNameCompact]} numberOfLines={3}>{tile.name}</Text>
        <Animated.Text accessibilityElementsHidden style={[styles.tileSparkle, { opacity: motion, transform: [{ scale: motion }] }]}>✨</Animated.Text>
      </Pressable>
    </Animated.View>
  );
}

/** The floating animals and soft colour blobs behind the welcome and sign-in pages. */
export function Background({ still }: { still: boolean }) {
  return (
    <View style={styles.background} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={[styles.blob, { backgroundColor: '#FFE3D6', width: 380, height: 380, top: -120, left: -140 }]} />
      <View style={[styles.blob, { backgroundColor: '#E8E0FF', width: 420, height: 420, top: '30%', right: -180 }]} />
      <View style={[styles.blob, { backgroundColor: '#DDF2E5', width: 360, height: 360, bottom: -140, left: '20%' }]} />
      {/* Only along the sides, so nothing drifts across the words or Owl. */}
      {FLOATERS.map((item, i) => (item.left <= 14 || item.left >= 78) ? <Floater key={item.icon + i} item={item} index={i} still={still} /> : null)}
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

const SECTION_COLOURS: PlayColour[] = ['coral', 'sky', 'sun', 'grass', 'grape'];

export default function WelcomeScreen({ onChoose, onParentSignIn }: {
  /** Any activity was tapped: go to the parent sign-up for it. */
  onChoose: (title: string) => void;
  onParentSignIn: () => void;
}) {
  const { width } = useWindowDimensions();
  const still = useReduceMotion();
  const wide = width >= 720;
  // Owl beside the headline only where both fit (iPad mini/Air portrait stack them).
  const sideHero = width >= 900;
  const columns = width < 360 ? 2 : width < 600 ? 3 : width < 860 ? 4 : 6;
  // Phone tiles are about 110px wide: smaller picture so two-line names fit.
  const compact = columns === 3;
  const owlBob = useWave(1700, still);
  const stageWidth = Math.min(sideHero ? 440 : wide ? 400 : 320, width - spacing(4));

  return (
    <View style={styles.screen}>
      <Background still={still} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarInner}>
            <View style={styles.topBrand}>
              <Owl size={wide ? 42 : 36} />
              <Text style={[styles.topBrandName, !wide && styles.topBrandNameSmall]}>Kid<Text style={styles.topBrandPop}>Cog</Text></Text>
            </View>
            <View style={styles.topActions}>
              {width >= 400 ? (
                <ChunkyButton size="sm" colour="coral" title={wide ? 'Join the fun' : 'Join'} label="Join: create a parent account" onPress={() => onChoose('every adventure')} />
              ) : null}
              <ChunkyButton size="sm" colour="sky" title={wide ? 'Parent sign in' : 'Sign in'} label="Parent sign in" onPress={onParentSignIn} />
            </View>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.container}>
          <View style={[styles.hero, sideHero && styles.heroWide]}>
            <OwlStage width={stageWidth} owlSize={sideHero ? 150 : wide ? 136 : 108} bob={owlBob} bubble="Hoo! Let's play! 🎉" />
            <View style={[styles.heroCopy, sideHero && styles.heroCopyWide]}>
              <Text style={[styles.heroEyebrow, sideHero && styles.leftText]}>FOR CURIOUS 4 TO 7 YEAR OLDS</Text>
              <Text accessibilityRole="header" style={[styles.title, sideHero && styles.titleWide]}>
                Ready for a little <Text style={styles.titlePop}>adventure</Text>?
              </Text>
              <Text style={[styles.subtitle, sideHero && styles.leftText]}>Games, animals, stories and puzzles, with Owl cheering you on.</Text>
              <View style={[styles.ctaRow, sideHero && styles.ctaRowWide]}>
                <ChunkyButton title="▶  Start playing, free" label="Start playing, free" onPress={() => onChoose('every adventure')} />
                <ChunkyButton colour="white" size="md" title="I have an account" label="I already have an account" onPress={onParentSignIn} style={styles.ctaSecondary} />
              </View>
              <View style={[styles.promiseRow, sideHero && styles.ctaRowWide]}>
                {[['⏱️', 'A few minutes'], ['🌈', 'No wrong ideas'], ['🚫', 'No ads'], ['🛡️', 'Grown-up guided']].map(([icon, text]) => (
                  <View key={text} style={styles.promise}><Text style={styles.promiseIcon}>{icon}</Text><Text style={styles.promiseText}>{text}</Text></View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* What's inside, as a band */}
        <WaveBand colour={PLAY.sky.face} bottom>
          <View style={styles.band}>
            {[['🎮', 'Games'], ['🦁', 'Animals'], ['🧠', 'Thinking'], ['📚', 'Words'], ['🔢', 'Numbers'], ['💛', 'Feelings']].map(([icon, text], i) => (
              <React.Fragment key={text}>
                {i > 0 ? <Text style={styles.bandDot} accessibilityElementsHidden>•</Text> : null}
                <Text style={styles.bandText}>{icon} {text}</Text>
              </React.Fragment>
            ))}
          </View>
        </WaveBand>

        <View style={styles.container}>
          {/* Big two */}
          <View style={[styles.featuredRow, wide && styles.featuredRowWide]}>
            {FEATURED.map((f, i) => (
              <Pop key={f.key} index={i} still={still} style={wide ? styles.featuredWide : styles.featuredPhone}>
                <Pressable onPress={() => onChoose(f.title)} accessibilityRole="button" accessibilityLabel={`${f.title}. ${f.line}`}
                  style={({ pressed }) => [styles.featured, { backgroundColor: f.background, borderColor: f.border }, pressed && styles.pressed]}>
                  <Ribbon text={f.ribbon} colour={f.ribbonColour} />
                  <View style={styles.featuredIcons}>
                    {f.icons.map((icon, j) => <Text key={icon} style={[styles.featuredIcon, { transform: [{ rotate: `${(j - 1.5) * 8}deg` }] }]}>{icon}</Text>)}
                  </View>
                  <Text style={[styles.featuredTitle, { color: f.ink }]}>{f.title}</Text>
                  <Text style={[styles.featuredLine, { color: f.ink }]}>{f.line}</Text>
                  <View style={[styles.playPill, { backgroundColor: PLAY[f.ribbonColour].face, borderColor: PLAY[f.ribbonColour].lip }]}><Text style={styles.playPillText}>▶ Play</Text></View>
                </Pressable>
              </Pop>
            ))}
          </View>

          {/* Everything, in pictures */}
          <View style={styles.sectionHeading}>
            <Text style={styles.eyebrow}>✨ 30+ THINGS TO PLAY ✨</Text>
            <Text accessibilityRole="header" style={styles.heading}>What sounds fun today?</Text>
          </View>
          {SECTIONS.map((section, s) => {
            const c = PLAY[SECTION_COLOURS[s % SECTION_COLOURS.length]!];
            return (
              <View key={section.title} style={styles.section}>
                <View style={[styles.sectionPill, { backgroundColor: c.soft, borderColor: c.face }]}>
                  <Text style={styles.sectionTitle}>{section.icon}  {section.title}</Text>
                </View>
                <View style={styles.grid}>
                  {section.tiles.map((t, i) => (
                    <Pop key={t.key} index={i} still={still} style={{ width: `${100 / columns}%`, padding: spacing(0.75) }}>
                      <PreviewTile tile={t} compact={compact} still={still} onPress={() => onChoose(t.name)} />
                    </Pop>
                  ))}
                </View>
              </View>
            );
          })}

          {/* How it works, in three pictures */}
          <View style={styles.sectionHeading}>
            <Text style={styles.eyebrow}>EASY AS 1, 2, 3</Text>
          </View>
          <View style={styles.steps}>
            {([['👪', 'A grown-up signs up', 'Free, in a minute', 'coral'], ['🧒', 'Add your child', 'Just a nickname and age', 'sun'], ['⭐', 'Play and earn stars', 'Stickers, levels and an album', 'grass']] as const).map(([icon, title, line, colour], i) => (
              <View key={title} style={[styles.step, wide && styles.stepWide, { borderColor: PLAY[colour].face }]}>
                <View style={[styles.stepNumber, { backgroundColor: PLAY[colour].face, borderColor: PLAY[colour].lip }]}><Text style={[styles.stepNumberText, { color: PLAY[colour].text }]}>{i + 1}</Text></View>
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
            <ChunkyButton size="md" colour="sky" title="Parent sign in" onPress={onParentSignIn} />
          </View>
        </View>

        {/* Footer */}
        <WaveBand colour={PLAY.grass.face}>
          <View style={styles.footer}>
            <Text style={styles.footerIcons} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">🦁 🐘 🐧 🦋 🐸 🚀</Text>
            <Text style={styles.footerText}>KidCog · made for curious kids by Ritvik Global LLC</Text>
            <Pressable onPress={() => openPublicPage(PRIVACY_PATH)} accessibilityRole="link" style={styles.footerLink}>
              <Text style={styles.footerLinkText}>Privacy policy</Text>
            </Pressable>
          </View>
        </WaveBand>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, overflow: 'hidden' },
  background: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.55 },
  floater: { position: 'absolute', opacity: 0.3 },
  scroll: { flexGrow: 1 },
  container: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: spacing(2), paddingBottom: spacing(3) },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },

  topBar: { backgroundColor: '#FFFFFF', borderBottomWidth: 3, borderBottomColor: '#E3EFFD' },
  topBarInner: { width: '100%', maxWidth: 1040, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), paddingHorizontal: spacing(2), paddingVertical: spacing(1) },
  topBrand: { flexDirection: 'row', alignItems: 'center', gap: spacing(0.75), flexShrink: 1 },
  topBrandName: { color: '#5D439B', fontSize: 26, fontWeight: '900' },
  topBrandNameSmall: { fontSize: 22 },
  topBrandPop: { color: PLAY.coral.face },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },

  hero: { alignItems: 'center', paddingTop: spacing(2), paddingBottom: spacing(1) },
  heroWide: { flexDirection: 'row', justifyContent: 'center', gap: spacing(4), paddingVertical: spacing(4) },
  heroCopy: { alignItems: 'center', maxWidth: 560 },
  heroCopyWide: { alignItems: 'flex-start', flexShrink: 1 },
  heroEyebrow: { color: '#2A2118', fontSize: 13, letterSpacing: 1.6, fontWeight: '900', textAlign: 'center', marginTop: spacing(1.5) },
  title: { color: '#5D439B', textAlign: 'center', fontSize: 34, lineHeight: 40, fontWeight: '900', marginTop: spacing(0.5) },
  titleWide: { fontSize: 50, lineHeight: 56, textAlign: 'left' },
  titlePop: { color: PLAY.sky.face },
  subtitle: { color: colors.inkSoft, textAlign: 'center', fontSize: 18, lineHeight: 26, marginTop: spacing(1) },
  leftText: { textAlign: 'left' },
  ctaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing(1.25), marginTop: spacing(2.5) },
  ctaRowWide: { justifyContent: 'flex-start' },
  ctaSecondary: { minHeight: 56 },
  promiseRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing(0.75), marginTop: spacing(2) },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.92)', borderColor: colors.line, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing(1.5), paddingVertical: 7 },
  promiseIcon: { fontSize: 14 },
  promiseText: { color: colors.inkSoft, fontSize: 13, fontWeight: '800' },

  band: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: spacing(1.25), rowGap: 4, paddingHorizontal: spacing(2), paddingVertical: spacing(0.75) },
  bandText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  bandDot: { color: '#A9D3FF', fontSize: 18, fontWeight: '900' },

  featuredRow: { gap: spacing(4), marginTop: spacing(5) },
  featuredRowWide: { flexDirection: 'row', gap: spacing(2) },
  featuredPhone: { width: '100%' },
  featuredWide: { flex: 1 },
  featured: { borderRadius: 30, borderWidth: 4, borderBottomWidth: 9, padding: spacing(2.5), paddingTop: spacing(3.5), alignItems: 'center', gap: 6 },
  featuredIcons: { flexDirection: 'row', gap: spacing(0.5), marginBottom: 4 },
  featuredIcon: { fontSize: 46 },
  featuredTitle: { fontSize: 27, fontWeight: '900' },
  featuredLine: { fontSize: 15, fontWeight: '700', textAlign: 'center', opacity: 0.85 },
  playPill: { borderRadius: 999, borderBottomWidth: 4, paddingHorizontal: spacing(3), paddingVertical: spacing(1), marginTop: spacing(1) },
  playPillText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },

  sectionHeading: { marginTop: spacing(4), marginBottom: spacing(1), alignItems: 'center' },
  eyebrow: { color: PLAY.coral.face, fontSize: 14, letterSpacing: 1.6, fontWeight: '900', textAlign: 'center' },
  heading: { color: '#5D439B', fontSize: 32, lineHeight: 38, fontWeight: '900', marginTop: 4, textAlign: 'center' },
  section: { marginTop: spacing(2.5) },
  sectionPill: { alignSelf: 'flex-start', borderWidth: 2.5, borderRadius: 999, paddingHorizontal: spacing(1.75), paddingVertical: spacing(0.5), marginBottom: spacing(0.75), marginLeft: spacing(0.75) },
  sectionTitle: { fontSize: 19, fontWeight: '900', color: '#3F3126' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { aspectRatio: 1, borderRadius: 24, borderWidth: 2.5, borderBottomWidth: 6, alignItems: 'center', justifyContent: 'center', padding: spacing(1), gap: spacing(0.75) },
  tileHovered: { borderWidth: 4, borderBottomWidth: 8, shadowColor: '#4A3728', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  tilePressed: { transform: [{ scale: 0.93 }] },
  tileBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { fontSize: 34 },
  tileBubbleCompact: { width: 50, height: 50, borderRadius: 25 },
  tileIconCompact: { fontSize: 27 },
  tileNameCompact: { fontSize: 13, lineHeight: 16 },
  tileName: { fontSize: 14, lineHeight: 18, fontWeight: '900', color: '#3F3126', textAlign: 'center' },
  tileSparkle: { position: 'absolute', right: 9, bottom: 7, fontSize: 18 },

  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  step: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 26, borderWidth: 3, borderBottomWidth: 7, padding: spacing(2), alignItems: 'center', gap: 4 },
  stepWide: { width: undefined, flex: 1 },
  stepNumber: { position: 'absolute', top: spacing(1.25), left: spacing(1.25), width: 36, height: 36, borderRadius: 18, borderBottomWidth: 3, alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { fontWeight: '900', fontSize: 17 },
  stepIcon: { fontSize: 46 },
  stepTitle: { fontSize: 18, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  stepLine: { fontSize: 14, color: colors.inkSoft, textAlign: 'center' },

  grownUpCard: { marginTop: spacing(3), backgroundColor: '#FFFFFF', borderColor: PLAY.sky.face, borderWidth: 3, borderBottomWidth: 7, borderRadius: 26, padding: spacing(2), flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), flexWrap: 'wrap' },
  lockBubble: { width: 52, height: 52, borderRadius: 26, backgroundColor: PLAY.sky.soft, alignItems: 'center', justifyContent: 'center' },
  lock: { fontSize: 25 },
  grownUpCopy: { flex: 1, minWidth: 190 },
  grownUpTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  grownUpBody: { color: colors.inkSoft, fontSize: 14, lineHeight: 19, marginTop: 3 },

  footer: { alignItems: 'center', gap: 6, paddingHorizontal: spacing(2), paddingTop: spacing(1), paddingBottom: spacing(3) },
  footerIcons: { fontSize: 24, letterSpacing: 2 },
  footerText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  footerLink: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(2) },
  footerLinkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', textDecorationLine: 'underline' },
});
