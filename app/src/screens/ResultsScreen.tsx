import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, type TextStyle } from 'react-native';
import { CATEGORY_GROUPS } from '../categoryGroups';
import { CATEGORY_VISUALS, GROUP_VISUALS } from '../categoryVisuals';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import { speak, stopSpeaking, useSpeechState, lastSpeechError } from '../speech';
import type { ParentReport as ParentReportType, Report, ScoredResponse, TraitKey, TraitReport } from '../types';

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
  /**
   * Start a new round in one category straight from its result card, without
   * going back through the category screen. Absent for saved results from the
   * history, which are read-only.
   */
  onTryCategory?: (trait: TraitKey, count: number) => void;
  /** Length of the round just finished; the default for a round started here. */
  roundLength?: number;
}

function Bar({ percent, color }: { percent: number; color: string }) {
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(2, percent)}%`, backgroundColor: color }]} />
    </View>
  );
}

/** One titled group of sentences inside the written report. */
function ReportSection({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginTop: spacing(2.5) }}>
      <Text style={styles.reportHeading}>{title}</Text>
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
        <View style={styles.titleRow}>
          <View style={[styles.iconBubble, { borderColor: '#F4C966' }]}><Text style={styles.iconEmoji}>🎉</Text></View>
          <Text style={styles.sectionTitle}>A little cheer for you</Text>
        </View>
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

      <Text style={[styles.smallNote, { marginTop: spacing(1.25) }]}>Listen uses an AI-generated voice. Audio plays only when you tap.</Text>

      {!speechBusy && lastSpeechError ? <Text style={[type.soft, { color: colors.warn }]}>Audio couldn’t load. Tap Listen to try again.</Text> : null}
      {report.opening ? (
        <Text style={[type.body, { marginTop: spacing(1.5) }]}>{report.opening}</Text>
      ) : null}

      <ReportSection title="🌟 You figured it out" items={report.strengths} />
      <ReportSection title="🧩 Let’s try this together" items={report.stuckPoints} />

      {report.thinkingNotes ? (
        <View style={{ marginTop: spacing(2.5) }}>
          <Text style={styles.reportHeading}>💡 Your thinking</Text>
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
interface TryAction {
  onPress: () => void;
  /** This card's round is being generated. */
  pending: boolean;
  /** Any round is being generated, so every start button waits. */
  busy: boolean;
  /** Why this card's round failed to start, if it did. */
  error: string | null;
  count: number;
}

function TraitCard({ trait, tryAction }: { trait: TraitReport; tryAction?: TryAction }) {
  const seen = trait.questionCount > 0;
  const visual = CATEGORY_VISUALS[trait.key] ?? { icon: '⭐', background: colors.happySoft, border: colors.happy };

  return (
    <View style={[styles.traitCard, seen && { borderColor: visual.border }]}>
      <View style={[styles.traitIcon, { backgroundColor: visual.background, borderColor: visual.border }]}>
        <Text style={styles.traitEmoji}>{visual.icon}</Text>
      </View>
      <View style={styles.traitBody}>
        <View style={styles.domainHeader}>
          <Text style={[styles.domainLabel, { flex: 1 }]}>{trait.label}</Text>
          {trait.formScale ? (
            <View style={[styles.scalePill, { backgroundColor: visual.background, borderColor: visual.border }]}>
              <Text style={styles.scaleValue}>{trait.formScale.value}/5</Text>
              <Text style={styles.scaleLabel}>{trait.formScale.label}</Text>
            </View>
          ) : null}
        </View>

        {seen && trait.formScale ? (
          <>
            <Bar percent={trait.percent} color={visual.border} />
            <Text style={[styles.traitMeta, { marginTop: spacing(1) }]}>
              {trait.earned} / {trait.possible} points · {trait.percent}% · {trait.questionCount} answered questions
            </Text>
          </>
        ) : null}

        <View style={[styles.statusPill, seen ? styles.statusSeen : null]}>
          <Text style={[styles.statusText, seen ? styles.statusSeenText : null]}>{seen ? trait.band : 'Not yet observed'}</Text>
        </View>
        <Text style={[type.soft, { marginTop: spacing(1), fontSize: 13 }]}>{trait.blurb}</Text>
        <Text style={[styles.smallNote, { marginTop: spacing(0.75), fontStyle: 'italic' }]}>
          {trait.evidence}
          {trait.measurable === 'behaviour'
            ? ' Based on answers about challenge situations, not an observation of everyday behaviour.'
            : trait.measurable === 'inferred'
              ? ' Based on the ideas and explanations offered in this activity.'
              : ''}
        </Text>

        {tryAction ? (
          <View style={{ marginTop: spacing(1.5) }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${seen ? 'Try again' : 'Start'}: ${trait.label}, ${tryAction.count} questions`}
              accessibilityState={{ disabled: tryAction.busy, busy: tryAction.pending }}
              disabled={tryAction.busy}
              onPress={tryAction.onPress}
              style={({ pressed }) => [
                styles.tryButton,
                { borderColor: visual.border, backgroundColor: visual.background },
                tryAction.busy && !tryAction.pending && styles.tryDisabled,
                pressed && styles.pressed,
              ]}
            >
              {tryAction.pending ? <ActivityIndicator color={colors.ink} style={{ marginRight: spacing(1) }} /> : null}
              <Text style={styles.tryText}>
                {tryAction.pending
                  ? 'Making the questions…'
                  : `${seen ? 'Try again' : 'Start this one'} · ${tryAction.count} questions ▶`}
              </Text>
            </Pressable>
            {tryAction.error ? <Text style={styles.tryError}>{tryAction.error}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const ROUND_OPTIONS = [
  { count: 2, icon: '⚡', title: 'Quick' },
  { count: 5, icon: '⭐', title: 'More' },
  { count: 6, icon: '🚀', title: 'Big' },
] as const;

function chipStyle(r: ScoredResponse): TextStyle {
  if (r.skipped || r.ungraded) return styles.chipWarn;
  if (r.possible > 0 && r.earned === r.possible) return styles.chipGood;
  if (r.earned === 0) return styles.chipLow;
  return styles.chipMid;
}

/**
 * "6 of 6 points" alone read as 6 questions when there were 2, because each
 * question is scored out of 3 to allow partial credit. Lead with questions, and
 * explain the points in one short line underneath.
 */
function scoreSummary(report: Report): { headline: string; detail: string } {
  const scored = report.responses.filter(r => r.possible > 0);
  const n = scored.length;
  if (n === 0) return { headline: 'No questions were answered', detail: '' };
  const full = scored.filter(r => r.earned >= r.possible).length;
  const partly = scored.filter(r => r.earned > 0 && r.earned < r.possible).length;
  const notYet = n - full - partly;
  const headline = full === n
    ? (n === 1 ? 'The question was fully right' : n === 2 ? 'Both questions fully right' : `All ${n} questions fully right`)
    : [`${full} of ${n} ${n === 1 ? 'question' : 'questions'} fully right`, partly ? `${partly} partly right` : null, notYet ? `${notYet} not yet right` : null]
        .filter(Boolean).join(', ');
  const each = scored.every(r => r.possible === scored[0]!.possible) ? scored[0]!.possible : null;
  const points = `${report.overall.earned} of ${report.overall.possible} points`;
  const detail = each
    ? `Each answer can earn up to ${each} points, so partly right answers still count (${points}).`
    : `Answers can earn part points, so partly right answers still count (${points}).`;
  const skipped = report.responses.filter(r => r.skipped).length;
  return { headline: skipped ? `${headline} · ${skipped} skipped` : headline, detail };
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
  onTryCategory,
  roundLength = 2,
}: ResultsScreenProps) {
  const [showDetail, setShowDetail] = useState(false);
  const canTry = !historical && !!onTryCategory;
  const [tryLength, setTryLength] = useState<number>(ROUND_OPTIONS.some(o => o.count === roundLength) ? roundLength : 2);
  // Which card's Start was pressed, so only that card spins and shows an error.
  const [pendingTrait, setPendingTrait] = useState<TraitKey | null>(null);

  function startCategory(key: TraitKey) {
    if (!onTryCategory || busy) return;
    setPendingTrait(key);
    onTryCategory(key, tryLength);
  }
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setExpandedGroups(current => {
      const next = new Set(current);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {historical && onBackToHistory ? <Pressable onPress={onBackToHistory} accessibilityRole="button"><Text style={styles.historyBack}>← Previous assessments</Text></Pressable> : null}

      {/* Same look as the front page header: soft purple card, owl mascot. */}
      <View style={styles.hero}>
        <View style={styles.decorOne} />
        <View style={styles.decorTwo} />
        <View style={styles.mascotBubble}><Text style={styles.mascot}>🦉</Text></View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{historical ? 'SAVED ASSESSMENT RESULT' : 'TEST RESULT'}</Text>
          <Text style={styles.pageTitle}>{childName ? `${childName}'s test` : 'Test summary'}</Text>
          {completedAt ? <Text style={styles.heroText}>{new Date(completedAt).toLocaleString()}</Text> : null}
        </View>
      </View>

      <View style={styles.overall}>
        <View style={styles.scoreBadge}>
          <Text style={styles.overallNumber}>{report.overall.possible > 0 ? `${report.overall.percent}%` : '—'}</Text>
        </View>
        <Text style={styles.overallHeadline}>
          {report.overall.possible > 0 ? scoreSummary(report).headline : 'Not scored'}
        </Text>
        {scoreSummary(report).detail ? (
          <Text style={styles.overallDetail}>{scoreSummary(report).detail}</Text>
        ) : null}
      </View>

      {report.parentReport ? (
        <ParentReportCard report={report.parentReport} />
      ) : report.parentReportError ? (
        <View style={styles.warnCard}>
          <View style={styles.warnIconBubble}><Text style={styles.iconEmoji}>🌦️</Text></View>
          <Text style={styles.warnText}>
            The written report couldn&apos;t be generated this time. The scores below are
            unaffected.
          </Text>
        </View>
      ) : null}

      <View style={styles.headingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Category results</Text>
          <Text style={styles.sectionHint}>
            {canTry ? 'Tap a colorful card, then start any category right away.' : 'Tap a colorful card to see each category.'}
          </Text>
        </View>
        <Text style={styles.headingEmoji}>📊</Text>
      </View>
      <View style={styles.infoCallout}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
        All categories appear below. This result covers only the test just completed; earlier tests are in the child's history.
        The 1–5 indicators describe evidence in these activities, not a ranking against other children
        or an official school rating. Unobserved categories have no score. Speed, enjoyment, and
        everyday behaviour need observations over time.
        </Text>
      </View>
      {canTry ? (
        <View style={styles.lengthRow}>
          <Text style={styles.lengthLabel}>Questions per round</Text>
          <View style={styles.lengthChips}>
            {ROUND_OPTIONS.map(option => {
              const on = tryLength === option.count;
              return (
                <Pressable
                  key={option.count}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.title}, ${option.count} questions`}
                  accessibilityState={{ checked: on, disabled: busy }}
                  disabled={busy}
                  onPress={() => setTryLength(option.count)}
                  style={({ pressed }) => [styles.lengthChip, on && styles.lengthChipOn, pressed && styles.pressed]}
                >
                  <Text style={[styles.lengthChipText, on && styles.lengthChipTextOn]}>{option.icon} {option.count}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <View style={styles.groupList}>
        {CATEGORY_GROUPS.map(group => {
          const groupTraits = report.traits.filter(t => (t.group ?? 'intellectual') === group.key);
          const observed = groupTraits.filter(t => t.questionCount > 0).length;
          const expanded = expandedGroups.has(group.key);
          const visual = GROUP_VISUALS[group.key];
          return <View key={group.key} style={styles.groupCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${group.label}, ${observed} of ${groupTraits.length} observed`}
              onPress={() => toggleGroup(group.key)}
              style={({ pressed }) => [styles.groupHeader, { backgroundColor: visual.background, borderColor: visual.border }, pressed && styles.pressed]}
            >
              <View style={[styles.groupIcon, { borderColor: visual.border }]}><Text style={styles.groupEmoji}>{visual.icon}</Text></View>
              <View style={styles.groupHeaderCopy}>
                <Text style={[styles.groupTitle, { color: visual.ink }]}>{group.label}</Text>
                <Text style={styles.groupCount}>{observed} of {groupTraits.length} observed</Text>
              </View>
              <View style={[styles.chevronBubble, { backgroundColor: visual.border }]}><Text style={styles.chevron}>{expanded ? '−' : '+'}</Text></View>
            </Pressable>
            {expanded ? <View style={styles.groupItems}>{groupTraits.map(t => (
              <TraitCard
                key={t.key}
                trait={t}
                tryAction={canTry ? {
                  onPress: () => startCategory(t.key),
                  pending: busy && pendingTrait === t.key,
                  busy,
                  error: !busy && pendingTrait === t.key ? error : null,
                  count: tryLength,
                } : undefined}
              />
            ))}</View> : null}
          </View>;
        })}
      </View>

      {report.graderFailed ? (
        <View style={styles.warnCard}>
          <View style={styles.warnIconBubble}><Text style={styles.iconEmoji}>✍️</Text></View>
          <Text style={styles.warnText}>
            The written answers could not be graded automatically, so they are left out of the
            totals above. They are worth reading through by hand.
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => setShowDetail((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: showDetail }}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
      >
        <Text style={styles.toggleIcon}>📝</Text>
        <Text style={styles.toggleText}>
          {showDetail ? 'Hide question-by-question' : 'Show question-by-question'}
        </Text>
        <View style={styles.toggleBubble}><Text style={styles.chevron}>{showDetail ? '−' : '+'}</Text></View>
      </Pressable>

      {showDetail && (
        <View style={{ gap: spacing(2) }}>
          {report.responses.map((r, i) => (
            <View key={r.questionId} style={styles.responseCard}>
              {/* Question ids are generated UUIDs, meaningless to a parent. */}
              <Text style={type.label}>QUESTION {i + 1}</Text>
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
        <View style={styles.headingRowTight}>
          <Text style={[styles.sectionTitle, { flex: 1 }]}>Explore another category</Text>
          <Text style={styles.headingEmoji}>🎒</Text>
        </View>
        <Text style={[type.soft, { marginVertical: spacing(1) }]}>{report.traits.filter(t => t.questionCount > 0).length} of {report.traits.length} categories have observations so far. Your completed answers stay in this session.</Text>
        <Button title="Choose the next category" onPress={onChooseCategory} disabled={busy} />
        <Text style={[type.soft, { marginTop: spacing(1) }]}>
          AI generates a fresh round each time. Your completed rounds, answers, and report are saved privately to your parent account.
        </Text>
        {error && !pendingTrait ? (
          <Text style={[type.body, { color: colors.warn, marginTop: spacing(1.5) }]}>{error}</Text>
        ) : null}
        <View style={{ gap: spacing(1.5), marginTop: spacing(2) }}>
          <Button
            title="Ask different questions"
            onPress={() => { setPendingTrait(null); onReassess(); }}
            loading={busy && !pendingTrait}
            disabled={remainingUnseen === 0 || (busy && !!pendingTrait)}
          />

        </View>
      </View>}

      <View style={styles.disclaimer}>
        <Text style={styles.infoIcon}>🛡️</Text>
        <Text style={styles.disclaimerText}>{report.disclaimer}</Text>
      </View>

      <View style={{ marginTop: spacing(3) }}><Button title={historical ? 'Back to previous assessments' : 'Start a new session'} variant="secondary" onPress={historical && onBackToHistory ? onBackToHistory : onRestart} disabled={busy} /></View>
    </ScrollView>
  );
}

// Shapes and colours follow the front page (StartScreen) and the category
// picker: 22px rounded cards with 2px soft borders, emoji in white bubbles,
// heavy warm-brown section titles, and the same per-group colours.
const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFF8EF' },
  container: { padding: spacing(2.5), paddingBottom: spacing(6), width: '100%', maxWidth: 850, alignSelf: 'center' },
  historyBack: { color: colors.primary, fontWeight: '800', marginBottom: spacing(2) },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },

  hero: { position: 'relative', flexDirection: 'row', alignItems: 'center', gap: spacing(1.75), backgroundColor: '#EEE9FF', borderRadius: 26, padding: spacing(2.25), overflow: 'hidden', borderWidth: 2, borderColor: '#CABAF0' },
  decorOne: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFE4A8', top: -42, right: -22, opacity: 0.8 },
  decorTwo: { position: 'absolute', width: 65, height: 65, borderRadius: 33, backgroundColor: '#CDEEDC', bottom: -34, right: 90, opacity: 0.8 },
  mascotBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  mascot: { fontSize: 38 },
  heroCopy: { flex: 1 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1, color: '#6D5B91' },
  pageTitle: { fontSize: 26, lineHeight: 31, fontWeight: '900', color: '#6B4BB0', marginTop: 2 },
  heroText: { fontSize: 13, lineHeight: 19, color: '#6D5B91', marginTop: spacing(0.5) },

  overall: { marginTop: spacing(2), backgroundColor: '#E5F5EA', borderRadius: 22, borderWidth: 2, borderColor: '#A9D7B8', padding: spacing(2.5), alignItems: 'center' },
  scoreBadge: { minWidth: 132, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1), borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#A9D7B8', alignItems: 'center' },
  overallNumber: { fontSize: 44, lineHeight: 52, fontWeight: '900', color: '#34734E' },
  overallHeadline: { fontSize: 17, lineHeight: 23, fontWeight: '800', color: '#2F5D43', textAlign: 'center', marginTop: spacing(1.5) },
  overallDetail: { fontSize: 13, lineHeight: 19, color: '#4C6655', textAlign: 'center', marginTop: spacing(0.5) },

  summaryCard: { marginTop: spacing(2), backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#EEDFCB', borderRadius: 22, padding: spacing(2) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1.5) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), flexShrink: 1 },
  iconBubble: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF0C9', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  iconEmoji: { fontSize: 22 },
  listen: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(0.75), paddingHorizontal: spacing(1.5), borderRadius: 999, borderWidth: 2, borderColor: '#A8D4EF', backgroundColor: '#EAF6FF' },
  listenText: { fontSize: 14, fontWeight: '800', color: '#286789' },
  smallNote: { fontSize: 12, lineHeight: 18, color: colors.inkSoft },
  reportHeading: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: '#513A27', marginBottom: spacing(1) },
  sectionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.5), marginBottom: spacing(1.25) },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.happy, marginTop: 8 },
  closing: { marginTop: spacing(2.5), paddingTop: spacing(2), borderTopWidth: 1, borderTopColor: colors.line, fontStyle: 'italic' },

  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), marginTop: spacing(3), paddingHorizontal: spacing(0.5) },
  headingRowTight: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', color: '#513A27' },
  sectionHint: { fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: 2 },
  headingEmoji: { fontSize: 30 },
  infoCallout: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1), backgroundColor: '#EDF7FF', borderRadius: 14, padding: spacing(1.5), marginTop: spacing(1.5) },
  infoIcon: { fontSize: 16 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#526678' },

  groupList: { gap: spacing(1.5), marginTop: spacing(1.5) },
  groupCard: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.surface, shadowColor: '#4A3728', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing(1.5), paddingHorizontal: spacing(1.5), borderWidth: 2, borderRadius: 22 },
  groupIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: spacing(1.25) },
  groupEmoji: { fontSize: 25 },
  groupHeaderCopy: { flex: 1, minWidth: 0 },
  groupTitle: { fontSize: 17, lineHeight: 21, fontWeight: '800', color: colors.ink },
  groupCount: { fontSize: 12, lineHeight: 16, color: '#6F655D', marginTop: 2, fontWeight: '600' },
  chevronBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginLeft: spacing(1) },
  chevron: { color: '#FFFFFF', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  groupItems: { gap: spacing(1.5), padding: spacing(2) },

  traitCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.5), padding: spacing(1.75), borderRadius: 18, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.surface },
  traitIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  traitEmoji: { fontSize: 24 },
  traitBody: { flex: 1, minWidth: 0 },
  domainHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing(1), marginBottom: spacing(1) },
  domainLabel: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: colors.ink },
  scalePill: { alignItems: 'center', borderRadius: 14, borderWidth: 1.5, paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.5), minWidth: 64 },
  scaleValue: { fontSize: 20, fontWeight: '900', color: colors.ink, lineHeight: 24 },
  scaleLabel: { fontSize: 10, fontWeight: '700', color: colors.inkSoft },
  traitMeta: { fontSize: 12, lineHeight: 17, color: colors.inkSoft, fontWeight: '600' },
  statusPill: { alignSelf: 'flex-start', marginTop: spacing(1), backgroundColor: '#F3EEE7', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.5) },
  statusSeen: { backgroundColor: colors.goSoft },
  statusText: { fontSize: 12, fontWeight: '800', color: colors.inkSoft },
  statusSeenText: { color: colors.accent },
  barTrack: { height: 10, backgroundColor: '#F3EEE7', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },

  warnCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.25), marginTop: spacing(2), backgroundColor: '#FFF0EE', borderWidth: 2, borderColor: '#F2A28E', borderRadius: 20, padding: spacing(1.5) },
  warnIconBubble: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  warnText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#9C402F', fontWeight: '600' },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginTop: spacing(2.5), marginBottom: spacing(1.5), backgroundColor: colors.surface, borderWidth: 2, borderColor: '#EEDFCB', borderRadius: 18, paddingVertical: spacing(1.25), paddingHorizontal: spacing(1.5) },
  toggleIcon: { fontSize: 20 },
  toggleText: { flex: 1, color: '#513A27', fontWeight: '800', fontSize: 15 },
  toggleBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.happy },
  responseCard: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line, borderRadius: 18, padding: spacing(2) },
  scoreChip: { alignSelf: 'flex-start', marginTop: spacing(1.5), paddingHorizontal: spacing(1.5), paddingVertical: spacing(0.5), borderRadius: 999, fontSize: 13, fontWeight: '800', overflow: 'hidden' },
  chipGood: { backgroundColor: colors.goSoft, color: colors.accent },
  chipMid: { backgroundColor: '#FEF3E2', color: colors.warn },
  chipLow: { backgroundColor: '#FBE9E7', color: colors.danger },
  chipWarn: { backgroundColor: '#F3EEE7', color: colors.inkSoft },

  lengthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), marginTop: spacing(1.5), backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#EEDFCB', borderRadius: 18, paddingVertical: spacing(1), paddingHorizontal: spacing(1.5), flexWrap: 'wrap' },
  lengthLabel: { fontSize: 14, fontWeight: '800', color: '#513A27' },
  lengthChips: { flexDirection: 'row', gap: spacing(0.75) },
  lengthChip: { minWidth: 56, minHeight: 40, paddingHorizontal: spacing(1.25), borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFF9F0', alignItems: 'center', justifyContent: 'center' },
  lengthChipOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  lengthChipText: { fontSize: 14, fontWeight: '800', color: '#6D5A49' },
  lengthChipTextOn: { color: colors.primary },
  tryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 14, borderWidth: 2, paddingHorizontal: spacing(1.5), paddingVertical: spacing(1) },
  tryDisabled: { opacity: 0.45 },
  tryText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  tryError: { marginTop: spacing(1), fontSize: 13, lineHeight: 19, color: colors.danger },
  reassessCard: { marginTop: spacing(2.5), backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#EEDFCB', borderRadius: 22, padding: spacing(2) },
  disclaimer: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1), marginTop: spacing(2.5), backgroundColor: '#F3EEE7', borderRadius: 14, padding: spacing(1.5) },
  disclaimerText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#6B6259' },
});
