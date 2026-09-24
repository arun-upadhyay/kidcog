import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, type TextStyle } from 'react-native';
import { CATEGORY_GROUPS } from '../categoryGroups';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import { speak, stopSpeaking, useSpeechState, lastSpeechError } from '../speech';
import type { ParentReport as ParentReportType, Report, ScoredResponse, TraitReport } from '../types';

export interface ResultsScreenProps {
  report: Report;
  childName?: string | undefined;
  onRestart: () => void;
  onChooseCategory: () => void;
  /** Generate another round for the same child; earlier questions may repeat. */
  onReassess: () => void;
  /** How many unseen questions are left for this child's age after this round. */
  remainingUnseen: number;
  busy: boolean;
  error: string | null;
  historical?: boolean;
  completedAt?: string;
  onBackToHistory?: () => void;
}

function Bar({ percent }: { percent: number }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(2, percent)}%` }]} />
    </View>
  );
}

/** One titled group of sentences inside the written report. */
function ReportSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: spacing(2.5) }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((text, i) => (
        <View key={i} style={styles.sectionRow}>
          <View style={styles.dot} />
          <Text style={[type.body, { flex: 1 }]}>{text}</Text>
        </View>
      ))}
    </View>
  );
}

/** The whole report as one passage, for reading aloud. */
function reportAsSpeech(r: ParentReportType): string {
  return [
    r.opening,
    r.strengths.length ? `You figured it out. ${r.strengths.join(' ')}` : '',
    r.stuckPoints.length ? `Let’s try this together. ${r.stuckPoints.join(' ')}` : '',
    r.thinkingNotes ? `Your thinking. ${r.thinkingNotes}` : '',
    r.practiceIdeas.length ? `Try a little game. ${r.practiceIdeas.join(' ')}` : '',
    r.closing,
  ]
    .filter((part) => part.trim().length > 0)
    .join(' ');
}

function ParentReportCard({ report }: { report: ParentReportType }) {
  const speechState = useSpeechState();
  const speechBusy = speechState !== 'idle';
  useEffect(() => () => stopSpeaking(), []);
  return (
    <View style={styles.summaryCard}>
      <View style={styles.cardHeader}>
        <Text style={type.label}>A LITTLE CHEER FOR YOU</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Read this report aloud"
          disabled={speechBusy}
          accessibilityState={{ disabled: speechBusy, busy: speechBusy }}
          onPress={() => void speak(reportAsSpeech(report), { voice: 'generated', allowDeviceFallback: false })}
          style={({ pressed }) => [styles.listen, (pressed || speechBusy) && { opacity: 0.5 }]}
        >
          <Text style={styles.listenText}>{speechState === 'loading' ? 'Loading…' : speechBusy ? 'Reading…' : '🔊 Listen'}</Text>
        </Pressable>
      </View>

      <Text style={[type.soft, { marginTop: spacing(1), fontSize: 12 }]}>Listen uses an AI-generated voice. Audio plays only when you tap.</Text>

      {!speechBusy && lastSpeechError ? <Text style={[type.soft, { color: colors.warn }]}>Audio couldn’t load. Tap Listen to try again.</Text> : null}
      {report.opening ? (
        <Text style={[type.body, { marginTop: spacing(1.5) }]}>{report.opening}</Text>
      ) : null}

      <ReportSection title="🌟 You figured it out" items={report.strengths} />
      <ReportSection title="🧩 Let’s try this together" items={report.stuckPoints} />

      {report.thinkingNotes ? (
        <View style={{ marginTop: spacing(2.5) }}>
          <Text style={styles.sectionTitle}>💡 Your thinking</Text>
          <Text style={[type.body, { marginTop: spacing(0.5) }]}>{report.thinkingNotes}</Text>
        </View>
      ) : null}

      <ReportSection title="🎲 Try a little game" items={report.practiceIdeas} />

      {report.closing ? (
        <Text style={[type.soft, styles.closing]}>{report.closing}</Text>
      ) : null}
    </View>
  );
}

/**
 * One row of the rating scale.
 *
 * A trait with no evidence shows "not seen", never a zero. A parent reading 0
 * beside "demonstrates great curiosity" would take it as a judgement about
 * their child rather than as missing data, and would carry that into the form.
 */
function TraitCard({ trait }: { trait: TraitReport }) {
  const seen = trait.questionCount > 0;

  return (
    <View style={styles.domainCard}>
      <View style={styles.domainHeader}>
        <Text style={[styles.domainLabel, { flex: 1 }]}>{trait.label}</Text>
        {trait.formScale ? (
          <View style={styles.scalePill}>
            <Text style={styles.scaleValue}>{trait.formScale.value}/5</Text>
            <Text style={styles.scaleLabel}>{trait.formScale.label}</Text>
          </View>
        ) : (
          <Text style={styles.notSeen}>{seen ? 'observed' : 'not yet observed'}</Text>
        )}
      </View>

      {seen && trait.formScale ? <><Bar percent={trait.percent} /><Text style={[type.soft, { marginTop: spacing(1) }]}>{trait.earned} / {trait.possible} points · {trait.percent}% · {trait.questionCount} answered questions</Text></> : null}

      <Text style={[type.soft, { marginTop: spacing(1) }]}>{trait.band}</Text>
      <Text style={[type.soft, { marginTop: spacing(0.5), fontSize: 13 }]}>{trait.blurb}</Text>
      <Text style={[type.soft, { marginTop: spacing(0.75), fontSize: 12, fontStyle: 'italic' }]}>
        {trait.evidence}
        {trait.measurable === 'behaviour'
          ? ' Based on answers about challenge situations, not an observation of everyday behaviour.'
          : trait.measurable === 'inferred'
            ? ' Based on the ideas and explanations offered in this activity.'
            : ''}
      </Text>
    </View>
  );
}

function chipStyle(r: ScoredResponse): TextStyle {
  if (r.skipped || r.ungraded) return styles.chipWarn;
  if (r.possible > 0 && r.earned === r.possible) return styles.chipGood;
  if (r.earned === 0) return styles.chipLow;
  return styles.chipMid;
}

export default function ResultsScreen({
  report,
  childName,
  onRestart,
  onChooseCategory,
  onReassess,
  remainingUnseen,
  busy,
  error,
  historical = false,
  completedAt,
  onBackToHistory,
}: ResultsScreenProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setExpandedGroups(current => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {historical && onBackToHistory ? <Pressable onPress={onBackToHistory} accessibilityRole="button"><Text style={styles.historyBack}>← Previous assessments</Text></Pressable> : null}
      <Text style={type.label}>{historical ? 'SAVED ASSESSMENT RESULT' : 'COMBINED SESSION RESULT'}</Text>
      <Text style={[type.title, { marginTop: spacing(1) }]}>
        {childName ? `${childName}'s session` : 'Session summary'}
      </Text>
      {completedAt ? <Text style={[type.soft, { marginTop: spacing(0.5) }]}>{new Date(completedAt).toLocaleString()}</Text> : null}

      <View style={styles.overall}>
        <Text style={styles.overallNumber}>{report.overall.possible > 0 ? `${report.overall.percent}%` : 'Not scored'}</Text>
        <Text style={type.soft}>
          {report.overall.earned} of {report.overall.possible} points on the scored questions
        </Text>
      </View>

      {report.parentReport ? (
        <ParentReportCard report={report.parentReport} />
      ) : report.parentReportError ? (
        <View style={styles.warnCard}>
          <Text style={[type.body, { color: colors.warn }]}>
            The written report couldn&apos;t be generated this time. The scores below are
            unaffected.
          </Text>
        </View>
      ) : null}

      <Text style={[type.heading, { marginTop: spacing(4) }]}>Category results</Text>
      <Text style={[type.soft, { marginTop: spacing(0.5) }]}>
        All categories appear below. Results combine the rounds completed in this session.
        The 1–5 indicators describe evidence in these activities, not a ranking against other children
        or an official school rating. Unobserved categories have no score. Speed, enjoyment, and
        everyday behaviour need observations over time.
      </Text>
      <View style={styles.groupList}>
        {CATEGORY_GROUPS.map(group => {
          const groupTraits = report.traits.filter(t => (t.group ?? 'intellectual') === group.key);
          const observed = groupTraits.filter(t => t.questionCount > 0).length;
          const expanded = expandedGroups.has(group.key);
          return <View key={group.key} style={styles.groupCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${group.label}, ${observed} of ${groupTraits.length} observed`}
              onPress={() => toggleGroup(group.key)}
              style={({ pressed }) => [styles.groupHeader, pressed && { opacity: 0.75 }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={type.heading}>{group.label}</Text>
                <Text style={[type.soft, { marginTop: spacing(0.25) }]}>{observed} of {groupTraits.length} observed</Text>
              </View>
              <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
            </Pressable>
            {expanded ? <View style={styles.groupItems}>{groupTraits.map(t => <TraitCard key={t.key} trait={t} />)}</View> : null}
          </View>;
        })}
      </View>

      {report.graderFailed ? (
        <View style={styles.warnCard}>
          <Text style={[type.body, { color: colors.warn }]}>
            The written answers could not be graded automatically, so they are left out of the
            totals above. They are worth reading through by hand.
          </Text>
        </View>
      ) : null}

      <Pressable onPress={() => setShowDetail((v) => !v)} style={styles.toggle}>
        <Text style={styles.toggleText}>
          {showDetail ? 'Hide question-by-question' : 'Show question-by-question'}
        </Text>
      </Pressable>

      {showDetail && (
        <View style={{ gap: spacing(2) }}>
          {report.responses.map((r) => (
            <View key={r.questionId} style={styles.responseCard}>
              <Text style={type.label}>{r.questionId.toUpperCase()}</Text>
              <Text style={[type.body, { marginTop: spacing(0.5), fontWeight: '600' }]}>
                {r.prompt}
              </Text>
              <Text style={[type.soft, { marginTop: spacing(1) }]}>
                Answer: {r.answer.trim() ? r.answer : '(left blank)'}
              </Text>
              <Text style={[styles.scoreChip, chipStyle(r)]}>
                {r.skipped
                  ? 'skipped — not scored'
                  : r.ungraded
                    ? 'not graded'
                    : `${r.earned} / ${r.possible} points`}
              </Text>
              {r.note ? <Text style={[type.soft, { marginTop: spacing(1) }]}>{r.note}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {!historical && <View style={styles.reassessCard}>
        <Text style={type.heading}>Explore another category</Text>
        <Text style={[type.soft, { marginVertical: spacing(1) }]}>{report.traits.filter(t => t.questionCount > 0).length} of {report.traits.length} categories have observations so far. Your completed answers stay in this session.</Text>
        <Button title="Choose the next category" onPress={onChooseCategory} disabled={busy} />
        <Text style={[type.soft, { marginTop: spacing(1) }]}>
          AI generates a fresh round each time. Your completed rounds, answers, and report are saved privately to your parent account.
        </Text>
        {error ? (
          <Text style={[type.body, { color: colors.warn, marginTop: spacing(1.5) }]}>{error}</Text>
        ) : null}
        <View style={{ gap: spacing(1.5), marginTop: spacing(2) }}>
          <Button
            title="Ask different questions"
            onPress={onReassess}
            loading={busy}
            disabled={remainingUnseen === 0}
          />

        </View>
      </View>}

      <View style={styles.disclaimer}>
        <Text style={[type.soft, { fontSize: 13 }]}>{report.disclaimer}</Text>
      </View>

      <View style={{ marginTop: spacing(3) }}><Button title={historical ? 'Back to previous assessments' : 'Start a new session'} variant="secondary" onPress={historical && onBackToHistory ? onBackToHistory : onRestart} disabled={busy} /></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6) },
  historyBack: { color: colors.primary, fontWeight: '700', marginBottom: spacing(3) },
  groupList: { gap: spacing(2), marginTop: spacing(2) },
  groupCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing(2.5), backgroundColor: colors.coolSoft },
  groupItems: { gap: spacing(2), padding: spacing(2) },
  chevron: { color: colors.accent, fontSize: 28, fontWeight: '700', marginLeft: spacing(2) },
  reassessCard: {
    marginTop: spacing(4),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: spacing(2.5),
  },
  overall: {
    marginTop: spacing(3),
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    padding: spacing(3),
    alignItems: 'center',
  },
  overallNumber: { fontSize: 52, fontWeight: '800', color: colors.accent },
  summaryCard: {
    marginTop: spacing(3),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: spacing(2.5),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(1.5),
  },
  listen: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing(0.75),
    paddingHorizontal: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.cool,
    backgroundColor: colors.coolSoft,
  },
  listenText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
    marginBottom: spacing(1),
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(1.5),
    marginBottom: spacing(1.25),
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    marginTop: 9,
  },
  closing: {
    marginTop: spacing(2.5),
    paddingTop: spacing(2),
    borderTopWidth: 1,
    borderTopColor: colors.line,
    fontStyle: 'italic',
  },
  domainCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: spacing(2),
  },
  domainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing(1),
    marginBottom: spacing(1),
  },
  scalePill: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.5),
    minWidth: 62,
  },
  scaleValue: { fontSize: 20, fontWeight: '800', color: colors.accent, lineHeight: 24 },
  scaleLabel: { fontSize: 10, fontWeight: '700', color: colors.accent },
  notSeen: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSoft,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingHorizontal: spacing(1.25),
    paddingVertical: spacing(0.75),
    overflow: 'hidden',
  },
  domainLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  domainPct: { fontSize: 16, fontWeight: '700', color: colors.accent },
  barTrack: { height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  warnCard: {
    marginTop: spacing(3),
    backgroundColor: '#FEF3E2',
    borderRadius: 14,
    padding: spacing(2),
  },
  toggle: { marginTop: spacing(4), marginBottom: spacing(2) },
  toggleText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  responseCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: spacing(2),
  },
  scoreChip: {
    alignSelf: 'flex-start',
    marginTop: spacing(1.5),
    paddingHorizontal: spacing(1.5),
    paddingVertical: spacing(0.5),
    borderRadius: 999,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
  chipGood: { backgroundColor: colors.accentSoft, color: colors.accent },
  chipMid: { backgroundColor: '#FEF3E2', color: colors.warn },
  chipLow: { backgroundColor: '#FBE9E7', color: colors.danger },
  chipWarn: { backgroundColor: '#EEEEEE', color: colors.inkSoft },
  disclaimer: {
    marginTop: spacing(4),
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing(2),
  },
});
