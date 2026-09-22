import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, type TextStyle } from 'react-native';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import type { ParentReport as ParentReportType, Report, ScoredResponse } from '../types';

export interface ResultsScreenProps {
  report: Report;
  childName?: string | undefined;
  onRestart: () => void;
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

function ParentReportCard({ report }: { report: ParentReportType }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={type.label}>WHAT THIS SESSION SHOWED</Text>

      {report.opening ? (
        <Text style={[type.body, { marginTop: spacing(1.5) }]}>{report.opening}</Text>
      ) : null}

      <ReportSection title="What went well" items={report.strengths} />
      <ReportSection title="Where things got harder" items={report.stuckPoints} />

      {report.thinkingNotes ? (
        <View style={{ marginTop: spacing(2.5) }}>
          <Text style={styles.sectionTitle}>How they approached it</Text>
          <Text style={[type.body, { marginTop: spacing(0.5) }]}>{report.thinkingNotes}</Text>
        </View>
      ) : null}

      <ReportSection title="Things to try at home" items={report.practiceIdeas} />

      {report.closing ? (
        <Text style={[type.soft, styles.closing]}>{report.closing}</Text>
      ) : null}
    </View>
  );
}

function chipStyle(r: ScoredResponse): TextStyle {
  if (r.ungraded) return styles.chipWarn;
  if (r.possible > 0 && r.earned === r.possible) return styles.chipGood;
  if (r.earned === 0) return styles.chipLow;
  return styles.chipMid;
}

export default function ResultsScreen({ report, childName, onRestart }: ResultsScreenProps) {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={type.label}>SESSION RESULT</Text>
      <Text style={[type.title, { marginTop: spacing(1) }]}>
        {childName ? `${childName}'s session` : 'Session summary'}
      </Text>

      <View style={styles.overall}>
        <Text style={styles.overallNumber}>{report.overall.percent}%</Text>
        <Text style={type.soft}>
          {report.overall.earned} of {report.overall.possible} points across {report.domains.length}{' '}
          areas
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

      <Text style={[type.heading, { marginTop: spacing(4) }]}>By area</Text>
      <View style={{ gap: spacing(2), marginTop: spacing(2) }}>
        {report.domains.map((d) => (
          <View key={d.key} style={styles.domainCard}>
            <View style={styles.domainHeader}>
              <Text style={styles.domainLabel}>{d.label}</Text>
              <Text style={styles.domainPct}>{d.percent}%</Text>
            </View>
            <Bar percent={d.percent} />
            <Text style={[type.soft, { marginTop: spacing(1) }]}>{d.band}</Text>
            <Text style={[type.soft, { marginTop: spacing(0.5), fontSize: 13 }]}>{d.blurb}</Text>
          </View>
        ))}
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
                {r.ungraded ? 'not graded' : `${r.earned} / ${r.possible} points`}
              </Text>
              {r.note ? <Text style={[type.soft, { marginTop: spacing(1) }]}>{r.note}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <View style={styles.disclaimer}>
        <Text style={[type.soft, { fontSize: 13 }]}>{report.disclaimer}</Text>
      </View>

      <View style={{ marginTop: spacing(3) }}>
        <Button title="Start a new session" variant="secondary" onPress={onRestart} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6) },
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
  domainHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing(1) },
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
