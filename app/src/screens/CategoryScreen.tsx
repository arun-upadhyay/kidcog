import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Sheet from '../components/Sheet';
import { CATEGORY_GROUPS } from '../categoryGroups';
import { CATEGORY_NAMES, CATEGORY_VISUALS, GAME_CATEGORIES, GROUP_NAMES, GROUP_VISUALS } from '../categoryVisuals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JourneyMap from '../components/JourneyMap';
import type { ChildProgress } from '../progress';
import Button from '../components/Button';
import { ChunkyButton, OwlStage, PLAY, Ribbon, WaveBand } from '../components/Playful';
import { fetchCategories } from '../api';
import { colors, spacing, column, GUTTER, CONTENT_MAX_WIDTH } from '../theme';
import type { TraitKey, TraitMetaPublic, Report } from '../types';
import { useAppHeaderScroll } from '../headerScroll';

type GroupKey = (typeof CATEGORY_GROUPS)[number]['key'];

const ROUND_OPTIONS = [
  { count: 2, icon: '⚡' },
  { count: 5, icon: '⭐' },
  { count: 6, icon: '🚀' },
] as const;

/**
 * Choosing an activity, designed for a child sitting next to a grown-up:
 * four colourful group tabs, a grid of big picture tiles with short names, and
 * one "Let's play!" button in a sheet that slides up when a tile is tapped.
 * The official category wording and description live in that sheet, not on
 * the tiles, so the screen stays mostly pictures.
 */
const VIEW_KEY = 'kidcog.categoryView.v1';

function ActivityTile({ title, visual, done, game, stars, width, disabled, reduceMotion, onPress }: {
  title: string;
  visual: { icon: string; background: string; border: string };
  done: boolean;
  game: boolean;
  stars: number;
  width: `${number}%`;
  disabled: boolean;
  reduceMotion: boolean;
  onPress: () => void;
}) {
  const motion = useRef(new Animated.Value(0)).current;
  const hovering = useRef(false);
  const [hovered, setHovered] = useState(false);

  const animate = (toValue: number) => {
    if (reduceMotion) { motion.setValue(toValue); return; }
    Animated.spring(motion, {
      toValue,
      damping: 12,
      stiffness: 230,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  };
  const hoverIn = () => { hovering.current = true; setHovered(true); animate(1); };
  const hoverOut = () => { hovering.current = false; setHovered(false); animate(0); };

  return (
    <Animated.View style={[styles.tileWrap, { width }, {
      transform: [
        { translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
        { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
      ],
    }]}>
      <Pressable
        onPress={onPress}
        onHoverIn={hoverIn}
        onHoverOut={hoverOut}
        onPressIn={() => animate(1)}
        onPressOut={() => animate(hovering.current ? 1 : 0)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${title}${done ? ', played before' : ''}`}
        accessibilityHint="Opens this activity"
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: visual.background, borderColor: visual.border },
          hovered && styles.tileHovered,
          pressed && styles.tilePressed,
        ]}
      >
        <Animated.View style={[styles.tileIcon, { borderColor: visual.border }, {
          transform: [
            { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
            { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-5deg'] }) },
          ],
        }]}>
          <Text style={styles.tileEmoji}>{visual.icon}</Text>
        </Animated.View>
        <Text style={styles.tileName} numberOfLines={2}>{title}</Text>
        <Animated.Text accessibilityElementsHidden style={[styles.hoverSparkle, {
          opacity: motion,
          transform: [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
        }]}>✨</Animated.Text>
        {done ? <View style={styles.doneBadge}><Text style={styles.doneText}>✓</Text></View> : null}
        {game ? <View style={styles.gameChip}><Text style={styles.gameChipText}>🎮 Games</Text></View> : null}
        {stars > 0 ? <Text style={styles.tileStars}>⭐ {stars}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export default function CategoryScreen({ onSelect, onPreview, progress = null, onReport, onPlayZone, onAnimals, onBack, report, explored, busy, error, initialCategory = 'abstract_concepts', initialCount = 2 }: {
  onSelect: (trait: TraitKey, count: number) => void;
  /** A category's sheet was opened: a chance to get its questions ready early. */
  onPreview?: (trait: TraitKey) => void;
  /** This child's stars per activity and last one played, for the tiles and the map. */
  progress?: ChildProgress | null;
  /** Last category and round length used, so coming back keeps the parent's choice. */
  initialCategory?: TraitKey;
  initialCount?: number;
  onReport: () => void;
  /** Opens the Play Zone games (hidden when not given). */
  onPlayZone?: () => void;
  /** Opens the Animal Explorer straight away. */
  onAnimals?: () => void;
  onBack: () => void;
  /** The latest test's result, for the "View latest result" button. */
  report: Report | null;
  /** Categories tried during this visit (from each test's own result). */
  explored: Report['traits'];
  busy: boolean;
  error: string | null;
}) {
  const onHeaderScroll = useAppHeaderScroll();
  const [categories, setCategories] = useState<TraitMetaPublic[]>([]);
  const [count, setCount] = useState(initialCount);
  const [tab, setTab] = useState<GroupKey>('intellectual');
  const [openKey, setOpenKey] = useState<TraitKey | null>(null);
  // The activity whose "Let's play!" was pressed, so its error shows in its sheet.
  const [startedFrom, setStartedFrom] = useState<TraitKey | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Picture tiles or the adventure map; remembered on this device.
  const [view, setView] = useState<'tiles' | 'map'>('tiles');
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => { AsyncStorage.getItem(VIEW_KEY).then(v => { if (v === 'map') setView('map'); }).catch(() => {}); }, []);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => subscription?.remove();
  }, []);
  const chooseView = (next: 'tiles' | 'map') => { setView(next); AsyncStorage.setItem(VIEW_KEY, next).catch(() => {}); };

  // Two tiles per row on a phone, three when there is room.
  const { width, height } = useWindowDimensions();
  const inner = Math.min(width, CONTENT_MAX_WIDTH) - GUTTER * 2;
  const tileWidth = inner >= 480 ? '33.333%' : '50%';

  useEffect(() => {
    let active = true;
    setLoadError(null);
    void fetchCategories().then(data => {
      if (!active) return;
      setCategories(data);
      // Open on the tab of the activity played last.
      const last = data.find(c => c.key === initialCategory);
      if (last) setTab((last.group ?? 'intellectual') as GroupKey);
    }).catch(err => {
      if (active) setLoadError(err instanceof Error ? err.message : 'Could not load activities.');
    });
    return () => { active = false; };
  }, [attempt, initialCategory]);

  const tried = (key: TraitKey) => (explored.find(t => t.key === key)?.questionCount ?? 0) > 0 || (progress?.visited[key]?.plays ?? 0) > 0;
  const openActivity = (key: TraitKey) => { setOpenKey(key); onPreview?.(key); };
  const tabCategories = categories.filter(c => (c.group ?? 'intellectual') === tab);
  const open = openKey ? categories.find(c => c.key === openKey) : undefined;

  function play(key: TraitKey) {
    if (busy) return;
    setStartedFrom(key);
    onSelect(key, count);
  }

  const wideHero = width >= 640;
  // The two big adventures sit side by side (smaller on phones, so the activities stay near).
  const compactCards = width < 560;
  const stageWidth = wideHero ? 260 : height < 700 ? 150 : Math.min(180, width - spacing(10));
  const adventures = [
    onPlayZone ? { key: 'play', onPress: onPlayZone, label: 'Open the Play Zone games', ribbon: '🎮 GAMES', colour: 'grape' as const, icons: ['🐍', '🫧', '🌀', '🖍️'], title: 'Play Zone', line: 'Number Snake, Bubble Pop, mazes, tracing and dots', background: '#F1EBFF', ink: '#4E3590' } : null,
    onAnimals ? { key: 'animals', onPress: onAnimals, label: 'Open the Animal Explorer', ribbon: '🔊 ANIMALS', colour: 'sun' as const, icons: ['🦁', '🐘', '🐧', '🦋'], title: 'Animal Explorer', line: 'Animal quiz, animal sounds and your album', background: '#FFF6DA', ink: '#6E4706' } : null,
  ].filter(<T,>(a: T | null): a is T => a !== null);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} onScroll={onHeaderScroll} scrollEventThrottle={16}>
      {/* Owl asks the big question */}
      <View style={[styles.hero, wideHero && styles.heroWide]}>
        <OwlStage width={stageWidth} owlSize={Math.round(stageWidth * 0.3)} tint="sun" bubble="What’s next? 🌈" />
        <View style={[styles.heroCopy, wideHero && styles.heroCopyWide]}>
          <Text style={[styles.eyebrow, wideHero && styles.leftText]}>✨ PICK AN ADVENTURE ✨</Text>
          <Text accessibilityRole="header" style={[styles.heroTitle, wideHero && styles.heroTitleWide]}>What shall we explore?</Text>
        </View>
      </View>

      {/* The two big adventures */}
      {adventures.length ? (
        <View style={styles.adventures}>
          {adventures.map(a => {
            const c = PLAY[a.colour];
            return (
              <Pressable key={a.key} onPress={a.onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={a.label}
                style={({ pressed }) => [styles.adventure, compactCards && styles.adventureCompact, { backgroundColor: a.background, borderColor: c.face }, pressed && styles.pressed]}>
                <Ribbon text={width < 360 ? a.ribbon.replace(/^\S+ /, '') : a.ribbon} colour={a.colour} />
                <View style={styles.adventureIcons}>
                  {(compactCards ? a.icons.slice(0, 2) : a.icons).map((icon, j) => <Text key={icon} style={[styles.adventureIcon, compactCards && styles.adventureIconCompact, { transform: [{ rotate: `${(j - 1.5) * 9}deg` }] }]}>{icon}</Text>)}
                </View>
                <Text style={[styles.adventureTitle, compactCards && styles.adventureTitleCompact, { color: a.ink }]} numberOfLines={2}>{a.title}</Text>
                <Text style={[styles.adventureLine, compactCards && styles.adventureLineCompact, { color: a.ink }]} numberOfLines={compactCards ? 3 : 2}>{a.line}</Text>
                <View style={[styles.playPill, { backgroundColor: c.face, borderColor: c.lip }]}><Text style={[styles.playPillText, { color: c.text }]}>▶ Play</Text></View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Thinking activities */}
      <WaveBand colour={PLAY.grass.face} bottom>
        <View style={styles.band} accessibilityRole="header">
          <Text style={styles.bandEmoji}>🧠</Text>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.bandTitle}>Thinking Activities</Text>
            <Text style={styles.bandSub}>Pick one below to play together</Text>
          </View>
          <Text style={styles.bandArrow}>▼</Text>
        </View>
      </WaveBand>

      <View style={styles.lengthRow}>
        <Text style={styles.lengthLabel}>🔢  How many?</Text>
        <View style={styles.lengthPills}>
          {ROUND_OPTIONS.map(option => {
            const on = count === option.count;
            return (
              <Pressable
                key={option.count}
                accessibilityRole="radio"
                accessibilityLabel={`${option.count} questions`}
                accessibilityState={{ checked: on, disabled: busy }}
                disabled={busy}
                onPress={() => setCount(option.count)}
                style={({ pressed }) => [styles.lengthPill, on && styles.lengthPillOn, pressed && styles.pressed]}
              >
                <Text style={styles.lengthIcon}>{option.icon}</Text>
                <Text style={[styles.lengthNumber, on && styles.lengthNumberOn]}>{option.count}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.tabs}>
        {CATEGORY_GROUPS.map(group => {
          const visual = GROUP_VISUALS[group.key];
          const on = tab === group.key;
          return (
            <Pressable
              key={group.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${GROUP_NAMES[group.key]} activities`}
              onPress={() => setTab(group.key)}
              style={({ pressed }) => [styles.tab, { borderColor: visual.border }, on && [styles.tabOn, { backgroundColor: visual.background }], pressed && styles.pressed]}
            >
              <Text style={[styles.tabEmoji, on && styles.tabEmojiOn]}>{visual.icon}</Text>
              <Text style={[styles.tabText, { color: visual.ink }]} numberOfLines={1}>{GROUP_NAMES[group.key]}</Text>
            </Pressable>
          );
        })}
      </View>

      {loadError ? (
        <View style={styles.problem}>
          <Text style={styles.problemText}>{loadError}</Text>
          <Button title="Try again ↻" variant="secondary" onPress={() => setAttempt(v => v + 1)} />
        </View>
      ) : null}

      <View style={styles.viewSwitch} accessibilityRole="tablist">
        {([['tiles', '🖼️  Pictures'], ['map', '🗺️  Adventure map']] as const).map(([key, label]) => (
          <Pressable key={key} onPress={() => chooseView(key)} accessibilityRole="tab" accessibilityState={{ selected: view === key }}
            style={({ pressed }) => [styles.viewOption, view === key && styles.viewOptionOn, pressed && styles.pressed]}>
            <Text style={[styles.viewText, view === key && styles.viewTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {view === 'map' ? <JourneyMap categories={tabCategories} progress={progress} disabled={busy} onOpen={openActivity} /> : null}

      <View style={[styles.grid, view === 'map' && { display: 'none' }]}>
        {tabCategories.map(category => {
          const visual = CATEGORY_VISUALS[category.key];
          const done = tried(category.key);
          return (
            <ActivityTile
              key={category.key}
              title={CATEGORY_NAMES[category.key]}
              visual={visual}
              done={done}
              game={GAME_CATEGORIES.has(category.key)}
              stars={progress?.visited[category.key]?.stars ?? 0}
              width={tileWidth}
              disabled={busy}
              reduceMotion={reduceMotion}
              onPress={() => openActivity(category.key)}
            />
          );
        })}
      </View>

      {error && !openKey ? <Text style={styles.problemText}>{error}</Text> : null}

      <View style={{ marginTop: spacing(1) }}>
        {report
          ? <ChunkyButton colour="white" size="md" title="View latest result" onPress={onReport} disabled={busy} />
          : <ChunkyButton colour="white" size="md" title="← Back" onPress={onBack} disabled={busy} />}
      </View>

      {/* Tap a tile: the details and one big Play button slide up. */}
      <Sheet visible={openKey !== null} onClose={() => { if (!busy) setOpenKey(null); }}>
          {open ? (() => {
            const visual = CATEGORY_VISUALS[open.key];
            const starting = busy && startedFrom === open.key;
            const failed = !busy && !!error && startedFrom === open.key;
            return (
              <View style={styles.sheetBody}>
                <View style={[styles.sheetIcon, { backgroundColor: visual.background, borderColor: visual.border }]}>
                  <Text style={styles.sheetEmoji}>{visual.icon}</Text>
                </View>
                <Text style={styles.sheetTitle}>{CATEGORY_NAMES[open.key]}</Text>
                <Text style={styles.sheetOfficial}>{open.label}</Text>
                <Text style={styles.sheetBlurb}>{open.blurb}</Text>
                <View style={styles.sheetMeta}>
                  <Text style={styles.sheetMetaText}>{ROUND_OPTIONS.find(o => o.count === count)?.icon} {count} questions</Text>
                  {tried(open.key) ? <Text style={styles.sheetMetaText}>✓ Played before</Text> : null}
                </View>
                {failed ? <Text style={styles.problemText}>{error}</Text> : null}
                <ChunkyButton
                  colour={failed ? 'sky' : 'coral'}
                  title={starting ? 'Making your questions…' : failed ? 'Try again ↻' : '▶  Let’s play!'}
                  onPress={() => play(open.key)}
                  loading={starting}
                  disabled={busy}
                />
                <Pressable onPress={() => setOpenKey(null)} disabled={busy} accessibilityRole="button" style={styles.notNow}>
                  <Text style={styles.notNowText}>Not now</Text>
                </Pressable>
              </View>
            );
          })() : null}
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFF8EF' },
  container: { padding: GUTTER, paddingBottom: spacing(6), gap: spacing(2.5), ...column },
  pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  leftText: { textAlign: 'left' },

  hero: { alignItems: 'center', backgroundColor: '#FFF4D2', borderRadius: 30, borderWidth: 3, borderBottomWidth: 8, borderColor: '#FFC83D', paddingTop: spacing(1.5), paddingBottom: spacing(2), paddingHorizontal: spacing(2) },
  heroWide: { flexDirection: 'row', justifyContent: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  heroCopy: { alignItems: 'center', marginTop: spacing(0.5) },
  heroCopyWide: { alignItems: 'flex-start', flexShrink: 1 },
  eyebrow: { fontSize: 13, letterSpacing: 1.4, fontWeight: '900', color: PLAY.coral.face, textAlign: 'center' },
  heroTitle: { fontSize: 30, lineHeight: 36, fontWeight: '900', color: '#633E12', textAlign: 'center', marginTop: 2 },
  heroTitleWide: { fontSize: 38, lineHeight: 44, textAlign: 'left' },

  adventures: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(2) },
  adventure: { flex: 1, borderRadius: 28, borderWidth: 4, borderBottomWidth: 9, alignItems: 'center', paddingHorizontal: spacing(2), paddingTop: spacing(3.5), paddingBottom: spacing(2), gap: 4 },
  adventureCompact: { borderRadius: 24, borderWidth: 3, borderBottomWidth: 7, paddingHorizontal: spacing(1), paddingTop: spacing(3), paddingBottom: spacing(1.5) },
  adventureIconCompact: { fontSize: 30 },
  adventureTitleCompact: { fontSize: 18, lineHeight: 22 },
  adventureLineCompact: { fontSize: 12, lineHeight: 16 },
  adventureIcons: { flexDirection: 'row', gap: spacing(0.5), marginBottom: 2 },
  adventureIcon: { fontSize: 40 },
  adventureTitle: { fontSize: 25, fontWeight: '900', textAlign: 'center' },
  adventureLine: { fontSize: 14, fontWeight: '700', textAlign: 'center', opacity: 0.9 },
  playPill: { borderRadius: 999, borderBottomWidth: 4, paddingHorizontal: spacing(3), paddingVertical: spacing(0.875), marginTop: spacing(1) },
  playPillText: { fontSize: 17, fontWeight: '900' },

  band: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), paddingHorizontal: spacing(2), paddingVertical: spacing(0.5) },
  bandEmoji: { fontSize: 34 },
  bandTitle: { fontSize: 22, fontWeight: '900', color: '#FFFFFF' },
  bandSub: { fontSize: 14, fontWeight: '800', color: '#E1F4E8', marginTop: 1 },
  bandArrow: { marginLeft: 'auto', fontSize: 20, fontWeight: '900', color: '#FFFFFF' },

  lengthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing(1) },
  lengthLabel: { fontSize: 18, fontWeight: '900', color: '#513A27' },
  lengthPills: { flexDirection: 'row', gap: spacing(1) },
  lengthPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 48, paddingHorizontal: spacing(1.75), borderRadius: 999, borderWidth: 2.5, borderBottomWidth: 5, borderColor: '#F3B7A9', backgroundColor: '#FFFFFF' },
  lengthPillOn: { borderColor: PLAY.coral.lip, backgroundColor: PLAY.coral.face, transform: [{ translateY: -2 }] },
  lengthIcon: { fontSize: 18 },
  lengthNumber: { fontSize: 19, fontWeight: '900', color: PLAY.coral.lip },
  lengthNumberOn: { color: '#FFFFFF' },

  tabs: { flexDirection: 'row', gap: spacing(1) },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing(1.25), borderRadius: 22, borderWidth: 2.5, borderBottomWidth: 5, backgroundColor: '#FFFFFF' },
  tabOn: { borderWidth: 3, borderBottomWidth: 8, transform: [{ translateY: -3 }] },
  tabEmoji: { fontSize: 28 },
  tabEmojiOn: { fontSize: 34 },
  tabText: { fontSize: 14, fontWeight: '900', marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(0.75) },
  viewSwitch: { flexDirection: 'row', alignSelf: 'center', backgroundColor: '#E3EFFD', borderRadius: 999, padding: 5, gap: 4 },
  viewOption: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 18, borderRadius: 999 },
  viewOptionOn: { backgroundColor: PLAY.sky.face, borderBottomWidth: 4, borderColor: PLAY.sky.lip },
  viewText: { fontSize: 15, fontWeight: '900', color: PLAY.sky.lip },
  viewTextOn: { color: '#FFFFFF' },
  gameChip: { position: 'absolute', left: 10, top: 10, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  gameChipText: { fontSize: 11, fontWeight: '900', color: '#4E3590' },
  tileStars: { marginTop: 4, fontSize: 13, fontWeight: '900', color: '#8A5A0A' },
  tileWrap: { padding: spacing(0.75) },
  tile: { minHeight: 160, borderRadius: 26, borderWidth: 2.5, borderBottomWidth: 7, alignItems: 'center', justifyContent: 'center', padding: spacing(1.5) },
  tileHovered: { borderWidth: 3, borderBottomWidth: 9, shadowColor: '#4A3728', shadowOpacity: 0.2, shadowRadius: 15, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  tilePressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  tileIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 38 },
  tileName: { fontSize: 16, lineHeight: 20, fontWeight: '900', color: '#3F3126', textAlign: 'center', marginTop: spacing(1) },
  hoverSparkle: { position: 'absolute', right: 12, bottom: 10, fontSize: 19 },
  doneBadge: { position: 'absolute', right: 10, top: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: PLAY.grass.face, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderColor: PLAY.grass.lip },
  doneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

  problem: { gap: spacing(1.5) },
  problemText: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(1.5), borderRadius: 12, fontSize: 14, lineHeight: 20 },

  sheetBody: { gap: spacing(1.5) },
  sheetIcon: { alignSelf: 'center', width: 112, height: 112, borderRadius: 56, borderWidth: 4, borderBottomWidth: 8, alignItems: 'center', justifyContent: 'center', marginTop: spacing(1) },
  sheetEmoji: { fontSize: 56 },
  sheetTitle: { fontSize: 28, fontWeight: '900', color: '#5D439B', textAlign: 'center' },
  sheetOfficial: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textAlign: 'center', marginTop: -spacing(1) },
  sheetBlurb: { fontSize: 15, lineHeight: 22, color: '#5E5249', textAlign: 'center' },
  sheetMeta: { flexDirection: 'row', justifyContent: 'center', gap: spacing(1.5) },
  sheetMetaText: { fontSize: 13, fontWeight: '800', color: '#6D5A49', backgroundColor: '#F3EEE7', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.5), overflow: 'hidden' },
  notNow: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(2) },
  notNowText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
