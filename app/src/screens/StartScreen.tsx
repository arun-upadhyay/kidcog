import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import type { ChildProfile } from '../types';

export interface StartScreenProps {
  onStart: (profile: ChildProfile) => void;
  loading: boolean;
  error: string | null;
}

/**
 * Ages as tappable chips rather than a keyboard.
 *
 * The grown-up fills this in, so a number field would work — but chips make the
 * age-band boundary visible, which is the thing that actually changes what the
 * child gets. Someone choosing 7 versus 8 should be able to see that it matters.
 */
const AGES = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export default function StartScreen({ onStart, loading, error }: StartScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState<number | null>(5);
  const [consent, setConsent] = useState(false);

  const canStart = consent && !loading;
  const young = age !== null && age <= 7;

  function handleStart() {
    const profile: ChildProfile = {};
    const trimmed = firstName.trim();
    if (trimmed) profile.firstName = trimmed;
    if (age !== null) profile.age = age;
    onStart(profile);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.mascot}>🦉</Text>
      <Text style={styles.title}>KidCog</Text>
      <Text style={styles.tagline}>Thinking puzzles to do together</Text>

      <View style={styles.card}>
        <Text style={type.heading}>For the grown-up</Text>
        <Text style={[type.body, { marginTop: spacing(1) }]}>
          This is a practice activity, not an IQ test and not a clinical assessment. It does not
          produce an IQ score, a percentile, or a comparison with other children. Treat the result as
          a snapshot of one session.
        </Text>
        <Text style={[type.soft, { marginTop: spacing(1.5) }]}>
          Spoken and written answers are sent to an AI service to be scored against a rubric. Please
          don&apos;t include your child&apos;s full name, school, or address in the answers.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={type.label}>HOW OLD ARE THEY?</Text>
        <View style={styles.chips}>
          {AGES.map((a) => {
            const on = age === a;
            return (
              <Pressable
                key={a}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Age ${a}`}
                onPress={() => setAge(a)}
                style={({ pressed }) => [
                  styles.chip,
                  on && styles.chipOn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{a}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={type.soft}>
          {young
            ? 'Tap the speaker button to hear a question, answer by tapping or speaking, and the score is kept for you rather than shown to your child.'
            : 'Questions are read on screen and written answers are typed.'}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={type.label}>THEIR FIRST NAME (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="e.g. Aanya"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="words"
          maxLength={60}
        />
        <Text style={type.soft}>Only used to address the report. Nothing is stored on a server.</Text>
      </View>

      <View style={styles.consentRow}>
        <Switch
          value={consent}
          onValueChange={setConsent}
          trackColor={{ true: colors.go, false: colors.line }}
        />
        <Text style={[type.body, styles.consentText]}>
          I am this child&apos;s parent or guardian, I understand this is a practice activity, and I
          agree to their answers being sent for AI scoring.
        </Text>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <Button
        title={loading ? 'Getting ready…' : 'Choose categories →'}
        onPress={handleStart}
        disabled={!canStart}
        loading={loading}
        uiScale={young ? 1.2 : 1}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6) },
  mascot: { fontSize: 64, textAlign: 'center' },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing(0.5),
  },
  tagline: {
    fontSize: 17,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: spacing(0.5),
  },
  card: {
    backgroundColor: colors.coolSoft,
    borderRadius: 18,
    padding: spacing(2.5),
    marginTop: spacing(3),
  },
  field: { marginTop: spacing(3), gap: spacing(1.25) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.25) },
  chip: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.happySoft, borderColor: colors.happy },
  chipText: { fontSize: 20, fontWeight: '700', color: colors.inkSoft },
  chipTextOn: { color: colors.ink },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.75),
    fontSize: 16,
    color: colors.ink,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(1.5),
    marginTop: spacing(3),
    marginBottom: spacing(3),
  },
  consentText: { flex: 1, fontSize: 15, lineHeight: 22 },
  errorBanner: {
    backgroundColor: '#FBE9E7',
    color: colors.danger,
    padding: spacing(2),
    borderRadius: 12,
    marginBottom: spacing(2),
    fontSize: 15,
  },
});
