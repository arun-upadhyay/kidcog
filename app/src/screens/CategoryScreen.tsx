import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Sheet from '../components/Sheet';
import { CATEGORY_GROUPS } from '../categoryGroups';
import { CATEGORY_NAMES, CATEGORY_VISUALS, GAME_CATEGORIES, GROUP_NAMES, GROUP_VISUALS } from '../categoryVisuals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import JourneyMap from '../components/JourneyMap';
import type { ChildProgress } from '../progress';
import Button from '../components/Button';
import { fetchCategories } from '../api';
import { colors, spacing, column, GUTTER, CONTENT_MAX_WIDTH } from '../theme';
import type { TraitKey, TraitMetaPublic, Report } from '../types';

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

export default function CategoryScreen({ onSelect, onPreview, progress = null, onReport, onPlayZone, onBack, report, explored, busy, error, initialCategory = 'abstract_concepts', initialCount = 2 }: {
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
  onBack: () => void;
  /** The latest test's result, for the "View latest result" button. */
  report: Report | null;
  /** Categories tried during this visit (from each test's own result). */
  explored: Report['traits'];
  busy: boolean;
  error: string | null;
}) {
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
  useEffect(() => { AsyncStorage.getItem(VIEW_KEY).then(v => { if (v === 'map') setView('map'); }).catch(() => {}); }, []);
  const chooseView = (next: 'tiles' | 'map') => { setView(next); AsyncStorage.setItem(VIEW_KEY, next).catch(() => {}); };

  // Two tiles per row on a phone, three when there is room.
  const { width } = useWindowDimensions();
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroBubble}><Text style={styles.heroEmoji}>🌈</Text></View>
        <Text style={styles.heroTitle}>What shall we explore?</Text>
      </View>

      {onPlayZone ? (
        <Pressable onPress={onPlayZone} disabled={busy} accessibilityRole="button" accessibilityLabel="Open the Play Zone games"
          style={({ pressed }) => [styles.playZone, pressed && styles.pressed]}>
          <Text style={styles.playZoneEmoji}>🎮</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.playZoneTitle}>Play Zone</Text>
            <Text style={styles.playZoneSub}>Number Snake, Bubble Pop, mazes and tracing</Text>
          </View>
          <Text style={styles.playZoneGo}>▶</Text>
        </Pressable>
      ) : null}

      <View style={styles.lengthRow}>
        <Text style={styles.lengthLabel}>How many?</Text>
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
              style={({ pressed }) => [styles.tab, on && { backgroundColor: visual.background, borderColor: visual.border }, pressed && styles.pressed]}
            >
              <Text style={styles.tabEmoji}>{visual.icon}</Text>
              <Text style={[styles.tabText, on && { color: visual.ink }]} numberOfLines={1}>{GROUP_NAMES[group.key]}</Text>
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
        {([['tiles', '▦  Pictures'], ['map', '🗺️  Adventure map']] as const).map(([key, label]) => (
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
            <View key={category.key} style={[styles.tileWrap, { width: tileWidth }]}>
              <Pressable
                onPress={() => openActivity(category.key)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel={`${CATEGORY_NAMES[category.key]}${done ? ', played before' : ''}`}
                style={({ pressed }) => [styles.tile, { backgroundColor: visual.background, borderColor: visual.border }, pressed && styles.pressed]}
              >
                <View style={[styles.tileIcon, { borderColor: visual.border }]}><Text style={styles.tileEmoji}>{visual.icon}</Text></View>
                <Text style={styles.tileName} numberOfLines={2}>{CATEGORY_NAMES[category.key]}</Text>
                {done ? <View style={styles.doneBadge}><Text style={styles.doneText}>✓</Text></View> : null}
                {GAME_CATEGORIES.has(category.key) ? <View style={styles.gameChip}><Text style={styles.gameChipText}>🎮 Games</Text></View> : null}
                {(progress?.visited[category.key]?.stars ?? 0) > 0 ? <Text style={styles.tileStars}>⭐ {progress!.visited[category.key]!.stars}</Text> : null}
              </Pressable>
            </View>
          );
        })}
      </View>

      {error && !openKey ? <Text style={styles.problemText}>{error}</Text> : null}

      <View style={{ marginTop: spacing(1) }}>
        {report
          ? <Button title="View latest result" variant="secondary" onPress={onReport} disabled={busy} />
          : <Button title="← Back" variant="secondary" onPress={onBack} disabled={busy} />}
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
                <Button
                  title={starting ? 'Making your questions…' : failed ? 'Try again ↻' : '▶  Let’s play!'}
                  onPress={() => play(open.key)}
                  loading={starting}
                  disabled={busy}
                  uiScale={1.15}
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
  container: { padding: GUTTER, paddingBottom: spacing(6), gap: spacing(2), ...column },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },

  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), backgroundColor: '#FFF0C9', borderRadius: 24, padding: spacing(2), borderWidth: 2, borderColor: '#F4C966' },
  heroBubble: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F4C966', transform: [{ rotate: '-5deg' }] },
  heroEmoji: { fontSize: 32 },
  heroTitle: { flex: 1, fontSize: 23, lineHeight: 28, fontWeight: '900', color: '#633E12' },

  playZone: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), backgroundColor: '#EEE9FF', borderRadius: 20, paddingVertical: spacing(1.25), paddingHorizontal: spacing(2), borderWidth: 2, borderColor: '#CABAF0' },
  playZoneEmoji: { fontSize: 30 },
  playZoneTitle: { fontSize: 18, fontWeight: '900', color: '#4E3590' },
  playZoneSub: { fontSize: 13, fontWeight: '700', color: '#6A58A0', marginTop: 1 },
  playZoneGo: { fontSize: 20, fontWeight: '900', color: '#4E3590' },

  lengthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1) },
  lengthLabel: { fontSize: 16, fontWeight: '900', color: '#513A27' },
  lengthPills: { flexDirection: 'row', gap: spacing(1) },
  lengthPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: spacing(1.75), borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF' },
  lengthPillOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  lengthIcon: { fontSize: 18 },
  lengthNumber: { fontSize: 17, fontWeight: '900', color: '#6D5A49' },
  lengthNumberOn: { color: colors.primary },

  tabs: { flexDirection: 'row', gap: spacing(1) },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing(1.25), borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF' },
  tabEmoji: { fontSize: 26 },
  tabText: { fontSize: 13, fontWeight: '800', color: colors.inkSoft, marginTop: 2 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -spacing(0.75) },
  viewSwitch: { flexDirection: 'row', alignSelf: 'center', backgroundColor: '#F3EADB', borderRadius: 999, padding: 4, gap: 4 },
  viewOption: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  viewOptionOn: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  viewText: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  viewTextOn: { color: colors.ink },
  gameChip: { position: 'absolute', left: 10, top: 10, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  gameChipText: { fontSize: 11, fontWeight: '900', color: '#4E3590' },
  tileStars: { marginTop: 4, fontSize: 13, fontWeight: '900', color: '#8A5A0A' },
  tileWrap: { padding: spacing(0.75) },
  tile: { minHeight: 150, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center', padding: spacing(1.5), shadowColor: '#4A3728', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  tileIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 38 },
  tileName: { fontSize: 16, lineHeight: 20, fontWeight: '900', color: '#3F3126', textAlign: 'center', marginTop: spacing(1) },
  doneBadge: { position: 'absolute', right: 10, top: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.go, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  doneText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

  problem: { gap: spacing(1.5) },
  problemText: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(1.5), borderRadius: 12, fontSize: 14, lineHeight: 20 },

  sheetBody: { gap: spacing(1.5) },
  sheetIcon: { alignSelf: 'center', width: 104, height: 104, borderRadius: 52, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginTop: spacing(1) },
  sheetEmoji: { fontSize: 56 },
  sheetTitle: { fontSize: 26, fontWeight: '900', color: '#3F3126', textAlign: 'center' },
  sheetOfficial: { fontSize: 12, fontWeight: '700', color: colors.inkSoft, textAlign: 'center', marginTop: -spacing(1) },
  sheetBlurb: { fontSize: 15, lineHeight: 22, color: '#5E5249', textAlign: 'center' },
  sheetMeta: { flexDirection: 'row', justifyContent: 'center', gap: spacing(1.5) },
  sheetMetaText: { fontSize: 13, fontWeight: '800', color: '#6D5A49', backgroundColor: '#F3EEE7', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.5), overflow: 'hidden' },
  notNow: { alignSelf: 'center', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing(2) },
  notNowText: { fontSize: 15, fontWeight: '800', color: colors.inkSoft },
});
