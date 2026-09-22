import React, { useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import StartScreen from './src/screens/StartScreen';
import QuizScreen from './src/screens/QuizScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import { fetchTest, submitAnswers } from './src/api';
import { colors } from './src/theme';
import type { ChildProfile, Report, ResponseInput, TestPayload } from './src/types';

type Stage = 'start' | 'quiz' | 'results';

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
      if (!t.questions.length) throw new Error('No questions came back for that age.');
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
        setStage('results');
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setBusy(false);
      }
    },
    [child]
  );

  const restart = useCallback(() => {
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
