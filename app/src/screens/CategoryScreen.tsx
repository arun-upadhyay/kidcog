import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { CATEGORY_GROUPS } from '../categoryGroups';
import { CATEGORY_VISUALS, GROUP_VISUALS } from '../categoryVisuals';
import Button from '../components/Button';
import { fetchCategories } from '../api';
import { colors, spacing, type } from '../theme';
import type { TraitKey, TraitMetaPublic, Report } from '../types';

const ROUND_OPTIONS = [
  { count: 2, icon: '⚡', title: 'Quick', subtitle: '2 questions' },
  { count: 5, icon: '⭐', title: 'More', subtitle: '5 questions' },
  { count: 6, icon: '🚀', title: 'Big', subtitle: '6 questions' },
] as const;

export default function CategoryScreen({ onSelect, onReport, onBack, report, explored, busy, error }: {
  onSelect: (trait: TraitKey, count: number) => void;
  onReport: () => void;
  onBack: () => void;
  /** The latest test's result, for the "View latest result" button. */
  report: Report | null;
  /** Categories tried during this visit (from each test's own result). */
  explored: Report['traits'];
  busy: boolean;
  error: string | null;
}) {
  const [categories, setCategories] = useState<TraitMetaPublic[]>([]);
  const [selected, setSelected] = useState<TraitKey>('abstract_concepts');
  const [count, setCount] = useState(2);
  // The card whose own Start button was pressed, so only that button spins.
  const [startedFrom, setStartedFrom] = useState<TraitKey | null>(null);

  /** Start a category straight from its card (same path as "Let’s start!"). */
  function startNow(key: TraitKey) {
    if (busy) return;
    setSelected(key);
    setStartedFrom(key);
    onSelect(key, count);
  }
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['intellectual']));

  function toggleGroup(key: string) {
    setExpandedGroups(current => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  useEffect(() => {
    let active = true;
    setLoadError(null);
    void fetchCategories().then(data => { if (active) setCategories(data); }).catch(err => {
      if (active) setLoadError(err instanceof Error ? err.message : 'Could not load categories.');
    });
    return () => { active = false; };
  }, [attempt]);
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <View style={styles.heroBubble}><Text style={styles.heroEmoji}>🌈</Text></View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>GROWN-UP CHOICE</Text>
          <Text style={styles.pageTitle}>What shall we explore?</Text>
          <Text style={styles.heroText}>Choose one colorful thinking adventure. You can try another one afterwards!</Text>
        </View>
      </View>

      <View style={styles.roundPanel}>
        <Text style={styles.sectionTitle}>How long should we play?</Text>
        <View style={styles.lengths}>
          {ROUND_OPTIONS.map(option => {
            const on = count === option.count;
            return <Pressable key={option.count} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: busy }} disabled={busy} onPress={() => setCount(option.count)} style={({ pressed }) => [styles.length, on && styles.lengthSelected, pressed && styles.pressed]}>
              <Text style={styles.lengthIcon}>{option.icon}</Text>
              <Text style={[styles.lengthTitle, on && styles.lengthTitleSelected]}>{option.title}</Text>
              <Text style={styles.lengthSubtitle}>{option.subtitle}</Text>
              {on ? <View style={styles.roundCheck}><Text style={styles.roundCheckText}>✓</Text></View> : null}
            </Pressable>;
          })}
        </View>
        <View style={styles.infoCallout}><Text style={styles.infoIcon}>✨</Text><Text style={styles.infoText}>Fresh AI questions mix pictures, taps, and spoken ideas, then get checked for your child’s age. Two questions give a quick first glimpse.</Text></View>
      </View>

      <View style={styles.categoryHeadingRow}>
        <View><Text style={styles.sectionTitle}>Pick an adventure</Text><Text style={styles.sectionHint}>Open a card, then tap Start on any activity.</Text></View>
        <Text style={styles.categoryHeadingEmoji}>🎒</Text>
      </View>
      <View style={styles.groups}>
        {CATEGORY_GROUPS.map(group => {
          const groupCategories = categories.filter(c => (c.group ?? 'intellectual') === group.key);
          const observed = groupCategories.filter(category => (explored.find(t => t.key === category.key)?.questionCount ?? 0) > 0).length;
          const expanded = expandedGroups.has(group.key);
          const groupVisual = GROUP_VISUALS[group.key];
          return <View key={group.key} style={styles.group}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`${group.label}, ${observed} of ${groupCategories.length} observed`}
            onPress={() => toggleGroup(group.key)}
            style={({ pressed }) => [styles.groupHeader, { backgroundColor: groupVisual.background, borderColor: groupVisual.border }, pressed && styles.pressed]}
          >
            <View style={[styles.groupIcon, { borderColor: groupVisual.border }]}><Text style={styles.groupEmoji}>{groupVisual.icon}</Text></View>
            <View style={styles.groupHeaderCopy}><Text style={[styles.groupTitle, { color: groupVisual.ink }]}>{group.label}</Text><Text style={styles.groupCount}>{observed} of {groupCategories.length} explored</Text></View>
            <View style={[styles.chevronBubble, { backgroundColor: groupVisual.border }]}><Text style={styles.chevron}>{expanded ? '−' : '+'}</Text></View>
          </Pressable>
          {expanded ? <View style={styles.groupItems}>{groupCategories.map(category => {
          const result = explored.find(t => t.key === category.key);
          const visual = CATEGORY_VISUALS[category.key];
          const isSelected = selected === category.key;
          const seen = !!result && result.questionCount > 0;
          const pending = busy && startedFrom === category.key;
          // The card is a container, not one big button: the select area and the
          // Start button are siblings, so neither swallows the other's tap.
          return <View key={category.key} style={[styles.card, isSelected && styles.selected]}>
            <Pressable accessibilityRole="radio" accessibilityState={{ checked: isSelected, disabled: busy }} disabled={busy} onPress={() => setSelected(category.key)} style={styles.cardSelect}>
              <View style={[styles.categoryIcon, { backgroundColor: visual.background, borderColor: visual.border }]}>
                <Text style={styles.categoryEmoji}>{visual.icon}</Text>
                {isSelected ? <View style={styles.selectedBadge}><Text style={styles.selectedCheck}>✓</Text></View> : null}
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.categoryTitle}>{category.label}</Text>
                <Text style={[type.soft, { marginTop: spacing(0.75) }]}>{category.blurb}</Text>
                <View style={[styles.observationPill, seen ? styles.observedPill : null]}><Text style={[type.label, seen ? styles.observedText : null]}>{seen ? `${result!.questionCount} observations so far` : 'Not yet observed'}</Text></View>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${seen ? 'Play again' : 'Start'}: ${category.label}, ${count} questions`}
              accessibilityState={{ disabled: busy || categories.length === 0, busy: pending }}
              disabled={busy || categories.length === 0}
              onPress={() => startNow(category.key)}
              style={({ pressed }) => [
                styles.startButton,
                { borderColor: visual.border, backgroundColor: visual.background },
                busy && !pending && styles.startDisabled,
                pressed && styles.pressed,
              ]}
            >
              {pending ? <ActivityIndicator color={colors.ink} style={{ marginRight: spacing(1) }} /> : null}
              <Text style={styles.startText}>
                {pending ? 'Making the questions…' : `${seen ? 'Play again' : 'Start this one'} · ${count} questions ▶`}
              </Text>
            </Pressable>
          </View>;
          })}</View> : null}
        </View>;})}
      </View>
      {loadError ? <><Text style={styles.error}>{loadError}</Text><Button title="Retry loading categories" onPress={() => setAttempt(v => v + 1)} /></> : null}
      {error ? <View style={styles.retryCard} accessibilityLiveRegion="polite">
        <View style={styles.retryHeading}>
          <View style={styles.retryIconBubble}><Text style={styles.retryIcon}>🌦️</Text></View>
          <View style={styles.retryCopy}><Text style={styles.retryTitle}>That adventure didn’t load</Text><Text style={styles.retryText}>{error}</Text></View>
        </View>
        <Button title={busy ? 'Trying again…' : 'Try again ↻'} variant="secondary" onPress={() => { setStartedFrom(null); onSelect(selected, count); }} disabled={busy || categories.length === 0} loading={busy} />
      </View> : null}
      <View style={styles.actions}>
        <Button title={busy && !startedFrom ? 'Making your adventure…' : 'Let’s start! ✨'} onPress={() => { setStartedFrom(null); onSelect(selected, count); }} loading={busy && !startedFrom} disabled={busy || categories.length === 0} />
        {report ? <Button title="View latest result" variant="secondary" onPress={onReport} disabled={busy} /> : <Button title="Back to child details" variant="secondary" onPress={onBack} disabled={busy} />}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFF8EF' },
  container: { padding: spacing(2.5), paddingBottom: spacing(6), width: '100%', maxWidth: 850, alignSelf: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.75), backgroundColor: '#FFF0C9', borderRadius: 24, padding: spacing(2.25), borderWidth: 2, borderColor: '#F4C966', shadowColor: '#8A5E22', shadowOpacity: 0.09, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  heroBubble: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#F4C966', transform: [{ rotate: '-5deg' }] },
  heroEmoji: { fontSize: 32 },
  heroCopy: { flex: 1 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1, color: '#9A6414' },
  pageTitle: { fontSize: 23, lineHeight: 28, fontWeight: '900', color: '#633E12', marginTop: 2 },
  heroText: { fontSize: 13, lineHeight: 19, color: '#745A3D', marginTop: spacing(0.5) },
  roundPanel: { backgroundColor: colors.surface, borderRadius: 22, padding: spacing(2), marginTop: spacing(2), borderWidth: 1.5, borderColor: '#EEDFCB' },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', color: '#513A27' },
  sectionHint: { fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: 2 },
  card: { padding: spacing(2), borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, shadowColor: '#4A3728', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  cardSelect: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.75) },
  // Indented to line up with the title (icon 56 + gap 14).
  startButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: spacing(1.5), marginLeft: 70, borderRadius: 14, borderWidth: 2, paddingHorizontal: spacing(1.5), paddingVertical: spacing(1) },
  startDisabled: { opacity: 0.45 },
  startText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  selected: { borderColor: colors.primary, backgroundColor: colors.happySoft, shadowOpacity: 0.13 },
  categoryIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  categoryEmoji: { fontSize: 28 },
  selectedBadge: { position: 'absolute', right: -5, bottom: -4, width: 23, height: 23, borderRadius: 12, backgroundColor: colors.go, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  selectedCheck: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 17 },
  cardContent: { flex: 1 },
  observationPill: { alignSelf: 'flex-start', marginTop: spacing(1.25), backgroundColor: '#F3EEE7', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.65) },
  observedPill: { backgroundColor: colors.goSoft }, observedText: { color: colors.accent },
  lengths: { flexDirection: 'row', gap: spacing(1), marginTop: spacing(1.5) },
  length: { flex: 1, minHeight: 104, paddingVertical: spacing(1.25), paddingHorizontal: spacing(0.5), borderWidth: 2, borderColor: '#EADFD0', backgroundColor: '#FFF9F0', borderRadius: 18, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  lengthSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft, transform: [{ translateY: -2 }], shadowColor: colors.primary, shadowOpacity: 0.16, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  lengthIcon: { fontSize: 25 },
  lengthTitle: { color: '#6D5A49', fontSize: 14, lineHeight: 18, fontWeight: '800', marginTop: 2 },
  lengthTitleSelected: { color: colors.primary },
  lengthSubtitle: { color: colors.inkSoft, fontSize: 11, lineHeight: 15 },
  roundCheck: { position: 'absolute', right: 6, top: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.go, alignItems: 'center', justifyContent: 'center' },
  roundCheckText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  infoCallout: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1), backgroundColor: '#EDF7FF', borderRadius: 14, padding: spacing(1.5), marginTop: spacing(1.5) },
  infoIcon: { fontSize: 18 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#526678' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  categoryHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing(2.5), paddingHorizontal: spacing(0.5) },
  categoryHeadingEmoji: { fontSize: 30 },
  error: { color: colors.danger, marginBottom: spacing(2) },
  groups: { gap: spacing(1.5), marginTop: spacing(1.5), marginBottom: spacing(2.5) },
  group: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.surface, shadowColor: '#4A3728', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(1.5), paddingHorizontal: spacing(1.5), borderWidth: 2, borderRadius: 22 },
  groupIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: spacing(1.25) },
  groupEmoji: { fontSize: 25 },
  groupHeaderCopy: { flex: 1, minWidth: 0 },
  groupTitle: { fontSize: 17, lineHeight: 21, fontWeight: '800', color: colors.ink },
  groupCount: { fontSize: 12, lineHeight: 16, color: '#6F655D', marginTop: 2, fontWeight: '600' },
  groupItems: { gap: spacing(1.5), padding: spacing(2) },
  categoryTitle: { fontSize: 17, lineHeight: 22, fontWeight: '700', color: colors.ink },
  chevronBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: spacing(1) },
  chevron: { color: '#FFFFFF', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  retryCard: { backgroundColor: '#FFF0EE', borderWidth: 2, borderColor: '#F2A28E', borderRadius: 20, padding: spacing(1.5), marginBottom: spacing(1.5), gap: spacing(1.5) },
  retryHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.25) },
  retryIconBubble: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  retryIcon: { fontSize: 24 },
  retryCopy: { flex: 1 },
  retryTitle: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: '#9C402F' },
  retryText: { fontSize: 12, lineHeight: 18, color: '#855A51', marginTop: 2 },
  actions: { gap: spacing(1.5) },
});
