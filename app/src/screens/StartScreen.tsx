import React, { useState } from 'react';
import { Alert, Platform, View, Text, TextInput, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';
import type { ChildProfile, SavedChildProfile } from '../types';

export interface StartScreenProps {
  onStart: (profile: ChildProfile) => void;
  loading: boolean;
  error: string | null;
  savedChildren: SavedChildProfile[];
  onViewHistory: (child: SavedChildProfile) => void;
  onDeleteChild: (child: SavedChildProfile) => Promise<void>;
}

/**
 * Ages as tappable chips rather than a keyboard.
 *
 * The grown-up fills this in, so a number field would work — but chips make the
 * age-band boundary visible, which is the thing that actually changes what the
 * child gets. Someone choosing 7 versus 8 should be able to see that it matters.
 */
const AGES = [4, 5, 6, 7] as const;
const AGE_ICONS: Record<(typeof AGES)[number], string> = { 4: '🐣', 5: '⭐', 6: '🚀', 7: '🦄' };
const PROFILE_COLORS = ['#E5F3FF', '#FFF0D9', '#E5F5EA', '#F2EAFE'] as const;

export default function StartScreen({ onStart, loading, error, savedChildren, onViewHistory, onDeleteChild }: StartScreenProps) {
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState<number | null>(5);
  const [consent, setConsent] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canStart = consent && !loading;
  const young = age !== null && age <= 7;

  function handleStart() {
    const profile: ChildProfile = {};
    const trimmed = firstName.trim();
    if (trimmed) profile.firstName = trimmed;
    if (age !== null) profile.age = age;
    onStart(profile);
  }

  function chooseSaved(child: SavedChildProfile) {
    setFirstName(child.nickname);
    if (child.age !== null) setAge(child.age);
  }

  async function removeChild(child: SavedChildProfile) {
    setDeletingId(child.id);
    try {
      await onDeleteChild(child);
      if (firstName.trim().toLowerCase() === child.nickname.trim().toLowerCase()) setFirstName('');
    } finally { setDeletingId(null); }
  }

  function confirmDelete(child: SavedChildProfile) {
    const message = `Delete ${child.nickname}'s profile? This permanently removes every saved assessment, question, answer, and result for this child.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm(message)) void removeChild(child);
      return;
    }
    Alert.alert('Delete child profile?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete profile', style: 'destructive', onPress: () => void removeChild(child) },
    ]);
  }


  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <View style={styles.decorOne} />
        <View style={styles.decorTwo} />
        <View style={styles.mascotBubble}><Text style={styles.mascot}>🦉</Text></View>
        <Text style={styles.title}>KidCog</Text>
        <Text style={styles.tagline}>Little ideas. Big imagination. ✨</Text>
      </View>


      <View style={styles.card}>
        <View style={styles.cardTitleRow}><View style={styles.grownUpIcon}><Text style={styles.cardEmoji}>🛡️</Text></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>A note for the grown-up</Text><Text style={styles.cardSubtitle}>A playful practice activity</Text></View></View>
        <Text style={styles.cardBody}>
          This is a practice activity, not an IQ test and not a clinical assessment. It does not
          produce an IQ score, a percentile, or a comparison with other children. Treat the result as
          a snapshot of one session.
        </Text>
        <View style={styles.privacyNote}><Text style={styles.privacyIcon}>🔒</Text><Text style={styles.privacyText}>
          Spoken and written answers are sent to an AI service to be scored against a rubric. Please
          don&apos;t include your child&apos;s full name, school, or address in the answers.
        </Text></View>
      </View>

      <View style={styles.field}>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>How old are they?</Text><Text style={styles.sectionHint}>We’ll make every activity fit their age.</Text></View><Text style={styles.sectionEmoji}>🎈</Text></View>
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
                <Text style={styles.ageIcon}>{AGE_ICONS[a]}</Text>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>Age {a}</Text>
                {on ? <View style={styles.ageCheck}><Text style={styles.ageCheckText}>✓</Text></View> : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.ageTip}><Text style={styles.ageTipIcon}>🔊</Text><Text style={styles.ageTipText}>
          {young
            ? 'Tap the speaker button to hear a question, answer by tapping or speaking, and the score is kept for you rather than shown to your child.'
            : 'Questions are read on screen and written answers are typed.'}
        </Text></View>
      </View>

      <View style={styles.field}>
        <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>Who’s playing?</Text><Text style={styles.sectionHint}>Choose a saved child or add a nickname.</Text></View><Text style={styles.sectionEmoji}>🌟</Text></View>
        {savedChildren.length ? <View style={styles.savedList}>{savedChildren.map((saved, index) => {
          const selectedProfile = firstName.trim().toLowerCase() === saved.nickname.trim().toLowerCase();
          return <View key={saved.id} style={[styles.savedCard, { backgroundColor: PROFILE_COLORS[index % PROFILE_COLORS.length] }, selectedProfile && styles.savedCardSelected]}>
          <Pressable onPress={() => chooseSaved(saved)} style={styles.savedName}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{['🐻','🦊','🐼','🐨'][index % 4]}</Text></View><View style={styles.savedCopy}><Text style={styles.savedNameText}>{saved.nickname}</Text><Text style={styles.savedMeta}>{saved.age !== null ? `Age ${saved.age} · ` : ''}{selectedProfile ? 'Ready to play!' : 'Tap to choose'}</Text></View></Pressable>
          <View style={styles.savedActions}>
            <Pressable onPress={() => onViewHistory(saved)} accessibilityRole="button" accessibilityLabel={`View ${saved.nickname}'s previous results`} accessibilityHint="Opens saved assessment reports" style={({ pressed }) => [styles.iconButton, styles.historyButton, pressed && styles.iconPressed]}><Text style={styles.actionIcon}>📚</Text></Pressable>
            <Pressable disabled={deletingId !== null} onPress={() => confirmDelete(saved)} accessibilityRole="button" accessibilityLabel={`Delete ${saved.nickname}'s profile`} accessibilityHint="Permanently removes this profile and its assessments" style={({ pressed }) => [styles.iconButton, styles.deleteProfile, (pressed || deletingId !== null) && styles.iconPressed]}><Text style={styles.actionIcon}>{deletingId === saved.id ? '⏳' : '🗑️'}</Text></Pressable>
          </View>
        </View>;
        })}</View> : null}
        <Text style={styles.inputLabel}>NEW NICKNAME (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={firstName}
          onChangeText={setFirstName}
          placeholder="e.g. Aanya"
          placeholderTextColor={colors.inkSoft}
          autoCapitalize="words"
          maxLength={60}
        />
        <Text style={styles.inputHelp}>Use a first name or nickname only. Activities and results are saved privately to your parent account.</Text>
      </View>

      <View style={styles.consentRow}>
        <Switch
          value={consent}
          onValueChange={setConsent}
          trackColor={{ true: colors.go, false: colors.line }}
        />
        <View style={styles.consentCopy}><Text style={styles.consentTitle}>Ready to begin?</Text><Text style={styles.consentText}>
          I am this child&apos;s parent or guardian, I understand this is a practice activity, and I
          agree to their answers being sent for AI scoring.
        </Text></View>
      </View>

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <Button
        title={loading ? 'Getting ready…' : 'Choose an adventure →'}
        onPress={handleStart}
        disabled={!canStart}
        loading={loading}
        uiScale={young ? 1.2 : 1}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#FFF8EF' },
  container: { padding: spacing(2.5), paddingBottom: spacing(6), width: '100%', maxWidth: 850, alignSelf: 'center' },
  header: { position: 'relative', alignItems: 'center', backgroundColor: '#EEE9FF', borderRadius: 26, paddingVertical: spacing(2.5), paddingHorizontal: spacing(2), overflow: 'hidden', borderWidth: 2, borderColor: '#CABAF0' },
  decorOne: { position: 'absolute', width: 90, height: 90, borderRadius: 45, backgroundColor: '#FFE4A8', top: -42, right: -22, opacity: 0.8 },
  decorTwo: { position: 'absolute', width: 65, height: 65, borderRadius: 33, backgroundColor: '#CDEEDC', bottom: -34, left: 35, opacity: 0.8 },
  mascotBubble: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#CABAF0', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-4deg' }] },
  mascot: { fontSize: 48, textAlign: 'center' },
  title: {
    fontSize: 38,
    fontWeight: '800',
    color: '#6B4BB0',
    textAlign: 'center',
    marginTop: spacing(0.5),
  },
  tagline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6D5B91',
    textAlign: 'center',
    marginTop: spacing(0.5),
  },
  card: {
    backgroundColor: '#EAF6FF',
    borderRadius: 22,
    padding: spacing(2),
    marginTop: spacing(2),
    borderWidth: 2,
    borderColor: '#A8D4EF',
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(1.25) },
  grownUpIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#A8D4EF', alignItems: 'center', justifyContent: 'center' },
  cardEmoji: { fontSize: 26 },
  cardTitle: { fontSize: 18, lineHeight: 22, fontWeight: '900', color: '#286789' },
  cardSubtitle: { fontSize: 12, lineHeight: 16, color: '#56819A', marginTop: 1 },
  cardBody: { fontSize: 14, lineHeight: 21, color: '#3F5360', marginTop: spacing(1.5) },
  privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1), backgroundColor: '#FFFFFF', borderRadius: 13, padding: spacing(1.25), marginTop: spacing(1.5) },
  privacyIcon: { fontSize: 16 },
  privacyText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#5E6E78' },
  field: { marginTop: spacing(2), gap: spacing(1.25), backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#EEDFCB', borderRadius: 22, padding: spacing(2) },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(1) },
  sectionTitle: { fontSize: 18, lineHeight: 23, fontWeight: '900', color: '#513A27' },
  sectionHint: { fontSize: 12, lineHeight: 17, color: colors.inkSoft, marginTop: 1 },
  sectionEmoji: { fontSize: 28 },
  chips: { flexDirection: 'row', gap: spacing(0.75) },
  chip: {
    flex: 1,
    minWidth: 58,
    height: 82,
    borderRadius: 18,
    backgroundColor: '#FFF9F0',
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.happySoft, borderColor: colors.happy, transform: [{ translateY: -2 }], shadowColor: colors.happy, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  ageIcon: { fontSize: 25 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '800', color: colors.inkSoft, marginTop: 2 },
  chipTextOn: { color: '#8A5A0A' },
  ageCheck: { position: 'absolute', right: 5, top: 5, width: 19, height: 19, borderRadius: 10, backgroundColor: colors.go, alignItems: 'center', justifyContent: 'center' },
  ageCheckText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  ageTip: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1), backgroundColor: '#F2EAFE', borderRadius: 13, padding: spacing(1.25) },
  ageTipIcon: { fontSize: 17 },
  ageTipText: { flex: 1, fontSize: 12, lineHeight: 18, color: '#665582' },
  savedList: { gap: spacing(1), marginBottom: spacing(1) },
  savedCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: spacing(1.25), gap: spacing(1), borderWidth: 2, borderColor: 'transparent' },
  savedCardSelected: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.14, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  savedName: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  profileAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { fontSize: 25 },
  savedCopy: { flex: 1 },
  savedNameText: { fontWeight: '800', color: '#513A27', fontSize: 16 },
  savedMeta: { color: '#75695F', fontSize: 12, lineHeight: 17, marginTop: 1 },
  savedActions: { flexDirection: 'row', alignItems: 'center', gap: spacing(1) },
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  historyButton: { backgroundColor: colors.goSoft },
  deleteProfile: { backgroundColor: '#FBE9E7' },
  actionIcon: { fontSize: 27 }, iconPressed: { opacity: 0.55, transform: [{ scale: 0.96 }] },
  inputLabel: { fontSize: 11, lineHeight: 15, fontWeight: '800', letterSpacing: 0.8, color: '#8B7460', marginTop: spacing(0.5) },
  input: {
    backgroundColor: '#FFF9F0',
    borderWidth: 2,
    borderColor: '#E8D5BA',
    borderRadius: 16,
    paddingHorizontal: spacing(2),
    paddingVertical: spacing(1.75),
    fontSize: 16,
    color: colors.ink,
  },
  inputHelp: { fontSize: 12, lineHeight: 18, color: colors.inkSoft },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(1.5),
    marginTop: spacing(2),
    marginBottom: spacing(2),
    backgroundColor: '#E5F5EA',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#A9D7B8',
    padding: spacing(1.5),
  },
  consentCopy: { flex: 1 },
  consentTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: '#34734E', marginBottom: 2 },
  consentText: { fontSize: 13, lineHeight: 19, color: '#4C6655' },
  errorBanner: {
    backgroundColor: '#FBE9E7',
    color: colors.danger,
    padding: spacing(2),
    borderRadius: 12,
    marginBottom: spacing(2),
    fontSize: 15,
  },
});
