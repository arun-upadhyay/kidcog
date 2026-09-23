import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import Button from '../components/Button';
import VoiceAnswer from '../components/VoiceAnswer';
import Figure, { CellView } from '../components/Figure';
import { colors, spacing, type, scaled, OPTION_COLORS, PRAISE } from '../theme';
import { speak, stopSpeaking, useSpeechState } from '../speech';
import type { PublicQuestion, ResponseInput, TestPayload } from '../types';

export interface QuizScreenProps {
  test: TestPayload;
  onFinish: (responses: ResponseInput[]) => void;
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

export default function QuizScreen({ test, onFinish, submitting, error }: QuizScreenProps) {
  const speechState = useSpeechState();
  const speechBusy = speechState !== 'idle';
  const { profile } = test;
  const s = profile.uiScale;

  // The running sequence. A challenge choice splices its follow-up in right
  // after it, so picking "a tricky one" actually gets you the tricky one.
  const [sequence, setSequence] = useState<PublicQuestion[]>(test.questions);
  const [index, setIndex] = useState(0);
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

  // Only run a clock when something actually displays it.
  useEffect(() => {
    if (!profile.showTimer) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [question?.id, profile.showTimer]);

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

  function goNext() {
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        {young ? (
          <ProgressDots total={sequence.length} current={index} scale={s} />
        ) : (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        )}

        <Text style={[type.heading, { marginBottom: spacing(1) }]}>{test.traits.find((t) => t.key === question.trait)?.label ?? 'Thinking activity'}</Text>
        <View style={styles.headerRow}>
          <Text style={type.label}>
            {`QUESTION ${index + 1} OF ${sequence.length}`}
          </Text>
          {remaining !== null && (
            <Text style={[type.label, remaining <= 20 && { color: colors.warn }]}>
              {String(Math.floor(remaining / 60)).padStart(2, '0')}:
              {String(remaining % 60).padStart(2, '0')}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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

        <View style={styles.promptRow}>
          <Text style={[styles.prompt, { fontSize: scaled(22, s), lineHeight: scaled(32, s) }]}>
            {question.prompt}
          </Text>
          {profile.readAloud && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={speechBusy ? (speechState === 'loading' ? 'Loading audio' : 'Reading question') : 'Read the question aloud'}
              disabled={speechBusy}
              accessibilityState={{ disabled: speechBusy, busy: speechBusy }}
              onPress={() => void speak(question.speechText || question.prompt)}
              style={({ pressed }) => [styles.replay, (pressed || speechBusy) && { opacity: 0.5 }]}
            >
              <Text style={{ fontSize: scaled(24, s) }}>{speechState === 'loading' ? '⏳' : speechBusy ? '🔉' : '🔊'}</Text>
            </Pressable>
          )}
        </View>

        {(question.type === 'mcq' || question.type === 'challenge') && question.options ? (
          <View style={{ gap: spacing(1.5), marginTop: spacing(3) }}>
            {question.options.map((opt, i) => {
              const selected = current === opt.key;
              const tone = OPTION_COLORS[i % OPTION_COLORS.length]!;
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
                  <Text style={[styles.optionText, { fontSize: scaled(18, s) }]}>{opt.text}</Text>
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

      <View style={styles.footer}>
        {index > 0 && !submitting && (
          <View style={{ flex: 1 }}>
            <Button title={young ? 'Back' : 'Back'} variant="secondary" onPress={goBack} />
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
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  header: { paddingTop: spacing(2), paddingHorizontal: spacing(3), gap: spacing(1.5) },
  dots: { flexDirection: 'row', gap: spacing(1), justifyContent: 'center', flexWrap: 'wrap' },
  progressTrack: { height: 6, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.go },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  body: { padding: spacing(3), paddingBottom: spacing(4) },
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
  prompt: { flex: 1, fontWeight: '700', color: colors.ink },
  replay: {
    backgroundColor: colors.coolSoft,
    borderRadius: 999,
    padding: spacing(1.25),
    borderWidth: 1.5,
    borderColor: colors.cool,
  },
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
  optionText: { flex: 1, color: colors.ink, fontWeight: '600' },
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
  footer: {
    flexDirection: 'row',
    gap: spacing(1.5),
    padding: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
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
