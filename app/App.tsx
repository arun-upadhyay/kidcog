import React, { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import StartScreen from './src/screens/StartScreen';
import QuizScreen from './src/screens/QuizScreen';
import CelebrationScreen from './src/screens/CelebrationScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import { fetchTest, submitAnswers } from './src/api';
import { stopSpeaking } from './src/speech';
import { colors } from './src/theme';
import type { ChildProfile, Report, ResponseInput, TestPayload } from './src/types';

/**
 * `celebrate` only exists for the young profile: the child sees a well done,
 * and the scores sit behind a grown-up gate. Older children go straight to
 * results, where seeing their own score is reasonable and useful.
 */
type Stage = 'start' | 'quiz' | 'celebrate' | 'results';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

export default function App() {
  const [stage, setStage] = useState<Stage>('start');
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [test, setTest] = useState<TestPayload | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (profile: ChildProfile) => {
    setBusy(true);
    setError(null);
    try {
      const t = await fetchTest(profile.age);
      if (!t.questions.length) {
        throw new Error('There are no questions for that age yet.');
      }
      setChild(profile);
      setTest(t);
      setStage('quiz');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const finish = useCallback(
    async (responses: ResponseInput[]) => {
      setBusy(true);
      setError(null);
      try {
        const r = await submitAnswers({ child, responses });
        setReport(r);
        setStage(test?.profile.showScoreToChild ? 'results' : 'celebrate');
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setBusy(false);
      }
    },
    [child, test]
  );

  const restart = useCallback(() => {
    stopSpeaking();
    setStage('start');
    setTest(null);
    setReport(null);
    setChild(null);
    setError(null);
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.root}>
          {stage === 'start' && <StartScreen onStart={start} loading={busy} error={error} />}

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
            <ResultsScreen report={report} childName={child?.firstName} onRestart={restart} />
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
