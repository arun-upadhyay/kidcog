import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import { speak, stopSpeaking } from '../speech';

export interface CelebrationScreenProps {
  childName?: string | undefined;
  onUnlock: () => void;
  onRestart: () => void;
}

/**
 * What a young child sees when they finish.
 *
 * They get a well done and nothing else. No percentage, no "you got 4 of 10",
 * no red crosses. A five-year-old shown 40% learns that they failed, which is
 * both untrue and the fastest way to make them refuse the next session.
 *
 * The grown-up's results sit behind the gate below. It is not real security —
 * it is a speed bump that a child who cannot yet do two-digit arithmetic will
 * not casually walk through, which is exactly as much as is needed.
 */
export default function CelebrationScreen({
  childName,
  onUnlock,
  onRestart,
}: CelebrationScreenProps) {
  const [gate, setGate] = useState<{ a: number; b: number } | null>(null);
  const [wrong, setWrong] = useState(false);

  const wellDone = childName
    ? `Great job, ${childName}! You finished all the puzzles. Well done.`
    : 'Great job! You finished all the puzzles. Well done.';

  // The child cannot read this screen any more than they could read the
  // questions, so the well done is spoken too.
  useEffect(() => {
    void speak(wellDone);
    return () => stopSpeaking();
  }, [wellDone]);

  function openGate() {
    // Two-digit sum, deliberately beyond the target age band.
    const a = 11 + Math.floor(Math.random() * 9);
    const b = 11 + Math.floor(Math.random() * 9);
    setGate({ a, b });
    setWrong(false);
  }

  function answerGate(value: number) {
    if (!gate) return;
    if (value === gate.a + gate.b) onUnlock();
    else setWrong(true);
  }

  // Three plausible answers, only one correct.
  const choices = gate
    ? shuffle([gate.a + gate.b, gate.a + gate.b + 3, gate.a + gate.b - 4])
    : [];

  return (
    <View style={styles.container}>
      <Text style={styles.burst}>🎉</Text>
      <Text style={styles.big}>
        {childName ? `Great job, ${childName}!` : 'Great job!'}
      </Text>
      <Text style={styles.sub}>You finished all the puzzles.</Text>
      <Text style={styles.stars}>⭐ ⭐ ⭐</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hear it again"
        onPress={() => void speak(wellDone)}
        style={({ pressed }) => [styles.replay, pressed && { opacity: 0.8 }]}
      >
        <Text style={{ fontSize: 26 }}>🔊</Text>
      </Pressable>

      <View style={styles.gateArea}>
        {!gate ? (
          <Pressable onPress={openGate} style={styles.gateLink}>
            <Text style={styles.gateLinkText}>Grown-ups: see the results</Text>
          </Pressable>
        ) : (
          <View style={styles.gateCard}>
            <Text style={type.label}>FOR A GROWN-UP</Text>
            <Text style={[type.body, { marginTop: spacing(1) }]}>
              What is {gate.a} + {gate.b}?
            </Text>
            <View style={styles.gateChoices}>
              {choices.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => answerGate(c)}
                  style={({ pressed }) => [styles.gateChoice, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.gateChoiceText}>{c}</Text>
                </Pressable>
              ))}
            </View>
            {wrong ? <Text style={styles.wrong}>Not quite — try again.</Text> : null}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Button title="Play again" variant="secondary" onPress={onRestart} uiScale={1.2} />
      </View>
    </View>
  );
}

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = out[i]!;
    const b = out[j]!;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  burst: { fontSize: 84 },
  big: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing(2),
  },
  sub: { fontSize: 19, color: colors.ink, textAlign: 'center', marginTop: spacing(1) },
  stars: { fontSize: 40, marginTop: spacing(2.5), letterSpacing: 6 },
  replay: {
    marginTop: spacing(3),
    backgroundColor: colors.coolSoft,
    borderRadius: 999,
    padding: spacing(1.5),
    borderWidth: 1.5,
    borderColor: colors.cool,
  },
  gateArea: { marginTop: spacing(4), width: '100%', alignItems: 'center' },
  gateLink: { padding: spacing(1.5) },
  gateLinkText: { color: colors.inkSoft, fontSize: 15, textDecorationLine: 'underline' },
  gateCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 16,
    padding: spacing(2.5),
    width: '100%',
  },
  gateChoices: { flexDirection: 'row', gap: spacing(1.5), marginTop: spacing(2) },
  gateChoice: {
    flex: 1,
    paddingVertical: spacing(1.75),
    borderRadius: 12,
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
  },
  gateChoiceText: { fontSize: 20, fontWeight: '700', color: colors.ink },
  wrong: { color: colors.warn, marginTop: spacing(1.5), fontSize: 15 },
  footer: { marginTop: spacing(5), width: '100%' },
});
