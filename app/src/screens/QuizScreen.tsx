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
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import type { PublicQuestion, ResponseInput, TestPayload } from '../types';

export interface QuizScreenProps {
  test: TestPayload;
  onFinish: (responses: ResponseInput[]) => void;
  submitting: boolean;
  error: string | null;
}

export default function QuizScreen({ test, onFinish, submitting, error }: QuizScreenProps) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const startedAt = useRef<number>(Date.now());
  const [tick, setTick] = useState(0);

  // `noUncheckedIndexedAccess` makes this possibly-undefined, which is honest:
  // an empty question list would otherwise crash on render. App.tsx guards
  // against it, and this guard is the belt to that pair of braces.
  const question: PublicQuestion | undefined = test.questions[index];

  // Reset the per-question stopwatch whenever we move to a new question.
  useEffect(() => {
    startedAt.current = Date.now();
    setTick(0);
  }, [question?.id]);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, [question?.id]);

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
  const remaining = limit !== null ? Math.max(0, limit - tick) : null;
  const domainLabel = test.domains[question.domain]?.label ?? question.domain;
  const answered = current.trim().length > 0;

  function record(q: PublicQuestion) {
    setElapsed((e) => ({
      ...e,
      [q.id]: Math.round((Date.now() - startedAt.current) / 1000),
    }));
  }

  function goNext() {
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
    record(question!);
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={styles.headerRow}>
          <Text style={type.label}>
            {domainLabel.toUpperCase()} · {index + 1} OF {test.questions.length}
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
        <Text style={styles.prompt}>{question.prompt}</Text>

        {question.type === 'mcq' && question.options ? (
          <View style={{ gap: spacing(1.5), marginTop: spacing(3) }}>
            {question.options.map((opt) => {
              const selected = current === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => setAnswers((a) => ({ ...a, [question.id]: opt.key }))}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View style={[styles.bullet, selected && styles.bulletSelected]}>
                    <Text style={[styles.bulletText, selected && { color: '#fff' }]}>
                      {opt.key.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.optionText}>{opt.text}</Text>
                </Pressable>
              );
            })}
          </View>
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

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        {index > 0 && !submitting && (
          <View style={{ flex: 1 }}>
            <Button title="Back" variant="secondary" onPress={goBack} />
          </View>
        )}
        <View style={{ flex: 2 }}>
          <Button
            title={
              submitting ? 'Scoring…' : isLast ? 'Finish and score' : answered ? 'Next' : 'Skip'
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
  progressTrack: { height: 6, backgroundColor: colors.line, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.accent },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  body: { padding: spacing(3), paddingBottom: spacing(4) },
  prompt: { fontSize: 22, lineHeight: 32, fontWeight: '600', color: colors.ink },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    padding: spacing(2),
    minHeight: 60,
  },
  optionSelected: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  bullet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletSelected: { backgroundColor: colors.accent },
  bulletText: { fontWeight: '700', color: colors.inkSoft },
  optionText: { flex: 1, fontSize: 17, color: colors.ink },
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
