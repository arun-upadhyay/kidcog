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
  const { session, loading: authLoading, signOut, updatePassword } = useAuth();
  const [stage, setStage] = useState<Stage>('start');
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [test, setTest] = useState<TestPayload | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  // Categories tried during this visit, from each test's own result. Used only
  // for the explored markers on the category screen; results are never merged.
  const [explored, setExplored] = useState<Report['traits']>([]);
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

  /** Start a test. Every test is its own session with its own result. */
  const beginRound = useCallback(async (profile: ChildProfile, trait: TraitKey, count: number) => {
    if (generationLock.current) return;
    generationLock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!profile.id) throw new Error('Choose or create a child nickname first.');
      // null: a fresh session, so this test's result never includes earlier tests.
      const t = await fetchTest(profile.id, null, profile.age, trait, count);
      if (!t.questions.length) {
        throw new Error('No questions were generated. Please try again.');
      }
      setChild(profile);
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
  }, []);

  const start = useCallback(async (profile: ChildProfile) => {
    setBusy(true); setError(null);
    try {
      const nickname = profile.firstName?.trim() || 'My child';
      const saved = await saveChild(nickname, profile.age ?? 5);
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
      await beginRound(child, trait, count);
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
        // Only this test's answers: the result describes the test just taken.
        if (!sessionId) throw new Error('This assessment session is missing. Start a new session.');
        const r = await submitAnswers({ sessionId, child, responses });
        setReport(r);
        setExplored(current => {
          const byKey = new Map(current.map(t => [t.key, t]));
          for (const t of r.traits) if (t.questionCount > 0) byKey.set(t.key, t);
          return [...byKey.values()];
        });
        setStage(test?.profile.showScoreToChild ? 'results' : 'celebrate');
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setBusy(false);
      }
    },
    [child, test, sessionId]
  );

  /** Another round for the same child, allowing repeated questions. */
  const reassess = useCallback(async () => {
    if (!child) return;
    stopSpeaking();
    await beginRound(child, roundCategory, roundLength);
  }, [beginRound, child, roundCategory, roundLength]);

  const restart = useCallback(() => {
    stopSpeaking();
    setStage('start');
    setTest(null);
    setReport(null);
    setChild(null);
    setExplored([]);
    setError(null);
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
          {stage === 'start' && <StartScreen
            onStart={start}
            loading={busy}
            error={error}
            savedChildren={savedChildren}
            accountEmail={session.user.email ?? 'Signed-in parent'}
            accountProviders={Array.isArray(session.user.app_metadata.providers)
              ? session.user.app_metadata.providers.filter((provider: unknown): provider is string => typeof provider === 'string')
              : [session.user.app_metadata.provider].filter((provider: unknown): provider is string => typeof provider === 'string')}
            accountVerified={Boolean(session.user.email_confirmed_at)}
            accountCreatedAt={session.user.created_at}
            onChangePassword={updatePassword}
            onSignOut={() => void logout()}
            onViewHistory={openHistory}
            onDeleteChild={deleteChild}
          />}

          {stage === 'history' && historyChild && <HistoryScreen child={historyChild} onBack={restart} onOpen={(item) => { setHistorical(item); setStage('historical_result'); }} />}

          {stage === 'historical_result' && historical && <ResultsScreen report={historical.report} childName={historical.childName} completedAt={historical.completedAt} historical onBackToHistory={() => setStage('history')} onRestart={restart} onChooseCategory={() => {}} onReassess={() => {}} remainingUnseen={0} busy={false} error={null} />}

          {stage === 'categories' && <CategoryScreen onSelect={chooseRound} onReport={() => setStage('results')} onBack={restart} report={report} explored={explored} busy={busy} error={error} />}

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
