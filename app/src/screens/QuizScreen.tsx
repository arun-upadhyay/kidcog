import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import Button from '../components/Button';
import { SpeakerIcon } from '../components/Icons';
import VoiceAnswer from '../components/VoiceAnswer';
import GameView from '../games/GameView';
import { CATEGORY_NAMES, CATEGORY_VISUALS } from '../categoryVisuals';
import Figure, { CellView } from '../components/Figure';
import { colors, spacing, type, scaled, OPTION_COLORS, PRAISE, column, GUTTER, CONTENT_MAX_WIDTH } from '../theme';
import { speak, stopSpeaking, useSpeechState } from '../speech';
import type { PublicQuestion, ResponseInput, TestPayload } from '../types';

export interface QuizScreenProps {
  test: TestPayload;
  onFinish: (responses: ResponseInput[]) => void;
  /** Leave without finishing, back to the category screen. Nothing is submitted. */
  onExit: () => void;
  submitting: boolean;
  error: string | null;
}

/** Progress as filled dots — a young child reads "three left" faster than a bar. */
function ProgressDots({ total, current, scale }: { total: number; current: number; scale: number }) {
  const size = scaled(12, scale);
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: i < current ? colors.go : i === current ? colors.primary : colors.line,
          }}
        />
      ))}
    </View>
  );
}

export default function QuizScreen({ test, onFinish, onExit, submitting, error }: QuizScreenProps) {
  const speechState = useSpeechState();
  const speechBusy = speechState !== 'idle';
  const { profile } = test;
  const s = profile.uiScale;

  // The running sequence. A challenge choice splices its follow-up in right
  // after it, so picking "a tricky one" actually gets you the tricky one.
  const [sequence, setSequence] = useState<PublicQuestion[]>(test.questions);
  const [index, setIndex] = useState(0);
  const { width } = useWindowDimensions();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [praise, setPraise] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());
  const [tick, setTick] = useState(0);

  const question: PublicQuestion | undefined = sequence[index];

  // Reset question state; speech starts only from the speaker button.
  useEffect(() => {
    startedAt.current = Date.now();
    setTick(0);
    setPraise(null);
    return () => stopSpeaking();
  }, [question?.id]);

  // After a game is solved, move on by itself (a little pause to enjoy the
  // star first). Cancelled if the child moves on sooner or leaves.
  const autoNext = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goNextRef = useRef<() => void>(() => {});
  useEffect(() => () => { if (autoNext.current) clearTimeout(autoNext.current); }, [question?.id]);

  // Only run a clock when something actually displays it.
  useEffect(() => {
    if (!profile.showTimer) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [question?.id, profile.showTimer]);

  /**
   * Leave the activity. Straight away if nothing has been answered; otherwise
   * ask first, so a stray tap by a child does not throw away their answers.
   */
  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 0).length;
  // Each new question starts at the top, so its first lines are never hidden
  // under the bar from wherever the last question was scrolled to.
  const scrollRef = useRef<ScrollView>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setScrolled(false);
  }, [index]);

  const leaveRef = useRef<() => void>(() => {});
  leaveRef.current = () => {
    if (submitting) return;
    const leave = () => { stopSpeaking(); onExit(); };
    if (answeredCount === 0) { leave(); return; }
    const message = `${answeredCount} ${answeredCount === 1 ? 'answer' : 'answers'} so far will not be saved. You can pick another activity.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(`Go back?\n\n${message}`)) leave();
      return;
    }
    Alert.alert('Go back?', message, [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'Go back', style: 'destructive', onPress: leave },
    ]);
  };

  // Android's hardware back button leaves the activity the same way, instead
  // of closing the whole app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { leaveRef.current(); return true; });
    return () => sub.remove();
  }, []);

  const progress = useMemo(
    () => (index + 1) / Math.max(1, sequence.length),
    [index, sequence.length]
  );

  if (!question) {
    return (
      <View style={styles.empty}>
        <Text style={type.body}>No questions to show.</Text>
      </View>
    );
  }

  const isLast = index === sequence.length - 1;
  const current = answers[question.id] ?? '';
  const limit = question.timeLimitSeconds;
  const remaining = profile.showTimer && limit !== null ? Math.max(0, limit - tick) : null;
  const answered = current.trim().length > 0;

  function choose(optionKey: string) {
    const q = question!;
    setAnswers((a) => ({ ...a, [q.id]: optionKey }));

    // Honour a challenge choice. Offering a child the choice and then ignoring
    // it would teach them their choice does not matter, which is both dishonest
    // and the opposite of the disposition we are trying to observe.
    if (q.type === 'challenge' && q.followUp) {
      const nextId = q.followUp[optionKey];
      const followUp = nextId ? test.followUpQuestions[nextId] : undefined;
      if (followUp) {
        setSequence((seq) => {
          if (seq.some((s) => s.id === followUp.id)) return seq;
          const at = seq.findIndex((s) => s.id === q.id);
          const copy = [...seq];
          copy.splice(at + 1, 0, followUp);
          return copy;
        });
      }
    }

    if (profile.celebrateEachAnswer) {
      // Acknowledge the act of answering, never whether it was right. A young
      // child told "wrong" mid-test stops trying; correctness is for the
      // grown-up's report, not for them.
      setPraise(PRAISE[Math.floor(Math.random() * PRAISE.length)] ?? 'Nice one!');
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }

  function record(q: PublicQuestion) {
    setElapsed((e) => ({ ...e, [q.id]: Math.round((Date.now() - startedAt.current) / 1000) }));
  }

  // Stars so far this round: games solved, shown in the header.
  const stars = sequence.filter((q) => {
    if (q.type !== 'game' || !answers[q.id]) return false;
    try { return (JSON.parse(answers[q.id]!) as { solved?: boolean }).solved === true; } catch { return false; }
  }).length;

  function gameDone(answer: string, solved: boolean) {
    const q = question!;
    setAnswers((a) => ({ ...a, [q.id]: answer }));
    if (solved && !isLast) {
      if (autoNext.current) clearTimeout(autoNext.current);
      autoNext.current = setTimeout(() => goNextRef.current(), 1600);
    }
  }

  goNextRef.current = () => goNext();
  function goNext() {
    if (autoNext.current) { clearTimeout(autoNext.current); autoNext.current = null; }
    stopSpeaking();
    record(question!);
    if (isLast) {
      const responses: ResponseInput[] = sequence.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] ?? '',
        elapsedSeconds:
          q.id === question!.id
            ? Math.round((Date.now() - startedAt.current) / 1000)
            : elapsed[q.id] ?? 0,
      }));
      onFinish(responses);
    } else {
      setIndex((i) => i + 1);
    }
  }

  function goBack() {
    stopSpeaking();
    record(question!);
    setIndex((i) => Math.max(0, i - 1));
  }

  const young = profile.key === 'early';
  // Long questions get slightly smaller text so the answers stay in view.
  const promptLength = (question.prompt ?? '').length;
  const narrow = width < 480;
  // One calm type scale (not multiplied by the age scale, which is for tap
  // targets): questions 24/21 px, very long ones 21/18 px, answers 20/18 px.
  const promptSize = promptLength > 110 ? (narrow ? 18 : 21) : (narrow ? 21 : 24);
  const answerSize = narrow ? 18 : 20;
  const listenSize = promptLength > 70 || narrow ? 48 : 60;
  // Answer layout: one column on phones; two (or three very short ones) side by side on wider screens.
  const optionsInner = Math.min(width, CONTENT_MAX_WIDTH) - GUTTER * 2;
  const options = question.options ?? [];
  const longest = Math.max(0, ...options.map(o => (o.text ?? '').length));
  const optionColumns = optionsInner < 560 || options.length > 4 || longest > 28 || options.some(o => o.figure)
    ? 1
    : options.length === 3 && longest <= 12 && optionsInner >= 640 ? 3 : 2;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* A compact bar that stays put: Back, progress, stars. The question
          scrolls underneath it, and a soft edge appears so that is obvious. */}
      <View style={[styles.headerWrap, scrolled && styles.headerScrolled]}>
        <View style={styles.header}>
          <View style={styles.topBar}>
            <Pressable
              onPress={() => leaveRef.current()}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel="Go back and choose another activity"
              hitSlop={8}
              style={({ pressed }) => [styles.leaveButton, (pressed || submitting) && { opacity: 0.6 }]}
            >
              <Text style={styles.leaveText}>← Back</Text>
            </Pressable>
            <View style={styles.progressArea} accessibilityLabel={`Question ${index + 1} of ${sequence.length}`}>
              {young ? (
                <ProgressDots total={sequence.length} current={index} scale={s} />
              ) : (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
              )}
            </View>
            {sequence.some((q) => q.type === 'game') ? (
              <Text style={styles.starCount} accessibilityLabel={`${stars} stars so far`}>⭐ {stars}</Text>
            ) : remaining !== null ? (
              <Text style={[styles.timer, remaining <= 20 && { color: colors.warn }]}>
                {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
              </Text>
            ) : <View style={styles.topBarSpacer} />}
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        onScroll={e => { const down = e.nativeEvent.contentOffset.y > 4; if (down !== scrolled) setScrolled(down); }}
      >
        {test.poolExhausted ? <Text style={[type.soft, { marginBottom: spacing(1.5) }]}>This round uses the {test.questionCount} available questions in this category for your age.</Text> : null}
        {question.figure ? (
          <View style={styles.visualCard}>
            <Figure spec={question.figure} uiScale={s} />
          </View>
        ) : question.visual ? (
          <View style={styles.visualCard}>
            <Text style={[styles.visual, { fontSize: scaled(40, s), lineHeight: scaled(58, s) }]}>
              {question.visual}
            </Text>
          </View>
        ) : null}

        <View style={styles.questionCard}>
        <View style={styles.cardTop}>
          <Text style={styles.activityName} numberOfLines={1}>{CATEGORY_VISUALS[question.trait]?.icon ?? '⭐'} {CATEGORY_NAMES[question.trait] ?? test.traits.find((t) => t.key === question.trait)?.label ?? 'Thinking activity'}</Text>
          <Text style={styles.questionCount}>{index + 1} of {sequence.length}</Text>
        </View>
        <Text style={styles.kindLabel}>{question.type === 'game' ? '🎮 LET’S PLAY!' : question.type === 'mcq' ? (question.options?.some(o=>o.symbol || o.figure) ? '🖼️ TAP A PICTURE' : '👆 TAP YOUR ANSWER') : '🎤 TELL US YOUR IDEA'}</Text>
        <View style={styles.promptRow}>
          <Text style={[styles.prompt, { fontSize: promptSize, lineHeight: Math.round(promptSize * 1.35) }]}>
            {question.prompt}
          </Text>
          {profile.readAloud && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={speechBusy ? (speechState === 'loading' ? 'Loading audio' : 'Reading question') : 'Read the question aloud'}
              disabled={speechBusy}
              accessibilityState={{ disabled: speechBusy, busy: speechBusy }}
              onPress={() => void speak(question.speechText || question.prompt)}
              style={({ pressed }) => [styles.listen, pressed && { transform: [{ scale: 0.95 }] }]}
            >
              <View style={[styles.listenCircle, { width: scaled(listenSize, s), height: scaled(listenSize, s), borderRadius: scaled(listenSize / 2, s) }, speechBusy && styles.listenCircleBusy]}>
                {speechState === 'loading'
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <SpeakerIcon size={scaled(Math.round(listenSize * 0.53), s)} color="#FFFFFF" />}
              </View>
              <Text style={styles.listenLabel}>{speechState === 'loading' ? 'Loading…' : speechBusy ? 'Playing…' : 'Listen'}</Text>
            </Pressable>
          )}
        </View>
        </View>

        {question.type === 'game' && question.game ? (
          <GameView key={question.id} question={question} uiScale={s} value={current} onDone={gameDone} />
        ) : (question.type === 'mcq' || question.type === 'challenge') && question.options ? (
          <View style={styles.optionGrid}>
            {question.options.map((opt, i) => {
              const selected = current === opt.key;
              const tone = OPTION_COLORS[i % OPTION_COLORS.length]!;
              // Wide screens: short answers side by side so they all fit without
              // scrolling; an odd one out at the end takes the full row.
              const optionWidth = optionColumns === 1 || (optionColumns === 2 && i === question.options!.length - 1 && question.options!.length % 2 === 1)
                ? '100%'
                : Math.floor((optionsInner - OPTION_GAP * (optionColumns - 1)) / optionColumns) - 1;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={opt.text}
                  onPress={() => choose(opt.key)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      width: optionWidth,
                      minHeight: scaled(64, s),
                      backgroundColor: selected ? tone.bg : colors.surface,
                      borderColor: selected ? tone.border : colors.line,
                      borderWidth: selected ? 3 : 1.5,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  {opt.figure ? (
                    <CellView cell={opt.figure} size={scaled(44, s)} />
                  ) : opt.symbol ? (
                    <Text style={{ fontSize: scaled(34, s) }}>{opt.symbol}</Text>
                  ) : (
                    <View style={[styles.bullet, selected && { backgroundColor: tone.border }]}>
                      <Text style={[styles.bulletText, selected && { color: '#fff' }]}>
                        {opt.key.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.optionText, { fontSize: answerSize, lineHeight: Math.round(answerSize * 1.3) }]}>{opt.text}</Text>
                  {selected ? <Text style={{ fontSize: scaled(22, s) }}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : profile.openAnswerMode === 'voice' ? (
          <VoiceAnswer
            value={current}
            onChange={(t) => setAnswers((a) => ({ ...a, [question.id]: t }))}
            uiScale={s}
            variant="big"
          />
        ) : (
          <View style={{ marginTop: spacing(3) }}>
            <TextInput
              style={styles.textarea}
              value={current}
              onChangeText={(t) => setAnswers((a) => ({ ...a, [question.id]: t }))}
              placeholder="Type your answer here, or tap the microphone below."
              placeholderTextColor={colors.inkSoft}
              multiline
              textAlignVertical="top"
              maxLength={4000}
            />
            {profile.openAnswerMode === 'both' && (
              <VoiceAnswer
                value={current}
                onChange={(t) => setAnswers((a) => ({ ...a, [question.id]: t }))}
                uiScale={s}
                variant="inline"
              />
            )}
            <Text style={[type.soft, { marginTop: spacing(1) }]}>
              Spelling doesn&apos;t matter — the thinking is what&apos;s being looked at.
            </Text>
          </View>
        )}

        {praise ? <Text style={[styles.praise, { fontSize: scaled(20, s) }]}>{praise} 🎉</Text> : null}

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footerBar}>
      <View style={styles.footer}>
        {index > 0 && !submitting && (
          <View style={{ flex: 1 }}>
            <Button title="Previous" variant="secondary" onPress={goBack} />
          </View>
        )}
        <View style={{ flex: 2 }}>
          <Button
            title={
              submitting
                ? young
                  ? 'Almost there…'
                  : 'Scoring…'
                : isLast
                  ? young
                    ? "I'm finished! 🎈"
                    : 'Finish and score'
                  : answered
                    ? young
                      ? 'Next ➜'
                      : 'Next'
                    : young
                      ? 'Skip this one'
                      : 'Skip'
            }
            onPress={goNext}
            loading={submitting}
            // Skipping is allowed but shouldn't look like the main thing to do:
            // a big orange "Skip" was being pressed mid-game, losing the game.
            variant={answered || isLast || submitting ? 'primary' : 'secondary'}
          />
        </View>
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const OPTION_GAP = spacing(1.5);

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  headerWrap: { backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: 'transparent', zIndex: 2 },
  headerScrolled: { borderBottomColor: colors.line, shadowColor: '#4A3728', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  header: { paddingTop: spacing(1.5), paddingBottom: spacing(1.25), paddingHorizontal: GUTTER, ...column },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.5) },
  progressArea: { flex: 1, justifyContent: 'center' },
  topBarSpacer: { width: 96 },
  timer: { fontSize: 15, fontWeight: '900', color: colors.inkSoft, width: 96, textAlign: 'right' },
  questionCard: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1.5, borderColor: colors.line, padding: spacing(2), marginBottom: spacing(2), shadowColor: '#4A3728', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1), marginBottom: spacing(1) },
  activityName: { flex: 1, fontSize: 16, fontWeight: '900', color: '#513A27' },
  questionCount: { fontSize: 13, fontWeight: '800', color: colors.inkSoft, backgroundColor: '#F3EEE7', borderRadius: 999, paddingHorizontal: spacing(1.25), paddingVertical: 3, overflow: 'hidden' },
  kindLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, color: colors.inkSoft, marginBottom: spacing(1) },
  leaveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 96, minHeight: 40, paddingHorizontal: spacing(1.5), borderRadius: 999, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface },
  leaveText: { fontSize: 14, fontWeight: '800', color: colors.inkSoft },
  dots: { flexDirection: 'row', gap: spacing(1), justifyContent: 'center', flexWrap: 'wrap' },
  progressTrack: { height: 6, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.go },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starCount: { width: 96, textAlign: 'center', fontSize: 16, fontWeight: '900', color: '#8A5A0A', backgroundColor: colors.happySoft, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  body: { paddingTop: spacing(2), paddingHorizontal: GUTTER, paddingBottom: spacing(4), ...column },
  visualCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: colors.line,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(2),
    marginBottom: spacing(2.5),
    alignItems: 'center',
  },
  visual: { textAlign: 'center', letterSpacing: 2 },
  promptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.5) },
  prompt: { flex: 1, minWidth: 0, fontWeight: '800', color: colors.ink },
  // "Hear the question": a round blue speaker button, the same shape people
  // know from read-aloud buttons elsewhere, with its word underneath.
  listen: { alignItems: 'center', gap: 4, flexShrink: 0 },
  listenCircle: { backgroundColor: '#2F7FC1', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', shadowColor: '#2F7FC1', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  listenCircleBusy: { backgroundColor: '#7FB2DC' },
  listenLabel: { fontSize: 13, fontWeight: '900', color: '#2F7FC1' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: OPTION_GAP },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    borderRadius: 18,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.5),
  },
  bullet: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: { fontWeight: '700', color: colors.inkSoft },
  optionText: { flex: 1, color: colors.ink, fontWeight: '700' },
  textarea: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    padding: spacing(2),
    minHeight: 160,
    fontSize: 17,
    lineHeight: 25,
    color: colors.ink,
  },
  praise: {
    marginTop: spacing(3),
    textAlign: 'center',
    fontWeight: '700',
    color: colors.go,
  },
  // The bar (line + background) spans the window; its buttons stay in the column.
  footerBar: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing(1.5),
    paddingVertical: spacing(2.5),
    paddingHorizontal: GUTTER,
    ...column,
  },
  errorBanner: {
    backgroundColor: '#FBE9E7',
    color: colors.danger,
    padding: spacing(2),
    borderRadius: 12,
    marginTop: spacing(3),
    fontSize: 15,
  },
});
