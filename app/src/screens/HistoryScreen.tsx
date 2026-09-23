import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { deleteAssessmentSession, fetchHistoricalAssessment, listAssessmentSessions } from '../api';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import type { AssessmentSessionSummary, HistoricalAssessment, SavedChildProfile } from '../types';

type Props = {
  child: SavedChildProfile;
  onBack: () => void;
  onOpen: (assessment: HistoricalAssessment) => void;
};

function displayDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function HistoryScreen({ child, onBack, onOpen }: Props) {
  const [sessions, setSessions] = useState<AssessmentSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (offset = 0) => {
    offset ? setLoadingMore(true) : setLoading(true); setError(null);
    try {
      const result = await listAssessmentSessions(child.id, offset);
      setSessions(current => offset ? [...current, ...result.sessions] : result.sessions);
      setHasMore(result.hasMore);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load assessment history.'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [child.id]);

  useEffect(() => { void load(); }, [load]);

  async function open(sessionId: string) {
    setOpening(sessionId); setError(null);
    try { onOpen(await fetchHistoricalAssessment(sessionId)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load this report.'); }
    finally { setOpening(null); }
  }

  async function remove(sessionId: string) {
    setDeleting(sessionId); setError(null);
    try {
      await deleteAssessmentSession(sessionId);
      setSessions(current => current.filter(session => session.id !== sessionId));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete this result.'); }
    finally { setDeleting(null); }
  }

  function confirmDelete(session: AssessmentSessionSummary) {
    const message = `Delete the assessment from ${displayDate(session.completedAt)}? Its questions, answers, and category results will be permanently removed.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void remove(session.id);
      return;
    }
    Alert.alert('Delete this result?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove(session.id) },
    ]);
  }

  return <ScrollView contentContainerStyle={styles.container}>
    <Pressable onPress={onBack} accessibilityRole="button"><Text style={styles.back}>← Back</Text></Pressable>
    <Text style={type.label}>PREVIOUS ASSESSMENTS</Text>
    <Text style={[type.title, styles.title]}>{child.nickname}</Text>
    <Text style={type.soft}>Completed sessions are saved privately to your parent account.</Text>

    {loading ? <ActivityIndicator style={styles.loading} color={colors.primary} /> : null}
    {!loading && sessions.length === 0 ? <View style={styles.empty}><Text style={type.heading}>No previous results yet</Text><Text style={[type.soft, styles.emptyText]}>Complete an assessment and its report will appear here.</Text></View> : null}
    <View style={styles.list}>{sessions.map(session => <View key={session.id} style={styles.card}>
      <Text style={styles.date}>{displayDate(session.completedAt)}</Text>
      <Text style={[type.soft, styles.meta]}>{session.age ? `Age ${session.age} · ` : ''}{session.questionCount} answered question{session.questionCount === 1 ? '' : 's'}</Text>
      <Text style={[type.body, styles.categories]}>{session.categories.length ? session.categories.join(' · ') : 'Assessment session'}</Text>
      <Text style={styles.score}>{session.overall.possible > 0 ? `${session.overall.percent}%` : 'Not scored'}</Text>
      <View style={styles.cardActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`View result from ${displayDate(session.completedAt)}`} disabled={opening !== null} onPress={() => void open(session.id)} style={({ pressed }) => [styles.iconButton, styles.viewButton, (pressed || opening !== null) && styles.iconPressed]}><Text style={styles.actionIcon}>{opening === session.id ? '⏳' : '📖'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete result from ${displayDate(session.completedAt)}`} disabled={deleting !== null} onPress={() => confirmDelete(session)} style={({ pressed }) => [styles.iconButton, styles.deleteButton, (pressed || deleting !== null) && styles.iconPressed]}><Text style={styles.actionIcon}>{deleting === session.id ? '⏳' : '🗑️'}</Text></Pressable>
      </View>
    </View>)}</View>

    {error ? <Text style={styles.error}>{error}</Text> : null}
    {hasMore ? <View style={styles.more}><Button title="Load more" onPress={() => void load(sessions.length)} loading={loadingMore} variant="secondary" /></View> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6) },
  back: { color: colors.primary, fontWeight: '700', marginBottom: spacing(3) },
  title: { marginTop: spacing(1), marginBottom: spacing(0.5) },
  loading: { marginTop: spacing(5) },
  list: { gap: spacing(2), marginTop: spacing(3) },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: spacing(2.5) },
  date: { fontSize: 16, fontWeight: '700', color: colors.ink },
  meta: { marginTop: spacing(0.5) }, categories: { marginVertical: spacing(1.5) },
  score: { fontSize: 32, fontWeight: '800', color: colors.accent, marginBottom: spacing(2) },
  empty: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing(3), marginTop: spacing(3), alignItems: 'center' },
  emptyText: { marginTop: spacing(1), textAlign: 'center' },
  error: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(2), borderRadius: 12, marginTop: spacing(2) },
  more: { marginTop: spacing(2) },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing(1) },
  iconButton: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  viewButton: { backgroundColor: colors.goSoft }, deleteButton: { backgroundColor: '#FBE9E7' },
  actionIcon: { fontSize: 28 }, iconPressed: { opacity: 0.5, transform: [{ scale: 0.96 }] },
});
