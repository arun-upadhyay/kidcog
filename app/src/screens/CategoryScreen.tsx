import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { CATEGORY_GROUPS } from '../categoryGroups';
import Button from '../components/Button';
import { fetchCategories } from '../api';
import { colors, spacing, type } from '../theme';
import type { TraitKey, TraitMetaPublic, Report } from '../types';

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
      <View style={{ gap: spacing(1.5), marginVertical: spacing(3) }}>
        {CATEGORY_GROUPS.map(group => <View key={group.key} style={{ gap: spacing(1.5) }}>
        <Text style={[type.title, { marginTop: spacing(2) }]}>{group.label}</Text>
        {categories.filter(c => (c.group ?? 'intellectual') === group.key).map(category => {
          const result = report?.traits.find(t => t.key === category.key);
          return <Pressable key={category.key} accessibilityRole="radio" accessibilityState={{ checked: selected === category.key, disabled: busy }} disabled={busy} onPress={() => setSelected(category.key)} style={[styles.card, selected === category.key && styles.selected]}>
            <Text style={type.heading}>{selected === category.key ? '● ' : '○ '}{category.label}</Text>
            <Text style={[type.soft, { marginTop: spacing(0.75) }]}>{category.blurb}</Text>
            <Text style={[type.label, { marginTop: spacing(1) }]}>{result && result.questionCount > 0 ? `${result.questionCount} observations so far` : 'Not yet observed'}</Text>
          </Pressable>;
        })}</View>)}
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
  card: { padding: spacing(2), borderRadius: 16, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface },
  selected: { borderColor: colors.primary, backgroundColor: colors.happySoft },
  lengths: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1), marginVertical: spacing(1.5) },
  length: { padding: spacing(1.5), borderWidth: 2, borderColor: colors.line, borderRadius: 14 },
  error: { color: colors.danger, marginBottom: spacing(2) },
});
