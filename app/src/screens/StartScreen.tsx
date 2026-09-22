import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Switch } from 'react-native';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import type { ChildProfile } from '../types';

export interface StartScreenProps {
  onStart: (profile: ChildProfile) => void;
  loading: boolean;
  error: string | null;
}

export default function StartScreen({ onStart, loading, error }: StartScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [consent, setConsent] = useState(false);

  const ageNum = Number(age);
  const ageValid = age === '' || (Number.isInteger(ageNum) && ageNum >= 4 && ageNum <= 18);
  const canStart = consent && ageValid && !loading;

  function handleStart() {
    const profile: ChildProfile = {};
    const trimmed = firstName.trim();
    if (trimmed) profile.firstName = trimmed;
    if (age !== '') profile.age = ageNum;
    onStart(profile);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={type.label}>PRACTICE REASONING ACTIVITY</Text>
      <Text style={[type.title, { marginTop: spacing(1) }]}>KidCog</Text>
      <Text style={[type.soft, { marginTop: spacing(1.5) }]}>
        A set of short thinking puzzles across four areas. Some are multiple choice, some ask the
        child to explain their thinking in their own words.
      </Text>

      <View style={styles.card}>
        <Text style={type.heading}>Before you begin</Text>
        <Text style={[type.body, { marginTop: spacing(1) }]}>
          This is a practice activity, not an IQ test and not a clinical assessment. It does not
          produce an IQ score, a percentile, or a comparison with other children, because it has not
          been standardised against one. Treat the result as a snapshot of one session.
        </Text>
        <Text style={[type.soft, { marginTop: spacing(1.5) }]}>
          Written answers are sent to an AI grading service to be scored against a rubric. Do not
          include the child&apos;s full name, school, address, or anything else identifying in the
          answers.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={type.label}>CHILD&apos;S FIRST NAME (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="e.g. Aanya"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="words"
          maxLength={60}
        />
        <Text style={type.soft}>
          Used only to address the summary. Nothing is stored on a server.
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={type.label}>AGE (OPTIONAL)</Text>
        <TextInput
          style={[styles.input, !ageValid && styles.inputError]}
          value={age}
          onChangeText={setAge}
          placeholder="e.g. 9"
          placeholderTextColor={colors.inkSoft}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Text style={ageValid ? type.soft : styles.errorText}>
          {ageValid
            ? 'Picks questions suited to that age. Leave blank for all of them.'
            : 'Enter an age between 4 and 18.'}
        </Text>
      </View>

      <View style={styles.consentRow}>
        <Switch
          value={consent}
          onValueChange={setConsent}
          trackColor={{ true: colors.accent, false: colors.line }}
        />
        <Text style={[type.body, styles.consentText]}>
          I am this child&apos;s parent or guardian, I understand this is a practice activity, and I
          agree to written answers being sent for AI grading.
        </Text>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <Button
        title={loading ? 'Loading questions…' : 'Start the activity'}
        onPress={handleStart}
        disabled={!canStart}
        loading={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing(3), paddingBottom: spacing(6) },
  card: {
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    padding: spacing(2.5),
    marginTop: spacing(3),
  },
  field: { marginTop: spacing(3), gap: spacing(1) },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.75),
    fontSize: 16,
    color: colors.ink,
  },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 14, color: colors.danger },
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
