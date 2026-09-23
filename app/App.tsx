import React, { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import CategoryScreen from './src/screens/CategoryScreen';
import StartScreen from './src/screens/StartScreen';
import QuizScreen from './src/screens/QuizScreen';
import CelebrationScreen from './src/screens/CelebrationScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import { fetchTest, submitAnswers } from './src/api';
import { forgetSeen, loadSeen, rememberSeen } from './src/seenQuestions';
import { stopSpeaking } from './src/speech';
import { colors } from './src/theme';
import type { ChildProfile, Report, ResponseInput, TestPayload, TraitKey } from './src/types';

/**
 * `celebrate` only exists for the young profile: the child sees a well done,
 * and the scores sit behind a grown-up gate. Older children go straight to
 * results, where seeing their own score is reasonable and useful.
 */
type Stage = 'start' | 'categories' | 'quiz' | 'celebrate' | 'results';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export default function App() {
  const [stage, setStage] = useState<Stage>('start');
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [test, setTest] = useState<TestPayload | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [completedAnswers, setCompletedAnswers] = useState<ResponseInput[]>([]);
  const [roundCategory, setRoundCategory] = useState<TraitKey>('abstract_concepts');
  const [roundLength, setRoundLength] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ids this child has already been shown, across every past session on this
   * device. Held here so a reassessment can ask the server for fresh material:
   * running the same items twice measures recall, not reasoning.
   */
  const [seen, setSeen] = useState<string[]>([]);

  /**
   * Fetch a round and move into the quiz. `exclude` is passed explicitly rather
   * than read from state because the state update from the previous round has
   * not necessarily landed by the time a reassessment starts.
   */
  const beginRound = useCallback(async (profile: ChildProfile, exclude: string[], trait: TraitKey, count: number) => {
    setBusy(true);
    setError(null);
    try {
      if (completedAnswers.length >= 90) throw new Error('This session is full. View the combined results, then start a new session.');
      const t = await fetchTest(profile.age, exclude, trait, count);
      if (!t.questions.length) {
        throw new Error(
          exclude.length > 0
            ? 'No unseen questions remain in this category for this age. Choose another category, or reset question history from the results screen.'
            : 'There are no questions in this category for that age yet. Choose another category.'
        );
      }
      setChild(profile);
      setSeen(exclude);
      setTest(t);
      setRoundCategory(trait);
      setRoundLength(count);
      setStage('quiz');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, [completedAnswers.length]);

  const start = useCallback(async (profile: ChildProfile) => {
    setChild(profile);
    setError(null);
    setStage('categories');
  }, []);

  const chooseRound = useCallback(async (trait: TraitKey, count: number) => {
    if (!child) return;
    try {
      const already = await loadSeen(child.firstName);
      await beginRound(child, already, trait, count);
    } catch (err) { setError(messageOf(err)); }
  }, [child, beginRound]);

  const chooseCategory = useCallback(() => {
    stopSpeaking();
    setError(null);
    setStage('categories');
  }, []);

  const finish = useCallback(
    async (responses: ResponseInput[]) => {
      setBusy(true);
      setError(null);
      try {
        // Latest answer wins when a parent explicitly allows a repeat. Never
        // double-count the same question in the combined session.
        const byId = new Map(completedAnswers.map(r => [r.questionId, r]));
        for (const response of responses) byId.set(response.questionId, response);
        const combined = [...byId.values()];
        const r = await submitAnswers({ child, responses: combined });
        setCompletedAnswers(combined);
        // Record before showing the report: if the parent closes the app on the
        // results screen, the next round should still serve fresh questions.
        await rememberSeen(r.seenQuestionIds, child?.firstName);
        setSeen((prev) => Array.from(new Set([...prev, ...r.seenQuestionIds])));
        setReport(r);
        setStage(test?.profile.showScoreToChild ? 'results' : 'celebrate');
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setBusy(false);
      }
    },
    [child, test, completedAnswers]
  );

  /** Another round for the same child, drawing only on unseen questions. */
  const reassess = useCallback(async () => {
    if (!child) return;
    stopSpeaking();
    const already = await loadSeen(child.firstName);
    await beginRound(child, already, roundCategory, roundLength);
  }, [beginRound, child, roundCategory, roundLength]);

  /** Clear the history so the whole bank is available again. */
  const resetQuestions = useCallback(async () => {
    if (!child) return;
    stopSpeaking();
    await forgetSeen(child.firstName);
    setSeen([]);
    await beginRound(child, [], roundCategory, roundLength);
  }, [beginRound, child, roundCategory, roundLength]);

  const restart = useCallback(() => {
    stopSpeaking();
    setStage('start');
    setTest(null);
    setReport(null);
    setChild(null);
    setCompletedAnswers([]);
    setError(null);
    setSeen([]);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.root}>
          {stage === 'start' && <StartScreen onStart={start} loading={busy} error={error} />}

          {stage === 'categories' && <CategoryScreen onSelect={chooseRound} onReport={() => setStage('results')} onBack={restart} report={report} busy={busy} error={error} />}

          {stage === 'quiz' && test && (
            <QuizScreen test={test} onFinish={finish} submitting={busy} error={error} />
          )}

          {stage === 'celebrate' && (
            <CelebrationScreen
              childName={child?.firstName}
              onUnlock={() => setStage('results')}
              onRestart={restart}
            />
          )}

          {stage === 'results' && report && (
            <ResultsScreen
              report={report}
              childName={child?.firstName}
              onRestart={restart}
              onChooseCategory={chooseCategory}
              onReassess={reassess}
              onResetQuestions={resetQuestions}
              remainingUnseen={test?.remainingUnseen ?? 0}
              busy={busy}
              error={error}
            />
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg },
});
