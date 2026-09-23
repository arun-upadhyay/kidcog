import React, { useState, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import CategoryScreen from './src/screens/CategoryScreen';
import StartScreen from './src/screens/StartScreen';
import QuizScreen from './src/screens/QuizScreen';
import CelebrationScreen from './src/screens/CelebrationScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import LoginScreen from './src/screens/LoginScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { deleteChildProfile, fetchTest, listChildren, saveChild, submitAnswers } from './src/api';
import { forgetSeen, loadSeen, rememberSeen } from './src/seenQuestions';
import { stopSpeaking } from './src/speech';
import { colors } from './src/theme';
import type { ChildProfile, HistoricalAssessment, Report, ResponseInput, SavedChildProfile, TestPayload, TraitKey } from './src/types';

/**
 * `celebrate` only exists for the young profile: the child sees a well done,
 * and the scores sit behind a grown-up gate. Older children go straight to
 * results, where seeing their own score is reasonable and useful.
 */
type Stage = 'start' | 'categories' | 'quiz' | 'celebrate' | 'results' | 'history' | 'historical_result';

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong.';
}

function KidCogApp() {
  const { session, loading: authLoading, signOut } = useAuth();
  const [stage, setStage] = useState<Stage>('start');
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [test, setTest] = useState<TestPayload | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [completedAnswers, setCompletedAnswers] = useState<ResponseInput[]>([]);
  const [roundCategory, setRoundCategory] = useState<TraitKey>('abstract_concepts');
  const [roundLength, setRoundLength] = useState(2);
  const generationLock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedChildren, setSavedChildren] = useState<SavedChildProfile[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyChild, setHistoryChild] = useState<SavedChildProfile | null>(null);
  const [historical, setHistorical] = useState<HistoricalAssessment | null>(null);

  useEffect(() => {
    if (!session) { setSavedChildren([]); return; }
    void listChildren().then(setSavedChildren).catch(err => setError(messageOf(err)));
  }, [session]);

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
    if (generationLock.current) return;
    generationLock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (completedAnswers.length >= 90) throw new Error('This session is full. View the combined results, then start a new session.');
      if (!profile.id) throw new Error('Choose or create a child nickname first.');
      const t = await fetchTest(profile.id, sessionId, profile.age, exclude, trait, count);
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
      setSessionId(t.sessionId);
      setRoundCategory(trait);
      setRoundLength(count);
      setStage('quiz');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      generationLock.current = false;
      setBusy(false);
    }
  }, [completedAnswers.length, sessionId]);

  const start = useCallback(async (profile: ChildProfile) => {
    setBusy(true); setError(null);
    try {
      const nickname = profile.firstName?.trim() || 'My child';
      const saved = await saveChild(nickname);
      const next = { ...profile, id: saved.id, firstName: saved.nickname };
      setSavedChildren(current => current.some(item => item.id === saved.id) ? current : [...current, saved]);
      setChild(next);
      setSessionId(null);
      setStage('categories');
    } catch (err) { setError(messageOf(err)); }
    finally { setBusy(false); }
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
        if (!sessionId) throw new Error('This assessment session is missing. Start a new session.');
        const r = await submitAnswers({ sessionId, child, responses: combined });
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
    [child, test, completedAnswers, sessionId]
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
    setSessionId(null);
  }, []);

  const logout = useCallback(async () => { restart(); await signOut(); }, [restart, signOut]);
  const openHistory = useCallback((selected: SavedChildProfile) => { setHistoryChild(selected); setHistorical(null); setError(null); setStage('history'); }, []);
  const deleteChild = useCallback(async (selected: SavedChildProfile) => {
    setError(null);
    try {
      await deleteChildProfile(selected.id);
      setSavedChildren(current => current.filter(item => item.id !== selected.id));
      if (child?.id === selected.id) setChild(null);
    } catch (err) { setError(messageOf(err)); throw err; }
  }, [child?.id]);

  if (authLoading || !session) return <LoginScreen />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.root}>
          {stage === 'start' && <StartScreen onStart={start} loading={busy} error={error} savedChildren={savedChildren} onSignOut={() => void logout()} onViewHistory={openHistory} onDeleteChild={deleteChild} />}

          {stage === 'history' && historyChild && <HistoryScreen child={historyChild} onBack={restart} onOpen={(item) => { setHistorical(item); setStage('historical_result'); }} />}

          {stage === 'historical_result' && historical && <ResultsScreen report={historical.report} childName={historical.childName} completedAt={historical.completedAt} historical onBackToHistory={() => setStage('history')} onRestart={restart} onChooseCategory={() => {}} onReassess={() => {}} onResetQuestions={() => {}} remainingUnseen={0} busy={false} error={null} />}

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

export default function App() {
  return <AuthProvider><KidCogApp /></AuthProvider>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  root: { flex: 1, backgroundColor: colors.bg },
});
