import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { CATEGORY_GROUPS } from '../categoryGroups';
import Button from '../components/Button';
import { fetchCategories } from '../api';
import { colors, spacing, type } from '../theme';
import type { TraitKey, TraitMetaPublic, Report } from '../types';

const CATEGORY_VISUALS: Record<TraitKey, { icon: string; background: string; border: string }> = {
  abstract_concepts: { icon: '💭', background: '#EEE8FF', border: '#9B7EDE' },
  beyond_experience: { icon: '🌎', background: '#E5F3FF', border: '#65A7D8' },
  generalization: { icon: '🧩', background: '#FFF0D9', border: '#E5A13A' },
  cause_effect: { icon: '🔍', background: '#E2F5EC', border: '#55A77E' },
  challenge_seeking: { icon: '🏔️', background: '#FFE8E1', border: '#E87A5A' },
  curiosity: { icon: '🔭', background: '#E6F1FF', border: '#5A91D6' },
  original_methods: { icon: '🎨', background: '#FCE7F1', border: '#D878A4' },
  observant: { icon: '👀', background: '#FFF3CE', border: '#DDAE35' },
  perfectionism: { icon: '🌱', background: '#E5F4E7', border: '#6EAA72' },
  strong_ideas: { icon: '💬', background: '#EEE8FF', border: '#9278D0' },
  questions_authority: { icon: '⚖️', background: '#E4F2F5', border: '#579BA9' },
  motivation_focus: { icon: '🎯', background: '#FFE8E3', border: '#DF735B' },
  humor: { icon: '😄', background: '#FFF1C9', border: '#E0AA2F' },
  sensitivity_others: { icon: '💛', background: '#FDE6E8', border: '#D87882' },
};

export default function CategoryScreen({ onSelect, onReport, onBack, report, busy, error }: {
  onSelect: (trait: TraitKey, count: number) => void;
  onReport: () => void;
  onBack: () => void;
  report: Report | null;
  busy: boolean;
  error: string | null;
}) {
  const [categories, setCategories] = useState<TraitMetaPublic[]>([]);
  const [selected, setSelected] = useState<TraitKey>('abstract_concepts');
  const [count, setCount] = useState(2);
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={type.label}>FOR THE GROWN-UP</Text>
      <Text style={[type.title, { marginVertical: spacing(1) }]}>Choose what to explore</Text>
      <Text style={type.soft}>Pick one category for a short round. You can add another category afterwards and see all results together.</Text>
      <Text style={[type.heading, { marginTop: spacing(3) }]}>Questions per round</Text>
      <View style={styles.lengths}>
        {[2, 5, 6].map(n => <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: count === n, disabled: busy }} disabled={busy} onPress={() => setCount(n)} style={[styles.length, count === n && styles.selected]}>
          <Text style={type.body}>{n} questions{n === 2 ? ' · quick start' : ''}</Text>
        </Pressable>)}
      </View>
      <Text style={type.soft}>AI will create exactly this many fresh questions for the selected category and age. Rounds mix picture choices, tap-to-answer questions, and spoken ideas. AI also reviews them for your child’s age; this may take a moment. Two questions offer only a first glimpse.</Text>
      <View style={styles.groups}>
        {CATEGORY_GROUPS.map(group => {
          const groupCategories = categories.filter(c => (c.group ?? 'intellectual') === group.key);
          const observed = groupCategories.filter(category => (report?.traits.find(t => t.key === category.key)?.questionCount ?? 0) > 0).length;
          const expanded = expandedGroups.has(group.key);
          return <View key={group.key} style={styles.group}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={`${group.label}, ${observed} of ${groupCategories.length} observed`}
            onPress={() => toggleGroup(group.key)}
            style={({ pressed }) => [styles.groupHeader, pressed && { opacity: 0.75 }]}
          >
            <View style={{ flex: 1 }}><Text style={type.title}>{group.label}</Text><Text style={type.soft}>{observed} of {groupCategories.length} observed</Text></View>
            <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
          </Pressable>
          {expanded ? <View style={styles.groupItems}>{groupCategories.map(category => {
          const result = report?.traits.find(t => t.key === category.key);
          const visual = CATEGORY_VISUALS[category.key];
          const isSelected = selected === category.key;
          return <Pressable key={category.key} accessibilityRole="radio" accessibilityState={{ checked: selected === category.key, disabled: busy }} disabled={busy} onPress={() => setSelected(category.key)} style={[styles.card, selected === category.key && styles.selected]}>
            <View style={[styles.categoryIcon, { backgroundColor: visual.background, borderColor: visual.border }]}>
              <Text style={styles.categoryEmoji}>{visual.icon}</Text>
              {isSelected ? <View style={styles.selectedBadge}><Text style={styles.selectedCheck}>✓</Text></View> : null}
            </View>
            <View style={styles.cardContent}>
              <Text style={type.heading}>{category.label}</Text>
              <Text style={[type.soft, { marginTop: spacing(0.75) }]}>{category.blurb}</Text>
              <View style={[styles.observationPill, result && result.questionCount > 0 ? styles.observedPill : null]}><Text style={[type.label, result && result.questionCount > 0 ? styles.observedText : null]}>{result && result.questionCount > 0 ? `${result.questionCount} observations so far` : 'Not yet observed'}</Text></View>
            </View>
          </Pressable>;
          })}</View> : null}
        </View>;})}
      </View>
      {loadError ? <><Text style={styles.error}>{loadError}</Text><Button title="Retry loading categories" onPress={() => setAttempt(v => v + 1)} /></> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ gap: spacing(1.5) }}>
        <Button title={busy ? 'Getting questions…' : 'Start this category'} onPress={() => onSelect(selected, count)} loading={busy} disabled={busy || categories.length === 0} />
        {report ? <Button title="View combined results" variant="secondary" onPress={onReport} disabled={busy} /> : <Button title="Back to child details" variant="secondary" onPress={onBack} disabled={busy} />}
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6), width: '100%', maxWidth: 850, alignSelf: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.75), padding: spacing(2), borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface, shadowColor: '#4A3728', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  selected: { borderColor: colors.primary, backgroundColor: colors.happySoft, shadowOpacity: 0.13 },
  categoryIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  categoryEmoji: { fontSize: 28 },
  selectedBadge: { position: 'absolute', right: -5, bottom: -4, width: 23, height: 23, borderRadius: 12, backgroundColor: colors.go, borderWidth: 2, borderColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  selectedCheck: { color: '#fff', fontSize: 14, fontWeight: '900', lineHeight: 17 },
  cardContent: { flex: 1 },
  observationPill: { alignSelf: 'flex-start', marginTop: spacing(1.25), backgroundColor: '#F3EEE7', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.65) },
  observedPill: { backgroundColor: colors.goSoft }, observedText: { color: colors.accent },
  lengths: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginVertical: spacing(1.5) },
  length: { padding: spacing(1.5), borderWidth: 2, borderColor: colors.line, borderRadius: 14 },
  error: { color: colors.danger, marginBottom: spacing(2) },
  groups: { gap: spacing(2), marginVertical: spacing(3) },
  group: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing(2.5), backgroundColor: colors.coolSoft },
  groupItems: { gap: spacing(1.5), padding: spacing(2) },
  chevron: { color: colors.accent, fontSize: 28, fontWeight: '700', marginLeft: spacing(2) },
});
