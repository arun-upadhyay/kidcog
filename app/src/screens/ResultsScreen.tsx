import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, type TextStyle } from 'react-native';
import { CATEGORY_GROUPS } from '../categoryGroups';
import RewardCard from '../components/RewardCard';
import ReportSheet, { ReportLink } from '../components/ReportSheet';
import type { RoundReward } from '../progress';
import { CATEGORY_NAMES, CATEGORY_VISUALS, GROUP_NAMES, GROUP_VISUALS } from '../categoryVisuals';
import Owl from '../components/Owl';
import Button from '../components/Button';
import { colors, spacing, type, column, GUTTER } from '../theme';
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
  /** Stars and a sticker won this round, for children who see their own results. */
  reward?: RoundReward | null;
  /** This result's session, so the AI-written note can be reported. */
  sessionId?: string | null;
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

function ParentReportCard({ report, onReport }: { report: ParentReportType; onReport?: () => void }) {
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
      {/* Written by AI, so it can be reported (Google Play AI-content policy). */}
      {onReport ? (
        <View style={styles.reportRow}>
          <Text style={styles.smallNote}>Written with AI.</Text>
          <ReportLink onPress={onReport} label="Report this note" accessibilityLabel="Report this note" />
        </View>
      ) : null}
    </View>
  );
}

/**
 * What the child played in this round, in the same words and colours as the
 * activity picker: the friendly name ("Number magic") first, the official form
 * wording underneath for parents who need to match it to a school form.
 *
 * A category with no evidence shows "not played yet", never a zero. A parent
 * reading 0 beside "demonstrates great curiosity" would take it as a judgement
 * about their child rather than as missing data.
 */
function PlayedCard({ trait }: { trait: TraitReport }) {
  const visual = CATEGORY_VISUALS[trait.key] ?? { icon: '⭐', background: colors.happySoft, border: colors.happy };
  return (
    <View style={[styles.playedCard, { borderColor: visual.border }]}>
      <View style={styles.playedTop}>
        <View style={[styles.playedIcon, { backgroundColor: visual.background, borderColor: visual.border }]}>
          <Text style={styles.playedEmoji}>{visual.icon}</Text>
        </View>
        <View style={styles.playedTitles}>
          <Text style={styles.playedName}>{CATEGORY_NAMES[trait.key] ?? trait.label}</Text>
          <Text style={styles.officialName}>{trait.label}</Text>
        </View>
        {trait.formScale ? (
          <View style={[styles.scalePill, { backgroundColor: visual.background, borderColor: visual.border }]}>
            <Text style={styles.scaleValue}>{trait.formScale.value}/5</Text>
            <Text style={styles.scaleLabel}>{trait.formScale.label}</Text>
          </View>
        ) : null}
      </View>
      {trait.formScale ? <Bar percent={trait.percent} color={visual.border} /> : null}
      <View style={styles.bandRow}>
        <View style={styles.bandPill}><Text style={styles.bandText}>{trait.band}</Text></View>
        <Text style={styles.traitMeta}>{trait.questionCount} {trait.questionCount === 1 ? 'question' : 'questions'} · {trait.percent}%</Text>
      </View>
      <Text style={styles.blurb}>{trait.blurb}</Text>
      <Text style={styles.evidence}>
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

/** The same "How many?" picker as the activity screen. */
const ROUND_OPTIONS = [
  { count: 2, icon: '⚡' },
  { count: 5, icon: '⭐' },
  { count: 6, icon: '🚀' },
] as const;

function HowMany({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled: boolean }) {
  return (
    <View style={styles.lengthRow}>
      <Text style={styles.lengthLabel} numberOfLines={1}>How many?</Text>
      <View style={styles.lengthPills}>
        {ROUND_OPTIONS.map(option => {
          const on = value === option.count;
          return (
            <Pressable
              key={option.count}
              accessibilityRole="radio"
              accessibilityLabel={`${option.count} questions`}
              accessibilityState={{ checked: on, disabled }}
              disabled={disabled}
              onPress={() => onChange(option.count)}
              style={({ pressed }) => [styles.lengthPill, on && styles.lengthPillOn, pressed && styles.pressed]}
            >
              <Text style={styles.lengthIcon}>{option.icon}</Text>
              <Text style={[styles.lengthNumber, on && styles.lengthNumberOn]}>{option.count}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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

/** A card-shaped button that opens and closes a section, used for every fold-out on this screen. */
function Fold({ icon, title, open, onToggle, tint = colors.happy }: { icon: string; title: string; open: boolean; onToggle: () => void; tint?: string }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      <Text style={styles.toggleIcon}>{icon}</Text>
      <Text style={styles.toggleText}>{title}</Text>
      <View style={[styles.toggleBubble, { backgroundColor: tint }]}><Text style={styles.chevron}>{open ? '−' : '+'}</Text></View>
    </Pressable>
  );
}

export default function ResultsScreen({
  report,
  childName,
  onRestart,
  onChooseCategory,
  onReassess,
  busy,
  error,
  historical = false,
  completedAt,
  onBackToHistory,
  onTryCategory,
  roundLength = 2,
  reward,
  sessionId,
}: ResultsScreenProps) {
  // The grown-up "Report this note" sheet (the note is written by AI).
  const [reportingNote, setReportingNote] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [count, setCount] = useState<number>(ROUND_OPTIONS.some(o => o.count === roundLength) ? roundLength : 2);
  // Which "Play again" was pressed, so only that button spins.
  const [pendingTrait, setPendingTrait] = useState<TraitKey | null>(null);

  const played = report.traits.filter(t => t.questionCount > 0);
  const who = childName?.trim() || 'Your child';
  const summary = scoreSummary(report);

  function playAgain(key: TraitKey) {
    if (busy) return;
    setPendingTrait(key);
    if (onTryCategory) onTryCategory(key, count);
    else onReassess();
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      {historical && onBackToHistory ? <Pressable onPress={onBackToHistory} accessibilityRole="button"><Text style={styles.historyBack}>← Previous results</Text></Pressable> : null}

      {/* Same header shape as "What shall we explore?", with the owl. */}
      <View style={styles.hero}>
        <View style={styles.heroBubble}><Owl mood="happy" size={46} /></View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>{historical ? 'SAVED RESULT' : 'ROUND COMPLETE'}</Text>
          <Text style={styles.pageTitle}>{childName ? `${childName}’s results` : 'Results'}</Text>
          {completedAt ? <Text style={styles.heroText}>{new Date(completedAt).toLocaleString()}</Text> : null}
        </View>
      </View>
      {reward && !historical ? <RewardCard reward={reward} /> : null}

      <View style={styles.overall}>
        <View style={styles.scoreBadge}>
          <Text style={styles.overallNumber}>{report.overall.possible > 0 ? `${report.overall.percent}%` : '—'}</Text>
        </View>
        <Text style={styles.overallHeadline}>{report.overall.possible > 0 ? summary.headline : 'Not scored'}</Text>
        {summary.detail ? <Text style={styles.overallDetail}>{summary.detail}</Text> : null}
      </View>

      {report.parentReport ? (
        <ParentReportCard report={report.parentReport} onReport={sessionId ? () => setReportingNote(true) : undefined} />
      ) : report.parentReportPending ? (
        <View style={styles.noteCard} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.noteText}>Writing a short note for you… the results below are ready now.</Text>
        </View>
      ) : report.parentReportError ? (
        <View style={styles.warnCard}>
          <View style={styles.warnIconBubble}><Text style={styles.iconEmoji}>🌦️</Text></View>
          <Text style={styles.warnText}>The written note couldn&apos;t be made this time. The results below are unaffected.</Text>
        </View>
      ) : null}

      <View style={styles.headingRow}>
        <Text style={[styles.sectionTitle, { flex: 1 }]}>{played.length === 1 ? `What ${who} played` : `What ${who} played (${played.length})`}</Text>
        <Text style={styles.headingEmoji}>🎯</Text>
      </View>
      {played.length ? (
        <View style={styles.playedList}>{played.map(t => <PlayedCard key={t.key} trait={t} />)}</View>
      ) : (
        <Text style={styles.emptyText}>No answers were scored in this round, so there is nothing to show yet.</Text>
      )}

      {report.graderFailed ? (
        <View style={styles.warnCard}>
          <View style={styles.warnIconBubble}><Text style={styles.iconEmoji}>✍️</Text></View>
          <Text style={styles.warnText}>
            The spoken or written answers could not be checked automatically, so they are left out of the
            totals above. They are worth reading through below.
          </Text>
        </View>
      ) : null}

      {/* What to do next: the most common choice first. */}
      {!historical ? (
        <View style={styles.nextCard}>
          <View style={styles.headingRowTight}>
            <Text style={[styles.sectionTitle, { flex: 1 }]}>Keep playing</Text>
            <Text style={styles.headingEmoji}>🎒</Text>
          </View>
          <HowMany value={count} onChange={setCount} disabled={busy} />
          {played.map(t => (
            <Button
              key={t.key}
              title={busy && pendingTrait === t.key ? 'Making your questions…' : `▶  Play ${CATEGORY_NAMES[t.key] ?? t.label} again`}
              onPress={() => playAgain(t.key)}
              loading={busy && pendingTrait === t.key}
              disabled={busy}
            />
          ))}
          <Button title="🌈  Choose another activity" variant="secondary" onPress={onChooseCategory} disabled={busy} />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      ) : null}

      <Fold icon="📝" title={showDetail ? 'Hide each question' : 'See each question and answer'} open={showDetail} onToggle={() => setShowDetail(v => !v)} />
      {showDetail && (
        <View style={{ gap: spacing(1.5) }}>
          {report.responses.map((r, i) => (
            <View key={r.questionId} style={styles.responseCard}>
              <Text style={type.label}>QUESTION {i + 1}</Text>
              <Text style={[type.body, { marginTop: spacing(0.5), fontWeight: '600' }]}>{r.prompt}</Text>
              <Text style={[type.soft, { marginTop: spacing(1) }]}>Answer: {r.answer.trim() ? r.answer : '(no answer)'}</Text>
              <Text style={[styles.scoreChip, chipStyle(r)]}>
                {r.skipped ? 'skipped — not scored' : r.ungraded ? 'not checked' : `${r.earned} / ${r.possible} points`}
              </Text>
              {r.note ? <Text style={[type.soft, { marginTop: spacing(1) }]}>{r.note}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {/* Every activity, grouped exactly like the picker's tabs. */}
      <Fold icon="🗂️" title={showAll ? 'Hide all activities' : `See all ${report.traits.length} activities`} open={showAll} onToggle={() => setShowAll(v => !v)} tint={colors.cool} />
      {showAll ? (
        <View style={styles.allList}>
          {CATEGORY_GROUPS.map(group => {
            const traits = report.traits.filter(t => (t.group ?? 'intellectual') === group.key);
            if (!traits.length) return null;
            const visual = GROUP_VISUALS[group.key];
            const count = traits.filter(t => t.questionCount > 0).length;
            return (
              <View key={group.key} style={[styles.groupCard, { borderColor: visual.border }]}>
                <View style={[styles.groupHeader, { backgroundColor: visual.background }]}>
                  <Text style={styles.groupEmoji}>{visual.icon}</Text>
                  <Text style={[styles.groupTitle, { color: visual.ink }]}>{GROUP_NAMES[group.key]}</Text>
                  <Text style={styles.groupCount}>{count ? `${count} played` : 'None played'}</Text>
                </View>
                {traits.map(t => {
                  const tv = CATEGORY_VISUALS[t.key];
                  return (
                    <View key={t.key} style={styles.allRow} accessible accessibilityLabel={`${CATEGORY_NAMES[t.key]}: ${t.formScale ? `${t.formScale.value} out of 5, ${t.formScale.label}` : 'not played in this round'}`}>
                      <View style={[styles.allIcon, { backgroundColor: tv?.background, borderColor: tv?.border }]}><Text style={styles.allEmoji}>{tv?.icon ?? '⭐'}</Text></View>
                      <Text style={styles.allName} numberOfLines={1}>{CATEGORY_NAMES[t.key] ?? t.label}</Text>
                      {t.formScale
                        ? <Text style={[styles.allScore, { borderColor: tv?.border, backgroundColor: tv?.background }]}>{t.formScale.value}/5</Text>
                        : <Text style={styles.allNotYet}>Not played</Text>}
                    </View>
                  );
                })}
              </View>
            );
          })}
          <Text style={styles.smallNote}>Only the activities played in this round have results. Earlier rounds are in {who}’s history.</Text>
        </View>
      ) : null}

      <Fold icon="🛡️" title="About these results" open={showAbout} onToggle={() => setShowAbout(v => !v)} tint="#B8A99A" />
      {showAbout ? (
        <View style={styles.aboutCard}>
          <Text style={styles.aboutText}>
            This covers only the round just finished. The 1–5 indicators describe what showed up in these
            activities — not a ranking against other children or an official school rating. Activities not
            played have no score. Speed, enjoyment and everyday behaviour need observations over time.
          </Text>
          <Text style={[styles.aboutText, { marginTop: spacing(1) }]}>{report.disclaimer}</Text>
        </View>
      ) : null}

      <View style={{ marginTop: spacing(1) }}>
        <Button
          title={historical ? '← Back to previous results' : '🏠  Done for now'}
          variant="secondary"
          onPress={historical && onBackToHistory ? onBackToHistory : onRestart}
          disabled={busy}
        />
      </View>
      <ReportSheet visible={reportingNote} onClose={() => setReportingNote(false)} kind="note" sessionId={sessionId} />
    </ScrollView>
  );
}

// Shapes and colours follow the activity picker (CategoryScreen): 24px rounded
// cards with 2px soft borders, emoji in white bubbles, heavy warm-brown titles,
// the same "How many?" pills and the same group names and colours.
const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFF8EF' },
  container: { padding: GUTTER, paddingBottom: spacing(6), gap: spacing(2), ...column },
  historyBack: { color: colors.primary, fontWeight: '800' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },

  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5), backgroundColor: '#EEE9FF', borderRadius: 24, padding: spacing(2), borderWidth: 2, borderColor: '#CABAF0' },
  heroBubble: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] },
  heroCopy: { flex: 1 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 1, color: '#6D5B91' },
  pageTitle: { fontSize: 23, lineHeight: 28, fontWeight: '900', color: '#4E3590', marginTop: 2 },
  heroText: { fontSize: 13, lineHeight: 19, color: '#6D5B91', marginTop: spacing(0.5) },

  overall: { backgroundColor: '#E5F5EA', borderRadius: 24, borderWidth: 2, borderColor: '#A9D7B8', padding: spacing(2.5), alignItems: 'center' },
  scoreBadge: { minWidth: 132, paddingHorizontal: spacing(2.5), paddingVertical: spacing(1), borderRadius: 999, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#A9D7B8', alignItems: 'center' },
  overallNumber: { fontSize: 44, lineHeight: 52, fontWeight: '900', color: '#34734E' },
  overallHeadline: { fontSize: 17, lineHeight: 23, fontWeight: '800', color: '#2F5D43', textAlign: 'center', marginTop: spacing(1.5) },
  overallDetail: { fontSize: 13, lineHeight: 19, color: '#4C6655', textAlign: 'center', marginTop: spacing(0.5) },

  summaryCard: { backgroundColor: colors.surface, borderWidth: 2, borderColor: '#EEDFCB', borderRadius: 24, padding: spacing(2) },
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

  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), marginTop: spacing(1), paddingHorizontal: spacing(0.5) },
  headingRowTight: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  sectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900', color: '#513A27' },
  headingEmoji: { fontSize: 28 },
  emptyText: { fontSize: 15, lineHeight: 22, color: colors.inkSoft, paddingHorizontal: spacing(0.5) },

  playedList: { gap: spacing(1.5) },
  playedCard: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 2, padding: spacing(2), gap: spacing(1.25), shadowColor: '#4A3728', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  playedTop: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  playedIcon: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  playedEmoji: { fontSize: 32 },
  playedTitles: { flex: 1, minWidth: 0 },
  playedName: { fontSize: 20, lineHeight: 24, fontWeight: '900', color: '#3F3126' },
  officialName: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: colors.inkSoft, marginTop: 2 },
  scalePill: { alignItems: 'center', borderRadius: 16, borderWidth: 2, paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.5), minWidth: 66 },
  scaleValue: { fontSize: 20, fontWeight: '900', color: colors.ink, lineHeight: 24 },
  scaleLabel: { fontSize: 10, fontWeight: '800', color: colors.inkSoft },
  bandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), flexWrap: 'wrap' },
  bandPill: { backgroundColor: colors.goSoft, borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: spacing(0.5) },
  bandText: { fontSize: 13, fontWeight: '800', color: colors.accent },
  traitMeta: { fontSize: 12, color: colors.inkSoft, fontWeight: '700' },
  blurb: { fontSize: 14, lineHeight: 20, color: '#5E5249' },
  evidence: { fontSize: 12, lineHeight: 18, color: colors.inkSoft, fontStyle: 'italic' },
  barTrack: { height: 10, backgroundColor: '#F3EEE7', borderRadius: 5, overflow: 'hidden' },
  barFill: { height: 10, borderRadius: 5 },

  nextCard: { backgroundColor: '#FFF0C9', borderWidth: 2, borderColor: '#F4C966', borderRadius: 24, padding: spacing(2), gap: spacing(1.5) },
  lengthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), flexWrap: 'wrap' },
  lengthLabel: { fontSize: 16, fontWeight: '900', color: '#513A27' },
  lengthPills: { flexDirection: 'row', gap: spacing(1) },
  lengthPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: spacing(1.5), borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: '#FFFFFF' },
  lengthPillOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  lengthIcon: { fontSize: 18 },
  lengthNumber: { fontSize: 17, fontWeight: '900', color: '#6D5A49' },
  lengthNumberOn: { color: colors.primary },
  errorText: { color: colors.danger, backgroundColor: '#FBE9E7', padding: spacing(1.5), borderRadius: 12, fontSize: 14, lineHeight: 20 },

  noteCard: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), backgroundColor: '#F2EAFE', borderWidth: 2, borderColor: '#CABAF0', borderRadius: 20, padding: spacing(1.5) },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#5A3E99', fontWeight: '700' },
  warnCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.25), backgroundColor: '#FFF0EE', borderWidth: 2, borderColor: '#F2A28E', borderRadius: 20, padding: spacing(1.5) },
  warnIconBubble: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  warnText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#9C402F', fontWeight: '600' },

  toggle: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), backgroundColor: colors.surface, borderWidth: 2, borderColor: '#EEDFCB', borderRadius: 20, minHeight: 56, paddingVertical: spacing(1), paddingHorizontal: spacing(1.5) },
  toggleIcon: { fontSize: 20 },
  toggleText: { flex: 1, color: '#513A27', fontWeight: '800', fontSize: 15 },
  toggleBubble: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chevron: { color: '#FFFFFF', fontSize: 22, lineHeight: 25, fontWeight: '900' },
  responseCard: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.line, borderRadius: 20, padding: spacing(2) },
  scoreChip: { alignSelf: 'flex-start', marginTop: spacing(1.5), paddingHorizontal: spacing(1.5), paddingVertical: spacing(0.5), borderRadius: 999, fontSize: 13, fontWeight: '800', overflow: 'hidden' },
  chipGood: { backgroundColor: colors.goSoft, color: colors.accent },
  chipMid: { backgroundColor: '#FEF3E2', color: colors.warn },
  chipLow: { backgroundColor: '#FBE9E7', color: colors.danger },
  chipWarn: { backgroundColor: '#F3EEE7', color: colors.inkSoft },

  allList: { gap: spacing(1.5) },
  groupCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 2, overflow: 'hidden' },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing(1), paddingVertical: spacing(1), paddingHorizontal: spacing(1.5) },
  groupEmoji: { fontSize: 22 },
  groupTitle: { flex: 1, fontSize: 16, fontWeight: '900' },
  groupCount: { fontSize: 12, fontWeight: '800', color: '#6F655D' },
  allRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25), paddingVertical: spacing(0.75), paddingHorizontal: spacing(1.5), borderTopWidth: 1, borderTopColor: '#F3EADB' },
  allIcon: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  allEmoji: { fontSize: 17 },
  allName: { flex: 1, fontSize: 15, fontWeight: '800', color: '#3F3126' },
  allScore: { fontSize: 13, fontWeight: '900', color: colors.ink, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: spacing(1), paddingVertical: 2, overflow: 'hidden' },
  allNotYet: { fontSize: 12, fontWeight: '700', color: '#A2968A' },

  aboutCard: { backgroundColor: '#F3EEE7', borderRadius: 18, padding: spacing(1.75) },
  aboutText: { fontSize: 13, lineHeight: 19, color: '#6B6259' },
  reportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), marginTop: spacing(2), paddingTop: spacing(1.5), borderTopWidth: 1, borderTopColor: colors.line },
});
