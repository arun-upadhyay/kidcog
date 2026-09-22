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
import { colors, spacing, type, scaled, OPTION_COLORS, PRAISE } from '../theme';
import { speak, stopSpeaking } from '../speech';
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
  const { profile } = test;
  const s = profile.uiScale;

  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [praise, setPraise] = useState<string | null>(null);
  const startedAt = useRef<number>(Date.now());
  const [tick, setTick] = useState(0);

  const question: PublicQuestion | undefined = test.questions[index];

  // Read the question aloud on arrival. This is how a pre-reader receives it.
  useEffect(() => {
    startedAt.current = Date.now();
    setTick(0);
    setPraise(null);
    if (question && profile.readAloud) {
      speak(question.spoken ?? question.prompt);
    }
    return () => stopSpeaking();
  }, [question?.id, profile.readAloud]);

  // Only run a clock when something actually displays it.
  useEffect(() => {
    if (!profile.showTimer) return;
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [question?.id, profile.showTimer]);

  const progress = useMemo(
    () => (index + 1) / Math.max(1, test.questions.length),
    [index, test.questions.length]
  );

  if (!question) {
    return (
      <View style={styles.empty}>
        <Text style={type.body}>No questions to show.</Text>
      </View>
    );
  }

  const isLast = index === test.questions.length - 1;
  const current = answers[question.id] ?? '';
  const limit = question.timeLimitSeconds;
  const remaining = profile.showTimer && limit !== null ? Math.max(0, limit - tick) : null;
  const answered = current.trim().length > 0;

  function choose(optionKey: string) {
    setAnswers((a) => ({ ...a, [question!.id]: optionKey }));
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
      const responses: ResponseInput[] = test.questions.map((q) => ({
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
          <ProgressDots total={test.questions.length} current={index} scale={s} />
        ) : (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        )}

        <View style={styles.headerRow}>
          <Text style={type.label}>
            {young
              ? `QUESTION ${index + 1} OF ${test.questions.length}`
              : `${test.domains[question.domain]?.label.toUpperCase() ?? question.domain} · ${index + 1} OF ${test.questions.length}`}
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
        {question.visual ? (
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
              accessibilityLabel="Hear the question again"
              onPress={() => speak(question.spoken ?? question.prompt)}
              style={({ pressed }) => [styles.replay, pressed && { opacity: 0.8 }]}
            >
              <Text style={{ fontSize: scaled(24, s) }}>🔊</Text>
            </Pressable>
          )}
        </View>

        {question.type === 'mcq' && question.options ? (
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
                  {opt.symbol ? (
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
          />
        ) : (
          <View style={{ marginTop: spacing(3) }}>
            <TextInput
              style={styles.textarea}
              value={current}
              onChangeText={(t) => setAnswers((a) => ({ ...a, [question.id]: t }))}
              placeholder="Type your answer here. Explain how you worked it out."
              placeholderTextColor={colors.inkSoft}
              multiline
              textAlignVertical="top"
              maxLength={4000}
            />
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
